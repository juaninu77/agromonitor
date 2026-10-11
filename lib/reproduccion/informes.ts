// Informes e integraciones de Reproducción (spec 03 §3.11 y plan D4):
// - hoja de servicio de una torada (hembra por hembra: servicio, tacto y parto);
// - pronóstico de parición por mes (preñadas sin parir, por fecha probable de parto);
// - fechas ancla sugeridas para el plan sanitario (inicio de servicio y destete);
// - apartar las vacías de una torada a otro grupo (descarte o revisión), sin darlas de baja.

import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { hoyArgentina } from "@/lib/inventario/fechas"
import { DIAS_DESTETE, sincronizarTareasReproductivas } from "./agenda"
import { estadosReproductivos } from "./estado"
import { ReproduccionError, auditar, diaDe, etiqueta, exigirRol, moverAGrupo, vigente } from "./service"
import { z } from "zod"

const DIA = 86_400_000
const sumar = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10)

async function toradaVisible(ctx: AuthContext, id: string) {
  const t = await prisma.torada.findFirst({
    where: { id, lote: { establecimientoId: { in: ctx.establecimientoIds } } },
    select: { id: true, nombre: true, tipo: true, tipoGrupo: true, fechaInicio: true, fechaFin: true, loteId: true, lote: { select: { nombre: true, establecimientoId: true, especieId: true } } },
  })
  if (!t) throw new ReproduccionError("Torada no encontrada", 404)
  return t
}

/** Hoja de servicio de una torada: cada hembra servida con su servicio, último tacto y parto. */
export async function hojaDeServicio(ctx: AuthContext, toradaId: string) {
  const t = await toradaVisible(ctx, toradaId)
  const servicios = await prisma.evtServicio.findMany({
    where: { toradaId, ...vigente },
    orderBy: [{ fecha: "asc" }],
    select: {
      fecha: true, tipo: true, toroNombre: true, hembraId: true,
      hembra: { select: { caravanaVisual: true, cuig: true, categoria: { select: { nombre: true } } } }, macho: { select: { caravanaVisual: true, cuig: true } },
    },
  })
  const ids = [...new Set(servicios.map((s) => s.hembraId))]
  const primero = servicios[0]?.fecha
  const [tactos, partos] = await Promise.all([
    prisma.evtTacto.findMany({ where: { hembraId: { in: ids }, ...vigente, ...(primero ? { fecha: { gte: primero } } : {}) }, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], select: { hembraId: true, fecha: true, resultado: true, mesesGest: true, fechaProbableParto: true } }),
    prisma.evtParicion.findMany({ where: { madreId: { in: ids }, ...vigente, ...(primero ? { fecha: { gte: primero } } : {}) }, orderBy: { fecha: "asc" }, select: { madreId: true, fecha: true, resultado: true, sexoCria: true } }),
  ])
  const filas = ids.map((id) => {
    const propios = servicios.filter((s) => s.hembraId === id)
    const s = propios[propios.length - 1]
    const tacto = tactos.find((x) => x.hembraId === id)
    const partosDe = partos.filter((p) => p.madreId === id)
    return {
      hembra: etiqueta(s.hembra), categoria: s.hembra.categoria?.nombre ?? null,
      servicios: propios.length, ultimoServicio: diaDe(s.fecha), tipo: s.tipo, macho: s.macho ? etiqueta(s.macho) : s.toroNombre,
      tacto: tacto ? { fecha: diaDe(tacto.fecha), resultado: tacto.resultado, mesesGest: tacto.mesesGest, fechaProbableParto: tacto.fechaProbableParto ? diaDe(tacto.fechaProbableParto) : null } : null,
      parto: partosDe.length ? { fecha: diaDe(partosDe[0].fecha), resultado: partosDe.map((p) => p.resultado).join("+"), crias: partosDe.filter((p) => p.resultado !== "aborto").length } : null,
    }
  }).sort((a, b) => a.hembra.localeCompare(b.hembra, "es", { numeric: true }))
  return { torada: { ...t, fechaInicio: diaDe(t.fechaInicio), fechaFin: t.fechaFin ? diaDe(t.fechaFin) : null }, filas }
}

/** Pronóstico de parición: preñadas sin parir del campo, por mes de la fecha probable y grupo. */
export async function pronosticoPartos(ctx: AuthContext, establecimientoId: string) {
  if (!ctx.establecimientoIds.includes(establecimientoId)) throw new ReproduccionError("Campo no encontrado", 404)
  const filas = await prisma.$queryRaw<{ mes: string; grupo: string | null; cantidad: number }[]>`
    SELECT to_char(u.fecha_probable_parto, 'YYYY-MM') AS mes, l.nombre AS grupo, COUNT(*)::int AS cantidad FROM (
      SELECT DISTINCT ON (t.hembra_id) t.hembra_id, t.fecha, t.resultado, t.fecha_probable_parto
      FROM evt_tacto t JOIN animales a ON a.id = t.hembra_id
      WHERE a.establecimiento_id = ${establecimientoId}::uuid AND a.estado_vital = 'activo' AND t.anulado_at IS NULL
      ORDER BY t.hembra_id, t.fecha DESC, t.created_at DESC
    ) u
    LEFT JOIN animal_lote_hist lh ON lh.animal_id = u.hembra_id AND lh.hasta IS NULL
    LEFT JOIN lotes l ON l.id = lh.lote_id
    WHERE u.resultado = 'preñada' AND u.fecha_probable_parto IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM evt_paricion p WHERE p.madre_id = u.hembra_id AND p.anulado_at IS NULL AND p.fecha >= u.fecha)
    GROUP BY 1, 2 ORDER BY 1, 2`
  const meses = [...new Set(filas.map((f) => f.mes))]
  return {
    porMes: meses.map((mes) => ({ mes, total: filas.filter((f) => f.mes === mes).reduce((n, f) => n + f.cantidad, 0), grupos: filas.filter((f) => f.mes === mes).map((f) => ({ grupo: f.grupo ?? "Sin grupo", cantidad: f.cantidad })) })),
  }
}

/**
 * Fechas ancla sugeridas para un calendario sanitario (spec 02 §2.7): inicio del servicio de la
 * torada del año (del grupo, si se eligió) y destete del primer parto previsto o nacido del año.
 */
export async function anclasSugeridas(ctx: AuthContext, establecimientoId: string, anio: number, loteId?: string | null, especie?: string | null) {
  if (!ctx.establecimientoIds.includes(establecimientoId)) throw new ReproduccionError("Campo no encontrado", 404)
  const inicio = new Date(`${anio}-01-01T00:00:00Z`), fin = new Date(`${anio}-12-31T00:00:00Z`)
  const torada = await prisma.torada.findFirst({
    where: { lote: { establecimientoId, ...(especie ? { especie: { nombre: { equals: especie, mode: "insensitive" } } } : {}) }, ...(loteId ? { loteId } : {}), fechaInicio: { gte: inicio, lte: fin } },
    orderBy: { fechaInicio: "asc" }, select: { nombre: true, fechaInicio: true, lote: { select: { especie: { select: { nombre: true } } } } },
  })
  // Primer nacimiento del año (registrado o previsto) del campo o del grupo
  const delGrupo = loteId ? { loteHist: { some: { loteId, hasta: null } } } : {}
  const deEspecie = especie ? { especie: { nombre: { equals: especie, mode: "insensitive" as const } } } : {}
  const [nacido, previsto] = await Promise.all([
    prisma.animal.findFirst({ where: { establecimientoId, origen: "cria_propia", ...deEspecie, fechaNacimiento: { gte: inicio, lte: fin }, ...(loteId ? { loteHist: { some: { loteId } } } : {}) }, orderBy: { fechaNacimiento: "asc" }, select: { fechaNacimiento: true, especie: { select: { nombre: true } } } }),
    prisma.evtTacto.findFirst({ where: { ...vigente, resultado: "preñada", fechaProbableParto: { gte: inicio, lte: fin }, hembra: { establecimientoId, estadoVital: "activo", ...deEspecie, ...delGrupo } }, orderBy: { fechaProbableParto: "asc" }, select: { fechaProbableParto: true, hembra: { select: { especie: { select: { nombre: true } } } } } }),
  ])
  const base = [nacido && { fecha: diaDe(nacido.fechaNacimiento!), especie: nacido.especie.nombre }, previsto && { fecha: diaDe(previsto.fechaProbableParto!), especie: previsto.hembra.especie.nombre }]
    .filter((x): x is { fecha: string; especie: string } => !!x).sort((a, b) => a.fecha.localeCompare(b.fecha))[0]
  const destete = base ? sumar(base.fecha, DIAS_DESTETE[base.especie.toLowerCase()] ?? DIAS_DESTETE.bovino) : null
  return {
    fechaPreServicio: torada ? diaDe(torada.fechaInicio) : null,
    origenPreServicio: torada ? `Inicio de «${torada.nombre}»` : null,
    fechaDestete: destete && destete.startsWith(String(anio)) ? destete : null,
    origenDestete: base ? `Primer parto ${base.fecha < hoyArgentina() ? "registrado" : "previsto"} + ${DIAS_DESTETE[base.especie.toLowerCase()] ?? 180} días` : null,
  }
}

const apartarSchema = z.object({ loteDestinoId: z.string({ required_error: "Elegí el grupo" }).uuid("Elegí el grupo") })

/** Hembras de una torada que hoy figuran vacías (último tacto negativo), para apartarlas. */
export async function vaciasDeTorada(ctx: AuthContext, toradaId: string) {
  const t = await toradaVisible(ctx, toradaId)
  const servidas = await prisma.evtServicio.findMany({ where: { toradaId, ...vigente, hembra: { estadoVital: "activo" } }, distinct: ["hembraId"], select: { hembraId: true, hembra: { select: { caravanaVisual: true, cuig: true } } } })
  const estados = await estadosReproductivos(servidas.map((s) => s.hembraId))
  const vacias = servidas.filter((s) => estados.get(s.hembraId)?.estado === "vacia").map((s) => ({ id: s.hembraId, caravana: etiqueta(s.hembra) }))
  return { torada: { id: t.id, nombre: t.nombre, loteId: t.loteId, especieId: t.lote.especieId, establecimientoId: t.lote.establecimientoId }, vacias }
}

/** Aparta (cambia de grupo) las vacías de una torada: admin o encargado del campo. No las da de baja. */
export async function apartarVacias(ctx: AuthContext, toradaId: string, raw: unknown) {
  const v = apartarSchema.parse(raw)
  const { torada, vacias } = await vaciasDeTorada(ctx, toradaId)
  if (!ctx.establecimientoIdsConRol(["admin", "encargado"]).includes(torada.establecimientoId)) throw new ReproduccionError("Solo un administrador o encargado del campo puede apartar animales", 403)
  if (!vacias.length) throw new ReproduccionError("La torada no tiene hembras vacías para apartar", 400)
  const lote = await prisma.lote.findFirst({ where: { id: v.loteDestinoId, establecimientoId: torada.establecimientoId }, select: { activo: true, especieId: true, nombre: true } })
  if (!lote) throw new ReproduccionError("El grupo no es del campo", 400)
  if (!lote.activo || lote.especieId !== torada.especieId) throw new ReproduccionError("El grupo tiene que estar activo y ser de la misma especie", 400)
  const hoy = hoyArgentina()
  const movidas = await prisma.$transaction(async (tx) => {
    let n = 0
    for (const h of vacias) if (await moverAGrupo(tx, h.id, v.loteDestinoId, hoy, "vacia")) n++
    await auditar(tx, ctx, torada.establecimientoId, "animal_lote_hist", toradaId, { apartarVacias: true, toradaId, loteDestinoId: v.loteDestinoId, animales: vacias.map((h) => h.id) })
    return n
  })
  await sincronizarTareasReproductivas(torada.establecimientoId)
  return { movidas, grupo: lote.nombre }
}

/** Categoría sugerida para una madre tras su primer parto (vaquillona → vaca, borrega → oveja). */
export async function recategorizacionSugerida(madreId: string, organizacionId: string | undefined) {
  const madre = await prisma.animal.findUnique({ where: { id: madreId }, select: { especieId: true, categoria: { select: { nombre: true } } } })
  const actual = madre?.categoria?.nombre.toLowerCase()
  const destino = actual === "vaquillona" ? "vaca" : actual === "borrega" ? "oveja" : null
  if (!madre || !destino) return null
  const cat = await prisma.categoria.findFirst({
    where: { especieId: madre.especieId, nombre: { equals: destino, mode: "insensitive" }, OR: [{ organizacionId: organizacionId ?? null }, { organizacionId: null }] },
    select: { id: true, nombre: true },
  })
  return cat ? { categoriaId: cat.id, nombre: cat.nombre, desde: madre.categoria!.nombre } : null
}
