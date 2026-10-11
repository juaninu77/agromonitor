// Calendario sanitario (spec 02 §2.7): un protocolo aplicado a un campo (o grupo) por un
// año genera las tareas sanitarias con fecha. Registrar la aplicación desde una tarea la
// deja completada y vinculada (evento ↔ tarea ↔ ítem del protocolo).

import { Prisma } from "@prisma/client"
import { hoyArgentina } from "@/lib/inventario/fechas"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { calendarioSchema, type ItemPlan, type ZonaAftosa, ETIQUETA_ZONA } from "./plan"
import { proyectarItems } from "./proyeccion"
import { ROLES_SANIDAD } from "./validation"
import { SanidadError } from "./errores"

type Tx = Prisma.TransactionClient
const fechaDia = (d: string) => new Date(`${d}T00:00:00Z`)
/** Una tarea vence al terminar su día (mediodía de Argentina como referencia del día). */
const fechaTarea = (d: string) => new Date(`${d}T12:00:00-03:00`)
const diaDe = (d: Date) => hoyArgentina(d)

function campoSanitario(ctx: AuthContext, establecimientoId: string) {
  if (!ctx.establecimientoIds.includes(establecimientoId)) throw new SanidadError("Campo no encontrado", 404)
  if (!ctx.establecimientoIdsConRol([...ROLES_SANIDAD]).includes(establecimientoId)) throw new SanidadError("Solo un administrador, encargado o veterinario del campo puede gestionar el calendario sanitario", 403)
}

/** Texto de la tarea: a quiénes, producto, dosis y notas del ítem. */
function descripcionTarea(i: { destinatarios: string | null; productoTipo: string | null; dosis: number | null; unidad: string | null; via: string | null; notas: string | null; producto?: { nombre: string } | null }, grupo: string | null) {
  return [
    grupo ? `Grupo: ${grupo}` : null,
    i.destinatarios ? `A quiénes: ${i.destinatarios}` : null,
    i.producto?.nombre ? `Producto: ${i.producto.nombre}` : i.productoTipo ? `Producto: ${i.productoTipo}` : null,
    i.dosis ? `Dosis: ${i.dosis} ${i.unidad ?? ""}`.trim() : null,
    i.via ? `Vía: ${i.via}` : null,
    i.notas,
  ].filter(Boolean).join("\n") || null
}

/**
 * Crea el calendario y sus tareas (o, con `vistaPrevia`, solo devuelve lo que generaría).
 * La aftosa no se programa en zona libre sin vacunación; si el protocolo tiene aftosa, la
 * zona del campo tiene que estar definida.
 */
export async function crearCalendario(ctx: AuthContext, raw: unknown) {
  const v = calendarioSchema.parse(raw)
  campoSanitario(ctx, v.establecimientoId)
  const org = ctx.organizacionDeEstablecimiento[v.establecimientoId]
  const [protocolo, campo, lote] = await Promise.all([
    prisma.protocoloSanitario.findFirst({ where: { id: v.protocoloId, organizacionId: org }, include: { items: { orderBy: { orden: "asc" }, include: { producto: { select: { nombre: true } } } } } }),
    prisma.establecimiento.findUnique({ where: { id: v.establecimientoId }, select: { nombre: true, zonaAftosa: true } }),
    v.loteId ? prisma.lote.findFirst({ where: { id: v.loteId, establecimientoId: v.establecimientoId }, select: { id: true, nombre: true, activo: true } }) : null,
  ])
  if (!protocolo) throw new SanidadError("Protocolo no encontrado en la organización", 404)
  if (!protocolo.activo) throw new SanidadError("El protocolo está archivado", 400)
  if (v.loteId && !lote) throw new SanidadError("Grupo no encontrado en el campo", 404)
  if (lote && !lote.activo) throw new SanidadError("El grupo está inactivo", 400)
  const zona = (campo?.zonaAftosa ?? null) as ZonaAftosa | null
  if (protocolo.items.some((i) => i.esAftosa) && !zona) throw new SanidadError("El protocolo incluye aftosa: definí primero la zona de aftosa del campo", 400, "zona_sin_definir")
  if (protocolo.zonaAplicable && zona && protocolo.zonaAplicable !== zona) {
    throw new SanidadError(`El protocolo es para zona «${ETIQUETA_ZONA[protocolo.zonaAplicable as ZonaAftosa]}» y el campo está en «${ETIQUETA_ZONA[zona]}»`, 400, "zona_distinta")
  }
  const { programadas, omitidos } = proyectarItems(protocolo.items as unknown as ItemPlan[], v, { anio: v.anio, zona })
  if (v.vistaPrevia) return { vistaPrevia: true, programadas, omitidos }
  if (!programadas.length) throw new SanidadError("Con esas fechas no queda ninguna tarea para programar", 400)
  const repetido = await prisma.calendarioSanitario.findFirst({ where: { establecimientoId: v.establecimientoId, protocoloId: v.protocoloId, anio: v.anio, loteId: v.loteId, activo: true }, select: { id: true } })
  if (repetido) throw new SanidadError("Ya hay un calendario activo de ese protocolo para ese año y grupo", 409)

  const items = new Map(protocolo.items.map((i) => [i.id, i]))
  return prisma.$transaction(async (tx) => {
    const calendario = await tx.calendarioSanitario.create({
      data: {
        nombre: `${protocolo.nombre} ${v.anio}${lote ? ` · ${lote.nombre}` : ""}`.slice(0, 180), anio: v.anio, protocoloId: protocolo.id, establecimientoId: v.establecimientoId, loteId: v.loteId,
        fechaInicio: fechaDia(v.fechaInicio), fechaCampaniaOtono: v.fechaCampaniaOtono ? fechaDia(v.fechaCampaniaOtono) : null,
        fechaCampaniaPrimavera: v.fechaCampaniaPrimavera ? fechaDia(v.fechaCampaniaPrimavera) : null, fechaPreServicio: v.fechaPreServicio ? fechaDia(v.fechaPreServicio) : null,
        fechaDestete: v.fechaDestete ? fechaDia(v.fechaDestete) : null, fechaPreEsquila: v.fechaPreEsquila ? fechaDia(v.fechaPreEsquila) : null, creadoPorId: ctx.userId,
      },
    })
    await tx.tarea.createMany({
      data: programadas.map((p) => {
        const i = items.get(p.itemId!)!
        return {
          titulo: `${p.nombre}${p.repeticion ? ` (${p.repeticion + 1})` : ""}`.slice(0, 200), descripcion: descripcionTarea(i, lote?.nombre ?? null), tipo: "sanitario",
          estado: "pendiente", prioridad: p.obligatorio ? "alta" : "media", fechaLimite: fechaTarea(p.fecha),
          establecimientoId: v.establecimientoId, calendarioSanitarioId: calendario.id, itemProtocoloId: i.id,
        }
      }),
    })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: org, tabla: "calendarios_sanitarios", rowPk: calendario.id, accion: "INSERT", detalle: { protocoloId: protocolo.id, anio: v.anio, loteId: v.loteId, tareas: programadas.length, omitidos: omitidos.length } } })
    return { vistaPrevia: false, calendario, tareas: programadas.length, omitidos }
  })
}

/** Calendarios del campo con su avance (tareas cumplidas, vencidas y pendientes). */
export async function listarCalendarios(ctx: AuthContext, establecimientoId: string) {
  if (!ctx.establecimientoIds.includes(establecimientoId)) throw new SanidadError("Campo no encontrado", 404)
  const hoy = fechaTarea(hoyArgentina())
  const calendarios = await prisma.calendarioSanitario.findMany({
    where: { establecimientoId }, orderBy: [{ activo: "desc" }, { anio: "desc" }, { createdAt: "desc" }],
    include: { protocolo: { select: { id: true, nombre: true, especie: true } }, lote: { select: { id: true, nombre: true } } },
  })
  const ids = calendarios.map((c) => c.id)
  const [porEstado, vencidas] = await Promise.all([
    ids.length ? prisma.tarea.groupBy({ by: ["calendarioSanitarioId", "estado"], where: { calendarioSanitarioId: { in: ids } }, _count: { _all: true } }) : [],
    ids.length ? prisma.tarea.groupBy({ by: ["calendarioSanitarioId"], where: { calendarioSanitarioId: { in: ids }, estado: { in: ["pendiente", "en_progreso"] }, fechaLimite: { lt: hoy } }, _count: { _all: true } }) : [],
  ])
  return calendarios.map((c) => {
    const cuenta = (estado: string) => porEstado.filter((g) => g.calendarioSanitarioId === c.id && g.estado === estado).reduce((n, g) => n + g._count._all, 0)
    return {
      ...c, fechaInicio: diaCal(c.fechaInicio),
      avance: { completadas: cuenta("completada"), pendientes: cuenta("pendiente") + cuenta("en_progreso"), canceladas: cuenta("cancelada"), vencidas: vencidas.find((g) => g.calendarioSanitarioId === c.id)?._count._all ?? 0 },
    }
  })
}
const diaCal = (d: Date) => d.toISOString().slice(0, 10)

/** Desactiva el calendario: sus tareas pendientes quedan canceladas (las cumplidas no cambian). */
export async function desactivarCalendario(ctx: AuthContext, id: string) {
  const calendario = await prisma.calendarioSanitario.findFirst({ where: { id, establecimientoId: { in: ctx.establecimientoIds } } })
  if (!calendario) throw new SanidadError("Calendario no encontrado", 404)
  campoSanitario(ctx, calendario.establecimientoId)
  if (!calendario.activo) throw new SanidadError("El calendario ya está desactivado", 409)
  return prisma.$transaction(async (tx) => {
    await tx.calendarioSanitario.update({ where: { id }, data: { activo: false } })
    const { count } = await tx.tarea.updateMany({ where: { calendarioSanitarioId: id, estado: { in: ["pendiente", "en_progreso"] } }, data: { estado: "cancelada" } })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[calendario.establecimientoId], tabla: "calendarios_sanitarios", rowPk: id, accion: "UPDATE", detalle: { activo: false, tareasCanceladas: count } } })
    return { canceladas: count }
  })
}

/** Tareas del plan sanitario del campo (para la pestaña Plan, el calendario y el Panel). */
export async function tareasDelPlan(ctx: AuthContext, f: { establecimientoId: string; estado?: "pendientes" | "vencidas" | "todas"; desde?: string; hasta?: string; limite?: number }) {
  if (!ctx.establecimientoIds.includes(f.establecimientoId)) throw new SanidadError("Campo no encontrado", 404)
  const hoy = fechaTarea(hoyArgentina())
  const tareas = await prisma.tarea.findMany({
    where: {
      establecimientoId: f.establecimientoId, calendarioSanitarioId: { not: null },
      ...(f.estado === "pendientes" ? { estado: { in: ["pendiente", "en_progreso"] } } : {}),
      ...(f.estado === "vencidas" ? { estado: { in: ["pendiente", "en_progreso"] }, fechaLimite: { lt: hoy } } : {}),
      ...(f.desde || f.hasta ? { fechaLimite: { ...(f.desde ? { gte: fechaTarea(f.desde) } : {}), ...(f.hasta ? { lte: fechaTarea(f.hasta) } : {}) } } : {}),
    },
    orderBy: [{ fechaLimite: "asc" }, { titulo: "asc" }],
    take: Math.min(f.limite ?? 200, 500),
    include: {
      itemProtocolo: { select: { id: true, productoId: true, productoTipo: true, dosis: true, unidad: true, via: true, destinatarios: true, obligatorio: true, producto: { select: { nombre: true } } } },
      calendarioSanitario: { select: { id: true, nombre: true, loteId: true, lote: { select: { nombre: true } }, protocolo: { select: { especie: true } } } },
    },
  })
  return tareas.map((t) => ({
    id: t.id, titulo: t.titulo, descripcion: t.descripcion, estado: t.estado, prioridad: t.prioridad,
    fecha: t.fechaLimite ? diaDe(t.fechaLimite) : null,
    vencida: (t.estado === "pendiente" || t.estado === "en_progreso") && !!t.fechaLimite && t.fechaLimite < hoy,
    item: t.itemProtocolo, calendario: t.calendarioSanitario,
  }))
}

/**
 * Vincula una aplicación con su tarea del plan: valida que sea una tarea sanitaria del
 * mismo campo y no cancelada, y la deja completada. Devuelve el ítem del protocolo.
 */
export async function cumplirTarea(tx: Tx, tareaId: string, establecimientoId: string) {
  const tarea = await tx.tarea.findFirst({ where: { id: tareaId, establecimientoId, tipo: "sanitario" }, select: { id: true, estado: true, itemProtocoloId: true } })
  if (!tarea) throw new SanidadError("La tarea no es del plan sanitario de este campo", 400)
  if (tarea.estado === "cancelada") throw new SanidadError("La tarea está cancelada", 400)
  if (tarea.estado !== "completada") await tx.tarea.update({ where: { id: tarea.id }, data: { estado: "completada", fechaCompletada: new Date() } })
  return { tareaId: tarea.id, itemProtocoloId: tarea.itemProtocoloId }
}
