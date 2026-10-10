// Registro y consultas de Sanidad. Un único camino para la página de Sanidad, la ficha
// del animal y el registro rápido de Ganado:
// - Registran admin, encargado o vet del campo del animal o del grupo (rol por organización).
// - El animal o el grupo deben estar activos y la fecha no puede ser futura.
// - El producto es de la organización del campo (o del catálogo general, sin stock).
// - El evento, el descuento de stock y la auditoría van en una misma transacción.

import { Prisma } from "@prisma/client"
import { z } from "zod"
import { randomUUID } from "node:crypto"
import { descontarAplicacion, revertirAplicaciones } from "@/lib/inventario/aplicaciones"
import { hoyArgentina } from "@/lib/inventario/fechas"
import { InventarioError } from "@/lib/inventario/service"
import { retirosVigentes } from "./retiro"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import {
  anulacionSanitariaSchema, aplicacionMasivaSchema, destinoMasivoSchema, edicionSanitariaSchema, filtrosSanidadSchema,
  registroSanitarioSchema, resumenSanidadSchema, ROLES_SANIDAD, type DestinoMasivo,
} from "./validation"

export class SanidadError extends Error { constructor(message: string, public status = 400, public codigo?: string) { super(message) } }

/** Día calendario AAAA-MM-DD como fecha @db.Date (medianoche UTC). */
const fechaDia = (dia: string) => new Date(`${dia}T00:00:00Z`)

/** Eventos de un conjunto de campos (individuales o por grupo). */
const scopeCampos = (ids: string[]): Prisma.EvtSanidadWhereInput => ({
  OR: [{ animal: { establecimientoId: { in: ids } } }, { lote: { establecimientoId: { in: ids } } }],
})
/** Eventos vigentes (los anulados no cuentan en indicadores ni historial por defecto). */
const vigentes: Prisma.EvtSanidadWhereInput = { anuladoAt: null }
const ROLES_GESTION = ["admin", "encargado"] as const

type Tx = Prisma.TransactionClient

/**
 * Costo de lo descontado en pesos: cada lote por su costo, y lo que salió sin lote (o de
 * un lote sin costo) por el costo de referencia del producto. Si alguna parte no tiene
 * costo en ARS no se calcula (no se mezclan monedas ni se inventan precios).
 */
export async function costoAplicacion(tx: Tx, productoId: string, lotes: { loteProductoId: string | null; cantidad: number }[]) {
  if (!lotes.length) return null
  const producto = await tx.producto.findUnique({ where: { id: productoId }, select: { costoReferencia: true, monedaCosto: true } })
  const ids = lotes.map((l) => l.loteProductoId).filter((x): x is string => !!x)
  const costos = ids.length ? await tx.loteProducto.findMany({ where: { id: { in: ids } }, select: { id: true, costo: true, moneda: true } }) : []
  let total = new Prisma.Decimal(0)
  for (const l of lotes) {
    const lote = costos.find((c) => c.id === l.loteProductoId)
    const [costo, moneda] = lote?.costo != null ? [lote.costo, lote.moneda] : [producto?.costoReferencia ?? null, producto?.monedaCosto ?? "ARS"]
    if (costo == null || moneda !== "ARS") return null
    total = total.plus(costo.times(l.cantidad))
  }
  return total.toDecimalPlaces(2).toNumber()
}

/** Campo de un evento (del animal o del grupo). */
const campoDe = (e: { animal: { establecimientoId: string | null } | null; lote: { establecimientoId: string } | null }) => e.animal?.establecimientoId ?? e.lote?.establecimientoId ?? null

/** Campo pedido (debe ser del usuario) o todos los suyos. */
function camposConsulta(ctx: AuthContext, establecimientoId?: string) {
  if (!establecimientoId) return ctx.establecimientoIds
  if (!ctx.establecimientoIds.includes(establecimientoId)) throw new SanidadError("Campo no encontrado", 404)
  return [establecimientoId]
}

const includeEvento = {
  animal: { select: { id: true, caravanaVisual: true, cuig: true, otroId: true, sexo: true, categoria: { select: { nombre: true } } } },
  producto: { select: { id: true, nombre: true, tipo: true, unidad: true, retiroDias: true } },
  loteProducto: { select: { id: true, nroLote: true, vencimiento: true } },
  lote: { select: { id: true, nombre: true } },
} satisfies Prisma.EvtSanidadInclude

type EventoDb = Prisma.EvtSanidadGetPayload<{ include: typeof includeEvento }>
const serializar = (e: EventoDb) => ({ ...e, fecha: e.fecha.toISOString().slice(0, 10), costo: e.costo == null ? null : Number(e.costo) })

export async function registrarSanidad(ctx: AuthContext, raw: unknown) {
  const v = registroSanitarioSchema.parse(raw)
  const campos = ctx.establecimientoIdsConRol([...ROLES_SANIDAD])
  const sinPermiso = () => new SanidadError("Solo un administrador, encargado o veterinario del campo puede registrar sanidad", 403)

  // Destino: animal o grupo activo, en un campo donde el usuario tiene rol sanitario
  let establecimientoId: string
  let etiqueta: string
  if (v.animalId) {
    const animal = await prisma.animal.findFirst({ where: { id: v.animalId, establecimientoId: { in: ctx.establecimientoIds } }, select: { id: true, caravanaVisual: true, estadoVital: true, establecimientoId: true } })
    if (!animal?.establecimientoId) throw new SanidadError("Animal no encontrado", 404)
    if (!campos.includes(animal.establecimientoId)) throw sinPermiso()
    if (animal.estadoVital !== "activo") throw new SanidadError("No se pueden registrar tratamientos de un animal dado de baja", 400)
    establecimientoId = animal.establecimientoId
    etiqueta = animal.caravanaVisual ?? "animal"
  } else {
    const lote = await prisma.lote.findFirst({ where: { id: v.loteId!, establecimientoId: { in: ctx.establecimientoIds } }, select: { id: true, nombre: true, activo: true, establecimientoId: true } })
    if (!lote) throw new SanidadError("Grupo no encontrado", 404)
    if (!campos.includes(lote.establecimientoId)) throw sinPermiso()
    if (!lote.activo) throw new SanidadError("El grupo está inactivo", 400)
    establecimientoId = lote.establecimientoId
    etiqueta = `grupo ${lote.nombre}`
  }
  const organizacionId = ctx.organizacionDeEstablecimiento[establecimientoId]

  // Producto de la organización del campo, o del catálogo general (sin stock)
  const producto = await prisma.producto.findFirst({ where: { id: v.productoId, OR: [{ organizacionId }, { organizacionId: null }] }, select: { id: true, activo: true, organizacionId: true } })
  if (!producto) throw new SanidadError("Producto no encontrado en la organización del campo", 404)
  if (v.descontarStock != null) {
    if (!producto.organizacionId) throw new SanidadError("Es un producto del catálogo general: no tiene stock para descontar", 400)
    if (!producto.activo) throw new SanidadError("El producto está archivado: no se puede descontar stock", 400)
  }
  if (v.loteProductoId && !await prisma.loteProducto.findFirst({ where: { id: v.loteProductoId, productoId: v.productoId }, select: { id: true } })) {
    throw new SanidadError("El lote no pertenece al producto", 400)
  }

  return prisma.$transaction(async (tx) => {
    // El id se fija antes para que la salida de stock quede vinculada al evento
    const id = randomUUID()
    const stock = v.descontarStock == null ? null : await descontarAplicacion(tx, {
      productoId: v.productoId, cantidad: v.descontarStock, loteProductoId: v.loteProductoId, sectorId: v.sectorStockId,
      fecha: new Date(`${v.fecha}T12:00:00-03:00`), motivo: `Aplicación sanitaria · ${etiqueta}`,
      origenTipo: "sanidad", origenId: id,
    }, { establecimientoIds: ctx.establecimientoIds, establecimientoId, estricto: true, aceptarVencido: v.aceptarVencido })
    // Costo: el cargado a mano, o el de lo que salió del stock
    const costo = v.costo ?? (stock ? await costoAplicacion(tx, v.productoId, stock.lotes) : null)
    const evento = await tx.evtSanidad.create({
      data: {
        id, fecha: fechaDia(v.fecha), dosis: v.dosis, unidad: v.unidad, via: v.via, motivo: v.motivo, carenciaDias: v.carenciaDias,
        aplicador: v.aplicador, veterinario: v.veterinario, costo, observ: v.observ,
        animalId: v.animalId, loteId: v.loteId, cantidadAnimales: v.loteId ? v.cantidadAnimales : null,
        productoId: v.productoId, loteProductoId: v.loteProductoId ?? (stock?.lotes.length === 1 ? stock.lotes[0].loteProductoId : null),
      },
      include: includeEvento,
    })
    await tx.auditLog.create({
      data: {
        usuarioId: ctx.userId, organizacionId, tabla: "evt_sanidad", rowPk: evento.id, accion: "INSERT",
        detalle: { animalId: v.animalId, loteId: v.loteId, productoId: v.productoId, fecha: v.fecha, motivo: v.motivo, descontado: stock?.descontado ?? null },
      },
    })
    return { ...serializar(evento), stock }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 })
}

/** Historial filtrado y paginado en el servidor. */
export async function listarSanidad(ctx: AuthContext, raw: unknown) {
  const f = filtrosSanidadSchema.parse(raw)
  const and: Prisma.EvtSanidadWhereInput[] = [scopeCampos(camposConsulta(ctx, f.establecimientoId))]
  if (f.anulados !== "1") and.push(vigentes)
  if (f.especie) and.push({ animal: { especie: { nombre: { equals: f.especie, mode: "insensitive" } } } })
  if (f.q) {
    const c = { contains: f.q, mode: "insensitive" as const }
    and.push({ OR: [
      { animal: { caravanaVisual: c } }, { animal: { cuig: c } }, { animal: { otroId: c } }, { animal: { caravanaRfid: c } },
      { producto: { nombre: c } }, { lote: { nombre: c } },
    ] })
  }
  if (f.motivo) and.push({ motivo: f.motivo })
  if (f.productoId) and.push({ productoId: f.productoId })
  if (f.loteId) and.push({ loteId: f.loteId })
  if (f.animalId) and.push({ animalId: f.animalId })
  if (f.desde || f.hasta) and.push({ fecha: { ...(f.desde ? { gte: fechaDia(f.desde) } : {}), ...(f.hasta ? { lte: fechaDia(f.hasta) } : {}) } })
  const where: Prisma.EvtSanidadWhereInput = { AND: and }
  const [eventos, total] = await Promise.all([
    prisma.evtSanidad.findMany({ where, include: includeEvento, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], skip: (f.page - 1) * f.limit, take: f.limit }),
    prisma.evtSanidad.count({ where }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / f.limit))
  return { data: eventos.map(serializar), pagination: { page: f.page, limit: f.limit, total, totalPages, hasNextPage: f.page < totalPages, hasPrevPage: f.page > 1 } }
}

/** Límites [desde, hasta) de un mes AAAA-MM como fechas @db.Date. */
function rangoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number)
  const sig = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`
  return { gte: fechaDia(`${mes}-01`), lt: fechaDia(`${sig}-01`) }
}

/**
 * Indicadores del mes actual (Argentina) y tratamientos por día del mes pedido para el
 * calendario, agregados en la base (sin descargar el historial).
 */
export async function resumenSanidad(ctx: AuthContext, raw: unknown) {
  const p = resumenSanidadSchema.parse(raw)
  const campos = camposConsulta(ctx, p.establecimientoId)
  const base: Prisma.EvtSanidadWhereInput = { AND: [scopeCampos(campos), vigentes] }
  const mesActual = hoyArgentina().slice(0, 7)
  const delMes: Prisma.EvtSanidadWhereInput = { AND: [base, { fecha: rangoMes(mesActual) }] }
  const [tratamientos, curativos, individuales, porGrupo, top, dias, retiros] = await Promise.all([
    prisma.evtSanidad.count({ where: delMes }),
    prisma.evtSanidad.count({ where: { AND: [delMes, { motivo: "curativo" }] } }),
    prisma.evtSanidad.groupBy({ by: ["animalId"], where: { AND: [delMes, { animalId: { not: null } }] } }),
    prisma.evtSanidad.aggregate({ where: { AND: [delMes, { loteId: { not: null } }] }, _sum: { cantidadAnimales: true } }),
    prisma.evtSanidad.groupBy({ by: ["productoId"], where: delMes, _count: { _all: true }, orderBy: { _count: { productoId: "desc" } }, take: 3 }),
    prisma.evtSanidad.groupBy({ by: ["fecha"], where: { AND: [base, { fecha: rangoMes(p.mes ?? mesActual) }] }, _count: { _all: true } }),
    retirosVigentes(prisma, { establecimientoIds: campos }),
  ])
  const nombres = top.length ? await prisma.producto.findMany({ where: { id: { in: top.map((t) => t.productoId) } }, select: { id: true, nombre: true } }) : []
  return {
    mes: mesActual,
    tratamientosMes: tratamientos,
    curativosMes: curativos,
    // Animales distintos tratados de a uno + los declarados en aplicaciones por grupo
    animalesTratadosMes: individuales.length + (porGrupo._sum.cantidadAnimales ?? 0),
    animalesBajoRetiro: retiros.size,
    topProductos: top.map((t) => ({ productoId: t.productoId, nombre: nombres.find((n) => n.id === t.productoId)?.nombre ?? "—", cantidad: t._count._all })),
    calendario: { mes: p.mes ?? mesActual, dias: dias.map((d) => ({ dia: d.fecha.toISOString().slice(0, 10), cantidad: d._count._all })) },
  }
}

const porAnimalSchema = z.object({
  establecimientoId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

/** Animales con tratamientos individuales: cantidad y última fecha, paginado en la base. */
export async function sanidadPorAnimal(ctx: AuthContext, raw: unknown) {
  const p = porAnimalSchema.parse(raw)
  const where: Prisma.EvtSanidadWhereInput = { animalId: { not: null }, anuladoAt: null, animal: { establecimientoId: { in: camposConsulta(ctx, p.establecimientoId) } } }
  const [grupos, total] = await Promise.all([
    prisma.evtSanidad.groupBy({
      by: ["animalId"], where, _count: { _all: true }, _max: { fecha: true },
      orderBy: [{ _max: { fecha: "desc" } }, { animalId: "asc" }], skip: (p.page - 1) * p.limit, take: p.limit,
    }),
    prisma.evtSanidad.groupBy({ by: ["animalId"], where }).then((g) => g.length),
  ])
  const animales = grupos.length ? await prisma.animal.findMany({ where: { id: { in: grupos.map((g) => g.animalId!) } }, select: { id: true, caravanaVisual: true, cuig: true, otroId: true } }) : []
  const totalPages = Math.max(1, Math.ceil(total / p.limit))
  return {
    data: grupos.map((g) => ({
      animal: animales.find((a) => a.id === g.animalId) ?? { id: g.animalId!, caravanaVisual: null, cuig: null, otroId: null },
      cantidad: g._count._all,
      ultimaFecha: g._max.fecha?.toISOString().slice(0, 10) ?? null,
    })),
    pagination: { page: p.page, limit: p.limit, total, totalPages },
  }
}

/** Animales activos del campo bajo retiro, ordenados por fecha de liberación. */
export async function animalesBajoRetiro(ctx: AuthContext, raw: unknown) {
  const p = z.object({ establecimientoId: z.string().uuid() }).parse(raw)
  const retiros = [...(await retirosVigentes(prisma, { establecimientoIds: camposConsulta(ctx, p.establecimientoId) })).values()]
  const animales = retiros.length
    ? await prisma.animal.findMany({ where: { id: { in: retiros.map((r) => r.animalId) } }, select: { id: true, caravanaVisual: true, cuig: true, otroId: true, especie: { select: { nombre: true } }, categoria: { select: { nombre: true } } } })
    : []
  return retiros
    .map((r) => {
      const a = animales.find((x) => x.id === r.animalId)
      return { ...r, animal: { id: r.animalId, caravanaVisual: a?.caravanaVisual ?? null, cuig: a?.cuig ?? null, otroId: a?.otroId ?? null, especie: a?.especie?.nombre ?? null, categoria: a?.categoria?.nombre ?? null } }
    })
    .sort((x, y) => x.hasta.localeCompare(y.hasta))
}

// ---------------------------------------------------------------------------
// Aplicación masiva
// ---------------------------------------------------------------------------

const MAX_ANIMALES_MASIVA = 20_000

/** Animales activos del campo que cumplen todos los filtros del destino. */
async function animalesDestino(db: Tx | typeof prisma, d: DestinoMasivo) {
  return db.animal.findMany({
    where: {
      establecimientoId: d.establecimientoId,
      estadoVital: "activo",
      ...(d.especie ? { especie: { nombre: { equals: d.especie, mode: "insensitive" } } } : {}),
      ...(d.categoriaId ? { categoriaId: d.categoriaId } : {}),
      ...(d.loteId ? { loteHist: { some: { loteId: d.loteId, hasta: null } } } : {}),
      ...(d.sectorId ? { ubicacionHist: { some: { sectorId: d.sectorId, hasta: null } } } : {}),
    },
    select: { id: true },
    orderBy: { id: "asc" },
    take: MAX_ANIMALES_MASIVA + 1,
  })
}

/** El destino debe ser de un campo del usuario (con rol sanitario para registrar) y sus filtros, de ese campo. */
async function validarDestino(ctx: AuthContext, d: DestinoMasivo, registrar: boolean) {
  if (!ctx.establecimientoIds.includes(d.establecimientoId)) throw new SanidadError("Campo no encontrado", 404)
  if (registrar && !ctx.establecimientoIdsConRol([...ROLES_SANIDAD]).includes(d.establecimientoId)) {
    throw new SanidadError("Solo un administrador, encargado o veterinario del campo puede registrar sanidad", 403)
  }
  if (d.loteId && !await prisma.lote.findFirst({ where: { id: d.loteId, establecimientoId: d.establecimientoId }, select: { id: true } })) throw new SanidadError("Grupo no encontrado en el campo", 404)
  if (d.sectorId && !await prisma.sector.findFirst({ where: { id: d.sectorId, establecimientoId: d.establecimientoId }, select: { id: true } })) throw new SanidadError("Potrero no encontrado en el campo", 404)
}

/** Cuántos animales recibiría una aplicación masiva con ese destino (vista previa). */
export async function contarDestino(ctx: AuthContext, raw: unknown) {
  const d = destinoMasivoSchema.parse(raw)
  await validarDestino(ctx, d, false)
  const animales = await animalesDestino(prisma, d)
  return { cantidad: Math.min(animales.length, MAX_ANIMALES_MASIVA), excede: animales.length > MAX_ANIMALES_MASIVA }
}

/**
 * Aplicación masiva en una sola operación: un evento por animal (comparten operacionId =
 * clave) y un único descuento de stock por el total. Todo o nada; un reintento con la
 * misma clave devuelve lo ya registrado.
 */
export async function aplicarMasivo(ctx: AuthContext, raw: unknown) {
  const v = aplicacionMasivaSchema.parse(raw)
  const d = v.destino
  await validarDestino(ctx, d, true)
  const previos = await prisma.evtSanidad.count({ where: { operacionId: v.clave } })
  if (previos) return { operacionId: v.clave, cantidad: previos, stock: null, repetido: true }

  const animales = await animalesDestino(prisma, d)
  if (!animales.length) throw new SanidadError("No hay animales activos que cumplan esos filtros", 400)
  if (animales.length > MAX_ANIMALES_MASIVA) throw new SanidadError(`Son más de ${MAX_ANIMALES_MASIVA.toLocaleString("es-AR")} animales: aplicalo por grupo o potrero`, 400)
  if (animales.length !== v.animalesEsperados) {
    throw new SanidadError(`Ahora son ${animales.length} animales (antes ${v.animalesEsperados}): revisá y confirmá de nuevo`, 409, "destino_cambio")
  }
  const organizacionId = ctx.organizacionDeEstablecimiento[d.establecimientoId]
  const producto = await prisma.producto.findFirst({ where: { id: v.productoId, OR: [{ organizacionId }, { organizacionId: null }] }, select: { id: true, activo: true, organizacionId: true } })
  if (!producto) throw new SanidadError("Producto no encontrado en la organización del campo", 404)
  if (v.descontarPorAnimal != null) {
    if (!producto.organizacionId) throw new SanidadError("Es un producto del catálogo general: no tiene stock para descontar", 400)
    if (!producto.activo) throw new SanidadError("El producto está archivado: no se puede descontar stock", 400)
  }
  if (v.loteProductoId && !await prisma.loteProducto.findFirst({ where: { id: v.loteProductoId, productoId: v.productoId }, select: { id: true } })) {
    throw new SanidadError("El lote no pertenece al producto", 400)
  }
  const n = animales.length

  return prisma.$transaction(async (tx) => {
    const stock = v.descontarPorAnimal == null ? null : await descontarAplicacion(tx, {
      productoId: v.productoId, cantidad: new Prisma.Decimal(v.descontarPorAnimal).times(n).toDecimalPlaces(3).toNumber(),
      loteProductoId: v.loteProductoId, sectorId: v.sectorStockId, fecha: new Date(`${v.fecha}T12:00:00-03:00`),
      motivo: `Aplicación sanitaria masiva · ${n} animales`, origenTipo: "sanidad", origenId: v.clave,
    }, { establecimientoIds: ctx.establecimientoIds, establecimientoId: d.establecimientoId, estricto: true, aceptarVencido: v.aceptarVencido })
    const costoTotal = stock ? await costoAplicacion(tx, v.productoId, stock.lotes) : null
    const loteProductoId = v.loteProductoId ?? (stock?.lotes.length === 1 ? stock.lotes[0].loteProductoId : null)
    await tx.evtSanidad.createMany({
      data: animales.map((a) => ({
        animalId: a.id, operacionId: v.clave, fecha: fechaDia(v.fecha), dosis: v.dosis, unidad: v.unidad, via: v.via, motivo: v.motivo,
        carenciaDias: v.carenciaDias, veterinario: v.veterinario, aplicador: v.aplicador, observ: v.observ,
        costo: costoTotal == null ? null : Math.round((costoTotal / n) * 100) / 100,
        productoId: v.productoId, loteProductoId,
      })),
    })
    await tx.auditLog.create({
      data: {
        usuarioId: ctx.userId, organizacionId, tabla: "evt_sanidad", rowPk: v.clave, accion: "INSERT",
        detalle: { masiva: true, animales: n, destino: d, productoId: v.productoId, fecha: v.fecha, descontado: stock?.descontado ?? null },
      },
    })
    return { operacionId: v.clave, cantidad: n, stock, repetido: false }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 })
}

// ---------------------------------------------------------------------------
// Anular y editar
// ---------------------------------------------------------------------------

async function eventoEditable(id: string, campos: string[]) {
  const evento = await prisma.evtSanidad.findFirst({
    where: { id, ...scopeCampos(campos) },
    include: { animal: { select: { establecimientoId: true } }, lote: { select: { establecimientoId: true } } },
  })
  return evento
}

/**
 * Anula un tratamiento (no se borra): queda con fecha, usuario y motivo, y lo descontado
 * vuelve al stock. Un tratamiento de una aplicación masiva anula toda la aplicación.
 * Solo administrador o encargado del campo.
 */
export async function anularSanidad(ctx: AuthContext, id: string, raw: unknown) {
  const { motivo } = anulacionSanitariaSchema.parse(raw)
  const evento = await eventoEditable(id, ctx.establecimientoIds)
  if (!evento) throw new SanidadError("Tratamiento no encontrado", 404)
  const campo = campoDe(evento)
  if (!campo || !ctx.establecimientoIdsConRol([...ROLES_GESTION]).includes(campo)) throw new SanidadError("Solo un administrador o encargado del campo puede anular tratamientos", 403)
  if (evento.anuladoAt) throw new SanidadError("El tratamiento ya está anulado", 409)

  return prisma.$transaction(async (tx) => {
    const ids = evento.operacionId
      ? (await tx.evtSanidad.findMany({ where: { operacionId: evento.operacionId, anuladoAt: null }, select: { id: true } })).map((e) => e.id)
      : [evento.id]
    const { count } = await tx.evtSanidad.updateMany({ where: { id: { in: ids }, anuladoAt: null }, data: { anuladoAt: new Date(), anuladoPorId: ctx.userId, motivoAnulacion: motivo } })
    if (count !== ids.length) throw new SanidadError("Otro usuario modificó el tratamiento al mismo tiempo. Reintentá.", 409)
    const stock = await revertirAplicaciones(tx, evento.operacionId ? [evento.operacionId] : [evento.id], motivo)
    await tx.auditLog.create({
      data: {
        usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[campo], tabla: "evt_sanidad", rowPk: evento.id, accion: "UPDATE",
        detalle: { anulado: true, motivo, eventos: ids.length, operacionId: evento.operacionId, stockDevuelto: stock.revertido },
      },
    })
    return { anulados: ids.length, masiva: !!evento.operacionId, stockDevuelto: stock.revertido }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 })
}

/** Edita datos no críticos (observaciones, veterinario, aplicador, vía, motivo). */
export async function editarSanidad(ctx: AuthContext, id: string, raw: unknown) {
  const v = edicionSanitariaSchema.parse(raw)
  const evento = await eventoEditable(id, ctx.establecimientoIds)
  if (!evento) throw new SanidadError("Tratamiento no encontrado", 404)
  const campo = campoDe(evento)
  if (!campo || !ctx.establecimientoIdsConRol([...ROLES_SANIDAD]).includes(campo)) throw new SanidadError("Solo un administrador, encargado o veterinario del campo puede editar tratamientos", 403)
  if (evento.anuladoAt) throw new SanidadError("Un tratamiento anulado no se edita", 409)
  const data = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) as Prisma.EvtSanidadUpdateInput
  const antes = Object.fromEntries(Object.keys(data).map((k) => [k, (evento as Record<string, unknown>)[k] ?? null]))
  const actualizado = await prisma.$transaction(async (tx) => {
    const e = await tx.evtSanidad.update({ where: { id }, data, include: includeEvento })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[campo], tabla: "evt_sanidad", rowPk: id, accion: "UPDATE", detalle: JSON.parse(JSON.stringify({ antes, despues: data })) } })
    return e
  })
  return serializar(actualizado)
}

/** Respuesta de error uniforme para las rutas de Sanidad. */
export function errorSanidad(error: unknown) {
  if (error instanceof SanidadError || error instanceof InventarioError) {
    return { body: { success: false, error: error.message, codigo: error.codigo ?? (error instanceof InventarioError ? "stock" : undefined) }, status: error.status }
  }
  if (error instanceof z.ZodError) return { body: { success: false, error: error.issues[0]?.message ?? "Datos inválidos", errores: error.issues.map((i) => i.message) }, status: 400 }
  if (error instanceof SyntaxError) return { body: { success: false, error: "Datos inválidos" }, status: 400 }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return { body: { success: false, error: "Otro movimiento se registró al mismo tiempo. Reintentá." }, status: 409 }
  return null
}
