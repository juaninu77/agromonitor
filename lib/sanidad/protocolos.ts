// Protocolos sanitarios de una organización y zona de aftosa de cada campo.
// - Los editan admin, encargado o vet de la organización (el veterinario define el plan).
// - La zona de aftosa del campo la definen admin o encargado de ese campo.
// - Las plantillas del sistema se copian a la organización (no se editan en el lugar).

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { crearProtocoloSchema, edicionProtocoloSchema, zonaAftosaSchema, type ItemPlan } from "./plan"
import { PLANTILLAS, plantillaPorCodigo } from "./plantillas"
import { ROLES_SANIDAD } from "./validation"
import { SanidadError } from "./errores"

const ROLES_GESTION = ["admin", "encargado"] as const

function orgDelCampo(ctx: AuthContext, establecimientoId: string) {
  const org = ctx.organizacionDeEstablecimiento[establecimientoId]
  if (!org || !ctx.establecimientoIds.includes(establecimientoId)) throw new SanidadError("Campo no encontrado", 404)
  return org
}

const puedeEditarOrg = (ctx: AuthContext, org: string) => ctx.organizacionIdsConRol([...ROLES_SANIDAD]).includes(org)

const datosItem = (i: ItemPlan, orden: number) => ({
  orden, nombre: i.nombre, momento: i.momento, mes: i.momento === "fecha" ? i.mes : null, dia: i.momento === "fecha" ? i.dia : null,
  diasOffset: i.diasOffset, repetirCadaDias: i.repetirCadaDias, destinatarios: i.destinatarios, productoTipo: i.productoTipo,
  productoId: i.productoId, dosis: i.dosis, unidad: i.unidad, via: i.via, esAftosa: i.esAftosa, obligatorio: i.obligatorio, notas: i.notas,
})

/** Protocolos de la organización del campo, plantillas y zona de aftosa del campo. */
export async function listarProtocolos(ctx: AuthContext, establecimientoId: string) {
  const org = orgDelCampo(ctx, establecimientoId)
  const [protocolos, campo] = await Promise.all([
    prisma.protocoloSanitario.findMany({
      where: { organizacionId: org },
      include: { items: { orderBy: { orden: "asc" }, include: { producto: { select: { id: true, nombre: true } } } }, _count: { select: { calendarios: true } } },
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    }),
    prisma.establecimiento.findUnique({ where: { id: establecimientoId }, select: { id: true, nombre: true, zonaAftosa: true } }),
  ])
  return {
    campo,
    protocolos,
    plantillas: PLANTILLAS.map((p) => ({ codigo: p.codigo, nombre: p.nombre, descripcion: p.descripcion, especie: p.especie, zonaAplicable: p.zonaAplicable, items: p.items })),
    puedeEditar: puedeEditarOrg(ctx, org),
    puedeDefinirZona: ctx.establecimientoIdsConRol([...ROLES_GESTION]).includes(establecimientoId),
  }
}

/** Nombre libre dentro de la organización: "X", "X (2)", "X (3)"… */
async function nombreLibre(tx: Prisma.TransactionClient, org: string, base: string) {
  const usados = new Set((await tx.protocoloSanitario.findMany({ where: { organizacionId: org, nombre: { startsWith: base } }, select: { nombre: true } })).map((p) => p.nombre))
  if (!usados.has(base)) return base
  for (let n = 2; ; n++) if (!usados.has(`${base} (${n})`)) return `${base} (${n})`
}

/** Crea un protocolo en la organización del campo: copia de una plantilla, o vacío. */
export async function crearProtocolo(ctx: AuthContext, raw: unknown) {
  const v = crearProtocoloSchema.parse(raw)
  const org = orgDelCampo(ctx, v.establecimientoId)
  if (!puedeEditarOrg(ctx, org)) throw new SanidadError("Solo un administrador, encargado o veterinario puede crear protocolos", 403)
  const plantilla = v.plantilla ? plantillaPorCodigo(v.plantilla) : null
  if (v.plantilla && !plantilla) throw new SanidadError("Plantilla no encontrada", 404)
  if (!plantilla && (!v.nombre || !v.especie)) throw new SanidadError("Indicá nombre y especie del protocolo", 400)
  return prisma.$transaction(async (tx) => {
    const nombre = await nombreLibre(tx, org, (v.nombre ?? plantilla!.nombre).slice(0, 110))
    const protocolo = await tx.protocoloSanitario.create({
      data: {
        organizacionId: org, nombre, especie: plantilla?.especie ?? v.especie!, descripcion: plantilla?.descripcion ?? null,
        zonaAplicable: plantilla?.zonaAplicable ?? null, plantilla: plantilla?.codigo ?? null, creadoPorId: ctx.userId,
        items: plantilla ? { create: plantilla.items.map((i, n) => datosItem(i, n)) } : undefined,
      },
      include: { items: { orderBy: { orden: "asc" } } },
    })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: org, tabla: "protocolos_sanitarios", rowPk: protocolo.id, accion: "INSERT", detalle: { nombre, plantilla: plantilla?.codigo ?? null } } })
    return protocolo
  })
}

/** Edita datos del protocolo y, si vienen, sincroniza sus ítems. */
export async function editarProtocolo(ctx: AuthContext, id: string, raw: unknown) {
  const v = edicionProtocoloSchema.parse(raw)
  const protocolo = await prisma.protocoloSanitario.findFirst({ where: { id, organizacionId: { in: ctx.organizacionIds } }, include: { items: { select: { id: true } } } })
  if (!protocolo) throw new SanidadError("Protocolo no encontrado", 404)
  if (!puedeEditarOrg(ctx, protocolo.organizacionId)) throw new SanidadError("Solo un administrador, encargado o veterinario puede editar protocolos", 403)
  if (v.items) {
    const actuales = new Set(protocolo.items.map((i) => i.id))
    if (v.items.some((i) => i.id && !actuales.has(i.id))) throw new SanidadError("Un ítem no pertenece al protocolo", 400)
    const productos = [...new Set(v.items.map((i) => i.productoId).filter((x): x is string => !!x))]
    if (productos.length) {
      const validos = await prisma.producto.count({ where: { id: { in: productos }, OR: [{ organizacionId: protocolo.organizacionId }, { organizacionId: null }] } })
      if (validos !== productos.length) throw new SanidadError("Un producto no es de la organización", 400)
    }
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const { items, ...datos } = v
      if (Object.keys(datos).length) await tx.protocoloSanitario.update({ where: { id }, data: datos })
      if (items) {
        const quedan = new Set(items.filter((i) => i.id).map((i) => i.id!))
        // Las tareas y eventos que apuntaban a un ítem borrado quedan sin vínculo (no se pierden)
        await tx.itemProtocolo.deleteMany({ where: { protocoloId: id, id: { notIn: [...quedan] } } })
        for (const [n, i] of items.entries()) {
          if (i.id) await tx.itemProtocolo.update({ where: { id: i.id }, data: datosItem(i as ItemPlan, n) })
          else await tx.itemProtocolo.create({ data: { ...datosItem(i as ItemPlan, n), protocoloId: id } })
        }
      }
      await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: protocolo.organizacionId, tabla: "protocolos_sanitarios", rowPk: id, accion: "UPDATE", detalle: { ...datos, items: items?.length ?? null } } })
      return tx.protocoloSanitario.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { orden: "asc" }, include: { producto: { select: { id: true, nombre: true } } } } } })
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new SanidadError("Ya hay un protocolo con ese nombre", 409)
    throw e
  }
}

/** Zona de aftosa del campo (admin o encargado del campo). */
export async function definirZonaAftosa(ctx: AuthContext, raw: unknown) {
  const v = zonaAftosaSchema.parse(raw)
  const org = orgDelCampo(ctx, v.establecimientoId)
  if (!ctx.establecimientoIdsConRol([...ROLES_GESTION]).includes(v.establecimientoId)) throw new SanidadError("Solo un administrador o encargado del campo puede definir la zona de aftosa", 403)
  return prisma.$transaction(async (tx) => {
    const antes = await tx.establecimiento.findUniqueOrThrow({ where: { id: v.establecimientoId }, select: { zonaAftosa: true } })
    const campo = await tx.establecimiento.update({ where: { id: v.establecimientoId }, data: { zonaAftosa: v.zonaAftosa }, select: { id: true, nombre: true, zonaAftosa: true } })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: org, tabla: "establecimientos", rowPk: v.establecimientoId, accion: "UPDATE", detalle: { zonaAftosa: { antes: antes.zonaAftosa, despues: v.zonaAftosa } } } })
    return campo
  })
}
