import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { moduloSchema, patrimonioSchema, comprobanteSchema, tramiteSchema, documentoSchema,
  validarArchivo, nombreArchivoSeguro, MAX_FILE_BYTES, MAX_ORG_BYTES, type Modulo } from "./validation"

class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
const roles = ["admin", "encargado"] as const
function scope(ctx: AuthContext, campo: string) {
  if (!ctx.establecimientoIdsConRol([...roles]).includes(campo)) throw new RequestError("No tenés permisos de administración en este campo", 403)
  return { establecimientoId: campo }
}
function date(value: string | null | undefined) { return value ? new Date(`${value}T00:00:00Z`) : null }
async function boundedBody(request: NextRequest, limit: number) {
  const reader = request.body?.getReader()
  if (!reader) throw new RequestError("Solicitud vacía")
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) { await reader.cancel(); throw new RequestError("Solicitud demasiado grande. Máximo 2 MB por archivo.", 413) }
    chunks.push(value)
  }
  return new Uint8Array(Buffer.concat(chunks)).buffer
}
async function audit(tx: Prisma.TransactionClient, ctx: AuthContext, campo: string, modulo: Modulo, id: string, update: boolean) {
  await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[campo],
    tabla: modulo, rowPk: id, accion: update ? "UPDATE" : "INSERT", detalle: { establecimientoId: campo } } })
}
export async function administracionHandler(action: () => Promise<Response>) {
  try { return await action() } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 })
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return NextResponse.json({ error: "Ya existe un comprobante con ese número, tipo y contraparte en este campo" }, { status: 409 })
      if (error.code === "P2025") return NextResponse.json({ error: "El registro cambió o ya no está disponible. Recargá antes de guardar." }, { status: 409 })
      if (error.code === "P2003") return NextResponse.json({ error: "El registro vinculado no pertenece a este campo o ya no existe" }, { status: 400 })
    }
    console.error("Error de administración", error instanceof Error ? error.name : "unknown")
    return NextResponse.json({ error: "No se pudo completar la operación" }, { status: 500 })
  }
}

export async function listar(request: NextRequest, ctx: AuthContext) {
  const modulo = moduloSchema.parse(ctx.params.modulo)
  const campo = z.string().uuid().parse(request.nextUrl.searchParams.get("establecimientoId"))
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 180)
  const page = z.coerce.number().int().min(1).max(100000).parse(request.nextUrl.searchParams.get("page") ?? 1)
  const where = { ...scope(ctx, campo), ...(q ? { OR: [{ titulo: { contains: q, mode: "insensitive" as const } }, { referencia: { contains: q, mode: "insensitive" as const } }] } : {}) }
  const args = { where, orderBy: { createdAt: "desc" as const }, take: 25, skip: (page - 1) * 25 }
  const [data, total] = modulo === "patrimonio" ? await Promise.all([prisma.activoPatrimonial.findMany(args), prisma.activoPatrimonial.count({ where })])
    : modulo === "comprobantes" ? await Promise.all([prisma.comprobante.findMany(args), prisma.comprobante.count({ where })])
    : modulo === "tramites" ? await Promise.all([prisma.tramite.findMany(args), prisma.tramite.count({ where })])
    : await Promise.all([prisma.documentoArchivo.findMany({ ...args, include: {
      activo: { select: { titulo: true } }, comprobante: { select: { titulo: true } }, tramite: { select: { titulo: true } },
      animal: { select: { caravanaVisual: true, caravanaRfid: true } },
    } }), prisma.documentoArchivo.count({ where })])
  return NextResponse.json({ data, total, page, pageSize: 25 }, { headers: { "Cache-Control": "private, no-store" } })
}

// Full replacement of editable metadata, versioned to prevent lost updates.
// Neither the owning field nor the original file can be replaced by editing.
export async function guardar(request: NextRequest, ctx: AuthContext, update = false) {
  const origin = request.headers.get("origin")
  let originHost: string | undefined
  try { if (origin) originHost = new URL(origin).host } catch { throw new RequestError("Origen inválido", 403) }
  if (request.headers.get("sec-fetch-site") === "cross-site" || (originHost && originHost !== request.headers.get("host"))) {
    throw new RequestError("Origen de la solicitud no permitido", 403)
  }
  const modulo = moduloSchema.parse(ctx.params.modulo)
  const id = update ? z.string().uuid().parse(ctx.params.id) : undefined
  const multipart = request.headers.get("content-type")?.startsWith("multipart/form-data")
  let raw: Record<string, unknown>
  let file: File | null = null
  if (modulo === "documentos" && !update) {
    if (!multipart) throw new RequestError("Adjuntá un PDF, JPG o PNG")
    // Count actual streamed bytes too: Content-Length is not a trusted limit.
    const bytes = await boundedBody(request, MAX_FILE_BYTES + 64 * 1024)
    let body: FormData
    try { body = await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData() }
    catch { throw new RequestError("Formulario de archivo inválido") }
    raw = JSON.parse(String(body.get("metadata") ?? "{}"))
    const candidate = body.get("archivo")
    if (!candidate || typeof candidate === "string") throw new RequestError("Falta el archivo")
    file = candidate
  } else {
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new RequestError("Se requiere JSON")
    raw = JSON.parse(new TextDecoder().decode(await boundedBody(request, 20000)))
  }
  if (!raw || Array.isArray(raw) || typeof raw !== "object") throw new RequestError("Datos inválidos")
  const version = update ? z.number().int().positive().parse(raw.version) : undefined
  if (update) delete raw.version
  const campo = z.string().uuid().parse(raw.establecimientoId)
  const where = { ...scope(ctx, campo), id, ...(update ? { version } : {}) }
  const result = await prisma.$transaction(async tx => {
    if (modulo === "patrimonio") {
      const value = patrimonioSchema.parse(raw)
      const data = { ...value, fecha: date(value.fecha) }
      const row = update ? await tx.activoPatrimonial.update({ where: { ...where, id: id! }, data: { ...data, version: { increment: 1 } } })
        : await tx.activoPatrimonial.create({ data })
      await audit(tx, ctx, campo, modulo, row.id, update); return row
    }
    if (modulo === "comprobantes") {
      const value = comprobanteSchema.parse(raw)
      const data = { ...value, fecha: date(value.fecha)!, vencimiento: date(value.vencimiento) }
      const row = update ? await tx.comprobante.update({ where: { ...where, id: id! }, data: { ...data, version: { increment: 1 } } })
        : await tx.comprobante.create({ data })
      await audit(tx, ctx, campo, modulo, row.id, update); return row
    }
    if (modulo === "tramites") {
      const value = tramiteSchema.parse(raw)
      const data = { ...value, fecha: date(value.fecha)!, vencimiento: date(value.vencimiento) }
      const row = update ? await tx.tramite.update({ where: { ...where, id: id! }, data: { ...data, version: { increment: 1 } } })
        : await tx.tramite.create({ data })
      await audit(tx, ctx, campo, modulo, row.id, update); return row
    }
    const value = documentoSchema.parse(raw)
    const linkWhere = { establecimientoId: campo }
    if (value.activoId && !await tx.activoPatrimonial.findFirst({ where: { ...linkWhere, id: value.activoId } })) throw new RequestError("Bien no disponible en este campo")
    if (value.comprobanteId && !await tx.comprobante.findFirst({ where: { ...linkWhere, id: value.comprobanteId } })) throw new RequestError("Comprobante no disponible en este campo")
    if (value.tramiteId && !await tx.tramite.findFirst({ where: { ...linkWhere, id: value.tramiteId } })) throw new RequestError("Trámite no disponible en este campo")
    if (value.animalId && !await tx.animal.findFirst({ where: { ...linkWhere, id: value.animalId } })) throw new RequestError("Animal no disponible en este campo")
    const data = { ...value, fecha: date(value.fecha), vencimiento: date(value.vencimiento) }
    if (update) {
      const row = await tx.documentoArchivo.update({ where: { ...where, id: id! }, data: { ...data, version: { increment: 1 } } })
      await audit(tx, ctx, campo, modulo, row.id, true); return row
    }
    const bytes = new Uint8Array(await file!.arrayBuffer())
    try { validarArchivo(bytes, file!.type) } catch (error) { throw new RequestError((error as Error).message) }
    // Serializes quota checks per organization, including simultaneous uploads.
    const org = ctx.organizacionDeEstablecimiento[campo]
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${org}))`
    const used = await tx.documentoArchivo.aggregate({ where: { establecimiento: { organizacionId: org } }, _sum: { bytes: true } })
    if ((used._sum.bytes ?? 0) + bytes.length > MAX_ORG_BYTES) throw new RequestError("Se alcanzó el límite inicial de 100 MB de archivos de la organización", 413)
    const row = await tx.documentoArchivo.create({ data: { ...data, nombreArchivo: nombreArchivoSeguro(file!.name),
      mime: file!.type, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), contenido: { create: { datos: bytes } } } })
    await audit(tx, ctx, campo, modulo, row.id, false); return row
  }, { timeout: 15000 })
  return NextResponse.json({ data: result }, { status: update ? 200 : 201 })
}

export async function descargar(_request: NextRequest, ctx: AuthContext) {
  const id = z.string().uuid().parse(ctx.params.id)
  const row = await prisma.documentoArchivo.findFirst({ where: { id, establecimientoId: { in: ctx.establecimientoIdsConRol([...roles]) } }, include: { contenido: true } })
  if (!row?.contenido) throw new RequestError("Archivo no encontrado", 404)
  return new Response(new Uint8Array(row.contenido.datos).buffer, { headers: {
    "Content-Type": row.mime, "Content-Length": String(row.bytes),
    "Content-Disposition": `attachment; filename="archivo"; filename*=UTF-8''${encodeURIComponent(row.nombreArchivo)}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox",
  } })
}
