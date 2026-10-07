// Servicio de finanzas: cuentas (cajas, bancos, billeteras), movimientos de
// ingreso/egreso y transferencias entre cuentas. Todo se resuelve por campo y
// solo admin o encargado de la organización dueña del campo puede ver o
// registrar finanzas (vet y operario no acceden a montos del negocio).

import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"
import type { AuthContext } from "@/lib/api/with-auth"
import { logAudit } from "@/lib/api/audit-log"
import { prisma } from "@/lib/prisma"
import { erroresZod } from "@/lib/ganado/alta"
import { CATEGORIA_TRANSFERENCIA } from "./constantes"
import type {
  CuentaInput,
  FiltroMovimientos,
  MovimientoInput,
  MovimientoUpdateInput,
  TransferenciaInput,
} from "./validation"

export const ROLES_FINANZAS = ["admin", "encargado"] as const

export class FinanzasError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message)
  }
}

/** Traduce errores conocidos a `{ error }` con su status; nunca expone detalles internos. */
export async function finanzasHandler(accion: () => Promise<Response>): Promise<Response> {
  try {
    return await accion()
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errores = erroresZod(error)
      return NextResponse.json({ error: errores[0], errores }, { status: 400 })
    }
    if (error instanceof FinanzasError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return NextResponse.json({ error: "Ya existe una cuenta con ese nombre en este campo" }, { status: 409 })
      if (error.code === "P2003") return NextResponse.json({ error: "El registro vinculado no pertenece a este campo o ya no existe" }, { status: 400 })
      if (error.code === "P2025") return NextResponse.json({ error: "El registro ya no existe. Recargá la página." }, { status: 404 })
    }
    console.error("Error de finanzas:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "No se pudo completar la operación" }, { status: 500 })
  }
}

// ------------------------------------------------------------
// Alcance por campo
// ------------------------------------------------------------

/** Campos cuyas finanzas el usuario puede ver; si pide uno sin permiso, 403. */
export function camposLectura(ctx: AuthContext, establecimientoId?: string): string[] {
  const permitidos = ctx.establecimientoIdsConRol([...ROLES_FINANZAS])
  if (!establecimientoId) return permitidos
  if (!permitidos.includes(establecimientoId)) {
    throw new FinanzasError("No tenés permisos para ver las finanzas de este campo", 403)
  }
  return [establecimientoId]
}

/** El usuario debe ser admin o encargado en la organización dueña del campo. */
function exigirEscritura(ctx: AuthContext, establecimientoId: string) {
  if (!ctx.establecimientoIdsConRol([...ROLES_FINANZAS]).includes(establecimientoId)) {
    throw new FinanzasError("No tenés permisos para registrar finanzas en este campo", 403)
  }
}

const auditar = (
  ctx: AuthContext,
  establecimientoId: string,
  tabla: string,
  rowPk: string,
  accion: "INSERT" | "UPDATE" | "DELETE",
  detalle: Record<string, unknown>,
) =>
  logAudit({
    userId: ctx.userId,
    tabla,
    rowPk,
    accion,
    detalle: { establecimientoId, ...detalle },
    organizacionId: ctx.organizacionDeEstablecimiento[establecimientoId] ?? null,
  })

const fechaDb = (v: string) => new Date(`${v}T00:00:00Z`)
const fechaIso = (d: Date) => d.toISOString().slice(0, 10)
const num = (d: Prisma.Decimal | null | undefined) => (d == null ? 0 : Number(d.toString()))

// ------------------------------------------------------------
// Cuentas
// ------------------------------------------------------------

type CuentaDb = Prisma.CuentaFinancieraGetPayload<{}>

function serializarCuenta(c: CuentaDb, saldo: Prisma.Decimal, cantidadMovimientos: number) {
  return {
    ...c,
    saldoInicial: num(c.saldoInicial),
    saldo: num(saldo),
    cantidadMovimientos,
  }
}

/** Saldo = saldo inicial + ingresos − egresos (incluye transferencias). */
export async function saldosDeCuentas(cuentas: Pick<CuentaDb, "id" | "saldoInicial">[]) {
  const filas = cuentas.length
    ? await prisma.movimientoFinanciero.groupBy({
        by: ["cuentaId", "tipo"],
        where: { cuentaId: { in: cuentas.map((c) => c.id) } },
        _sum: { importe: true },
        _count: { _all: true },
      })
    : []
  const resultado = new Map<string, { saldo: Prisma.Decimal; movimientos: number }>()
  for (const c of cuentas) resultado.set(c.id, { saldo: new Prisma.Decimal(c.saldoInicial), movimientos: 0 })
  for (const f of filas) {
    const actual = resultado.get(f.cuentaId)
    if (!actual) continue
    const importe = f._sum.importe ?? new Prisma.Decimal(0)
    actual.saldo = f.tipo === "ingreso" ? actual.saldo.plus(importe) : actual.saldo.minus(importe)
    actual.movimientos += f._count._all
  }
  return resultado
}

export async function listarCuentas(ctx: AuthContext, establecimientoId?: string, incluirInactivas = true) {
  const campos = camposLectura(ctx, establecimientoId)
  const cuentas = await prisma.cuentaFinanciera.findMany({
    where: { establecimientoId: { in: campos }, ...(incluirInactivas ? {} : { activa: true }) },
    orderBy: [{ activa: "desc" }, { nombre: "asc" }],
  })
  const saldos = await saldosDeCuentas(cuentas)
  return cuentas.map((c) => {
    const s = saldos.get(c.id)!
    return serializarCuenta(c, s.saldo, s.movimientos)
  })
}

export async function crearCuenta(ctx: AuthContext, input: CuentaInput) {
  exigirEscritura(ctx, input.establecimientoId)
  const cuenta = await prisma.cuentaFinanciera.create({ data: input })
  await auditar(ctx, input.establecimientoId, "cuentas_financieras", cuenta.id, "INSERT", {
    nombre: cuenta.nombre,
    tipo: cuenta.tipo,
    moneda: cuenta.moneda,
    saldoInicial: input.saldoInicial,
  })
  return serializarCuenta(cuenta, new Prisma.Decimal(cuenta.saldoInicial), 0)
}

async function cuentaEditable(ctx: AuthContext, id: string) {
  const cuenta = await prisma.cuentaFinanciera.findFirst({
    where: { id, establecimientoId: { in: ctx.establecimientoIdsConRol([...ROLES_FINANZAS]) } },
  })
  if (!cuenta) throw new FinanzasError("Cuenta no encontrada", 404)
  return cuenta
}

export async function actualizarCuenta(ctx: AuthContext, id: string, input: Partial<Omit<CuentaInput, "establecimientoId">>) {
  const cuenta = await cuentaEditable(ctx, id)
  const movimientos = await prisma.movimientoFinanciero.count({ where: { cuentaId: id } })
  if (input.moneda && input.moneda !== cuenta.moneda && movimientos > 0) {
    throw new FinanzasError("No se puede cambiar la moneda de una cuenta con movimientos", 409)
  }
  const actualizada = await prisma.cuentaFinanciera.update({ where: { id }, data: input })
  await auditar(ctx, cuenta.establecimientoId, "cuentas_financieras", id, "UPDATE", { cambios: Object.keys(input) })
  const saldo = (await saldosDeCuentas([actualizada])).get(id)!
  return serializarCuenta(actualizada, saldo.saldo, saldo.movimientos)
}

/** Solo se borran cuentas sin movimientos; las demás se desactivan. */
export async function eliminarCuenta(ctx: AuthContext, id: string) {
  const cuenta = await cuentaEditable(ctx, id)
  const movimientos = await prisma.movimientoFinanciero.count({ where: { cuentaId: id } })
  if (movimientos > 0) {
    throw new FinanzasError("La cuenta tiene movimientos: desactivala en lugar de eliminarla", 409)
  }
  await prisma.cuentaFinanciera.delete({ where: { id } })
  await auditar(ctx, cuenta.establecimientoId, "cuentas_financieras", id, "DELETE", { nombre: cuenta.nombre })
}

// ------------------------------------------------------------
// Movimientos
// ------------------------------------------------------------

const includeMovimiento = {
  cuenta: { select: { id: true, nombre: true, moneda: true, tipo: true } },
  comprobante: { select: { id: true, titulo: true, referencia: true } },
  baja: { select: { id: true, animal: { select: { id: true, caravanaVisual: true } } } },
} satisfies Prisma.MovimientoFinancieroInclude

type MovimientoDb = Prisma.MovimientoFinancieroGetPayload<{ include: typeof includeMovimiento }>

function serializarMovimiento(m: MovimientoDb) {
  return { ...m, fecha: fechaIso(m.fecha), importe: num(m.importe), moneda: m.cuenta.moneda }
}

function whereMovimientos(campos: string[], f: FiltroMovimientos): Prisma.MovimientoFinancieroWhereInput {
  return {
    establecimientoId: { in: campos },
    ...(f.cuentaId ? { cuentaId: f.cuentaId } : {}),
    ...(f.tipo ? { tipo: f.tipo } : {}),
    ...(f.categoria ? { categoria: f.categoria } : {}),
    ...(f.desde || f.hasta
      ? { fecha: { ...(f.desde ? { gte: fechaDb(f.desde) } : {}), ...(f.hasta ? { lte: fechaDb(f.hasta) } : {}) } }
      : {}),
    ...(f.q
      ? {
          OR: [
            { descripcion: { contains: f.q, mode: "insensitive" as const } },
            { contraparte: { contains: f.q, mode: "insensitive" as const } },
            { notas: { contains: f.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }
}

export async function listarMovimientos(ctx: AuthContext, f: FiltroMovimientos) {
  const campos = camposLectura(ctx, f.establecimientoId)
  const where = whereMovimientos(campos, f)
  const [data, total, sumas] = await Promise.all([
    prisma.movimientoFinanciero.findMany({
      where,
      include: includeMovimiento,
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      take: f.limit,
      skip: (f.page - 1) * f.limit,
    }),
    prisma.movimientoFinanciero.count({ where }),
    // Totales del filtro sin transferencias (no son ingresos ni gastos reales)
    prisma.movimientoFinanciero.groupBy({
      by: ["cuentaId", "tipo"],
      where: { AND: [where, { categoria: { not: CATEGORIA_TRANSFERENCIA } }] },
      _sum: { importe: true },
    }),
  ])

  const monedas = new Map(
    (
      await prisma.cuentaFinanciera.findMany({
        where: { id: { in: [...new Set(sumas.map((s) => s.cuentaId))] } },
        select: { id: true, moneda: true },
      })
    ).map((c) => [c.id, c.moneda]),
  )
  const totales: Record<string, { ingresos: number; egresos: number; resultado: number }> = {}
  for (const s of sumas) {
    const moneda = monedas.get(s.cuentaId) ?? "ARS"
    const t = (totales[moneda] ??= { ingresos: 0, egresos: 0, resultado: 0 })
    if (s.tipo === "ingreso") t.ingresos += num(s._sum.importe)
    else t.egresos += num(s._sum.importe)
  }
  for (const t of Object.values(totales)) {
    t.ingresos = redondear(t.ingresos)
    t.egresos = redondear(t.egresos)
    t.resultado = redondear(t.ingresos - t.egresos)
  }

  return {
    data: data.map(serializarMovimiento),
    totales,
    pagination: { page: f.page, limit: f.limit, total, pages: Math.max(1, Math.ceil(total / f.limit)) },
  }
}

export const redondear = (n: number) => Math.round(n * 100) / 100

/** La cuenta debe ser del mismo campo y estar activa (salvo que ya fuera la del movimiento). */
async function validarCuenta(establecimientoId: string, cuentaId: string, cuentaActualId?: string) {
  const cuenta = await prisma.cuentaFinanciera.findFirst({ where: { id: cuentaId, establecimientoId } })
  if (!cuenta) throw new FinanzasError("La cuenta no pertenece a este campo", 400)
  if (!cuenta.activa && cuenta.id !== cuentaActualId) throw new FinanzasError(`La cuenta «${cuenta.nombre}» está desactivada`, 400)
  return cuenta
}

async function validarComprobante(establecimientoId: string, comprobanteId: string | null) {
  if (!comprobanteId) return
  const comprobante = await prisma.comprobante.findFirst({ where: { id: comprobanteId, establecimientoId }, select: { id: true } })
  if (!comprobante) throw new FinanzasError("El comprobante no pertenece a este campo", 400)
}

export async function crearMovimiento(ctx: AuthContext, input: MovimientoInput) {
  exigirEscritura(ctx, input.establecimientoId)
  await validarCuenta(input.establecimientoId, input.cuentaId)
  await validarComprobante(input.establecimientoId, input.comprobanteId)
  const movimiento = await prisma.movimientoFinanciero.create({
    data: { ...input, fecha: fechaDb(input.fecha), creadoPorId: ctx.userId },
    include: includeMovimiento,
  })
  await auditar(ctx, input.establecimientoId, "movimientos_financieros", movimiento.id, "INSERT", {
    tipo: input.tipo,
    categoria: input.categoria,
    importe: input.importe,
    cuentaId: input.cuentaId,
  })
  return serializarMovimiento(movimiento)
}

async function movimientoEditable(ctx: AuthContext, id: string) {
  const movimiento = await prisma.movimientoFinanciero.findFirst({
    where: { id, establecimientoId: { in: ctx.establecimientoIdsConRol([...ROLES_FINANZAS]) } },
  })
  if (!movimiento) throw new FinanzasError("Movimiento no encontrado", 404)
  return movimiento
}

export async function actualizarMovimiento(ctx: AuthContext, id: string, input: MovimientoUpdateInput) {
  const actual = await movimientoEditable(ctx, id)
  if (actual.transferenciaId) {
    throw new FinanzasError("Las transferencias no se editan: eliminala y registrala de nuevo", 409)
  }
  await validarCuenta(actual.establecimientoId, input.cuentaId, actual.cuentaId)
  await validarComprobante(actual.establecimientoId, input.comprobanteId)
  const movimiento = await prisma.movimientoFinanciero.update({
    where: { id },
    data: { ...input, fecha: fechaDb(input.fecha) },
    include: includeMovimiento,
  })
  await auditar(ctx, actual.establecimientoId, "movimientos_financieros", id, "UPDATE", {
    antes: { tipo: actual.tipo, categoria: actual.categoria, importe: actual.importe.toString(), cuentaId: actual.cuentaId },
    despues: { tipo: input.tipo, categoria: input.categoria, importe: input.importe, cuentaId: input.cuentaId },
  })
  return serializarMovimiento(movimiento)
}

/** Elimina el movimiento; si es parte de una transferencia, elimina las dos patas. */
export async function eliminarMovimiento(ctx: AuthContext, id: string) {
  const actual = await movimientoEditable(ctx, id)
  const { count } = await prisma.movimientoFinanciero.deleteMany({
    where: actual.transferenciaId
      ? { transferenciaId: actual.transferenciaId, establecimientoId: actual.establecimientoId }
      : { id },
  })
  await auditar(ctx, actual.establecimientoId, "movimientos_financieros", id, "DELETE", {
    tipo: actual.tipo,
    categoria: actual.categoria,
    importe: actual.importe.toString(),
    cuentaId: actual.cuentaId,
    transferenciaId: actual.transferenciaId,
    bajaId: actual.bajaId,
  })
  return { eliminados: count }
}

// ------------------------------------------------------------
// Transferencias entre cuentas
// ------------------------------------------------------------

export async function registrarTransferencia(ctx: AuthContext, input: TransferenciaInput) {
  exigirEscritura(ctx, input.establecimientoId)
  const [origen, destino] = await Promise.all([
    validarCuenta(input.establecimientoId, input.cuentaOrigenId),
    validarCuenta(input.establecimientoId, input.cuentaDestinoId),
  ])
  let importeDestino = input.importe
  if (origen.moneda !== destino.moneda) {
    if (!input.importeDestino) {
      throw new FinanzasError(`Las cuentas tienen monedas distintas: indicá cuánto ingresa en ${destino.moneda}`, 400)
    }
    importeDestino = input.importeDestino
  } else if (input.importeDestino && Number(input.importeDestino) !== Number(input.importe)) {
    throw new FinanzasError("Entre cuentas de la misma moneda el importe que sale y el que entra deben ser iguales", 400)
  }

  const transferenciaId = randomUUID()
  const descripcion = input.descripcion ?? `Transferencia ${origen.nombre} → ${destino.nombre}`
  const comun = {
    establecimientoId: input.establecimientoId,
    categoria: CATEGORIA_TRANSFERENCIA,
    fecha: fechaDb(input.fecha),
    descripcion,
    notas: input.notas,
    transferenciaId,
    creadoPorId: ctx.userId,
  }
  await prisma.movimientoFinanciero.createMany({
    data: [
      { ...comun, cuentaId: origen.id, tipo: "egreso", importe: input.importe },
      { ...comun, cuentaId: destino.id, tipo: "ingreso", importe: importeDestino },
    ],
  })
  await auditar(ctx, input.establecimientoId, "movimientos_financieros", transferenciaId, "INSERT", {
    transferencia: true,
    origen: origen.id,
    destino: destino.id,
    importe: input.importe,
    importeDestino,
  })
  return { transferenciaId, origen: origen.nombre, destino: destino.nombre, importe: input.importe, importeDestino }
}
