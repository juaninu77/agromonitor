// Registro y consultas de Sanidad. Un único camino para la página de Sanidad, la ficha
// del animal y el registro rápido de Ganado:
// - Registran admin, encargado o vet del campo del animal o del grupo (rol por organización).
// - El animal o el grupo deben estar activos y la fecha no puede ser futura.
// - El producto es de la organización del campo (o del catálogo general, sin stock).
// - El evento, el descuento de stock y la auditoría van en una misma transacción.

import { Prisma } from "@prisma/client"
import { z } from "zod"
import { descontarAplicacion } from "@/lib/inventario/aplicaciones"
import { hoyArgentina } from "@/lib/inventario/fechas"
import { InventarioError } from "@/lib/inventario/service"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { filtrosSanidadSchema, registroSanitarioSchema, resumenSanidadSchema, ROLES_SANIDAD } from "./validation"

export class SanidadError extends Error { constructor(message: string, public status = 400, public codigo?: string) { super(message) } }

/** Día calendario AAAA-MM-DD como fecha @db.Date (medianoche UTC). */
const fechaDia = (dia: string) => new Date(`${dia}T00:00:00Z`)

/** Eventos de un conjunto de campos (individuales o por grupo). */
const scopeCampos = (ids: string[]): Prisma.EvtSanidadWhereInput => ({
  OR: [{ animal: { establecimientoId: { in: ids } } }, { lote: { establecimientoId: { in: ids } } }],
})

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
    const evento = await tx.evtSanidad.create({
      data: {
        fecha: fechaDia(v.fecha), dosis: v.dosis, unidad: v.unidad, via: v.via, motivo: v.motivo, carenciaDias: v.carenciaDias,
        aplicador: v.aplicador, veterinario: v.veterinario, costo: v.costo, observ: v.observ,
        animalId: v.animalId, loteId: v.loteId, cantidadAnimales: v.loteId ? v.cantidadAnimales : null,
        productoId: v.productoId, loteProductoId: v.loteProductoId,
      },
      include: includeEvento,
    })
    const stock = v.descontarStock == null ? null : await descontarAplicacion(tx, {
      productoId: v.productoId, cantidad: v.descontarStock, loteProductoId: v.loteProductoId, sectorId: v.sectorStockId,
      fecha: new Date(`${v.fecha}T12:00:00-03:00`), motivo: `Aplicación sanitaria · ${etiqueta}`,
      origenTipo: "sanidad", origenId: evento.id,
    }, { establecimientoIds: ctx.establecimientoIds, establecimientoId, estricto: true, aceptarVencido: v.aceptarVencido })
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
  const base = scopeCampos(camposConsulta(ctx, p.establecimientoId))
  const mesActual = hoyArgentina().slice(0, 7)
  const delMes: Prisma.EvtSanidadWhereInput = { AND: [base, { fecha: rangoMes(mesActual) }] }
  const [tratamientos, curativos, individuales, porGrupo, top, dias] = await Promise.all([
    prisma.evtSanidad.count({ where: delMes }),
    prisma.evtSanidad.count({ where: { AND: [delMes, { motivo: "curativo" }] } }),
    prisma.evtSanidad.groupBy({ by: ["animalId"], where: { AND: [delMes, { animalId: { not: null } }] } }),
    prisma.evtSanidad.aggregate({ where: { AND: [delMes, { loteId: { not: null } }] }, _sum: { cantidadAnimales: true } }),
    prisma.evtSanidad.groupBy({ by: ["productoId"], where: delMes, _count: { _all: true }, orderBy: { _count: { productoId: "desc" } }, take: 3 }),
    prisma.evtSanidad.groupBy({ by: ["fecha"], where: { AND: [base, { fecha: rangoMes(p.mes ?? mesActual) }] }, _count: { _all: true } }),
  ])
  const nombres = top.length ? await prisma.producto.findMany({ where: { id: { in: top.map((t) => t.productoId) } }, select: { id: true, nombre: true } }) : []
  return {
    mes: mesActual,
    tratamientosMes: tratamientos,
    curativosMes: curativos,
    // Animales distintos tratados de a uno + los declarados en aplicaciones por grupo
    animalesTratadosMes: individuales.length + (porGrupo._sum.cantidadAnimales ?? 0),
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
  const where: Prisma.EvtSanidadWhereInput = { animalId: { not: null }, animal: { establecimientoId: { in: camposConsulta(ctx, p.establecimientoId) } } }
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
