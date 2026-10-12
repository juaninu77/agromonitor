// Detección de celo (Fase E5): un evento por hembra y turno (mañana/tarde), cargado de a una o
// en carga rápida por caravana/EID (el bastón en modo teclado). Sugiere inseminar unas 12 h
// después (regla AM/PM) y lo muestra en la agenda; analiza el intervalo entre celos y las
// hembras que hace 30 días no muestran celo.

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { normalizeEID } from "@/lib/hardware/eid"
import { hoyArgentina } from "@/lib/inventario/fechas"
import { celosAInseminar } from "./agenda"
import { estadosReproductivos } from "./estado"
import {
  ReproduccionError, SEL_ANIMAL, animalParaEvento, auditar, buscarAnimal, diaDe, etiqueta, exigirRol, fechaDia, filtros, nacidoAntes,
  pagina, paginacion, rangoFechas, soloVigentes, vigente,
} from "./service"
import {
  ETIQUETA_MOMENTO_CELO, calificarIntervalo, cargaRapidaCeloSchema, celoSchema, intervalosDeCelo, sugerenciaInseminacion,
  type CalificacionIntervalo, type MomentoCelo,
} from "./validation"

const DIA = 86_400_000
const sumar = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10)
/** Días sin celo ni servicio para revisar una hembra. */
export const DIAS_SIN_CELO = 30
/** Después del parto, la hembra no cicla enseguida (anestro posparto): se revisa pasados 45 días. */
export const DIAS_POSPARTO = 45
/** Edad mínima para esperar celos (en días): vaquillonas desde los 15 meses; ovejas y cabras desde los 8. */
const EDAD_MINIMA: Record<string, number> = { bovino: 450, ovino: 240, caprino: 240 }

/** Aviso cuando una hembra que figura preñada muestra celo (puede haber perdido la preñez). */
async function avisoPrenada(hembraIds: string[]) {
  const estados = await estadosReproductivos(hembraIds)
  return hembraIds.filter((id) => estados.get(id)?.estado === "preñada")
}

export async function registrarCelo(ctx: AuthContext, raw: unknown) {
  const v = celoSchema.parse(raw)
  const hembra = await animalParaEvento(ctx, v.hembraId, "celo", { nombre: "La hembra", sexo: "F" })
  nacidoAntes(hembra, v.fecha)
  if (await prisma.evtCelo.count({ where: { hembraId: hembra.id, fecha: fechaDia(v.fecha), momento: v.momento, ...vigente } })) {
    throw new ReproduccionError(`Ya hay un celo de ${etiqueta(hembra)} ese día a la ${ETIQUETA_MOMENTO_CELO[v.momento].toLowerCase()}`, 409)
  }
  const celo = await prisma.$transaction(async (tx) => {
    const c = await tx.evtCelo.create({
      data: { fecha: fechaDia(v.fecha), momento: v.momento, metodo: v.metodo, observ: v.observ, hembraId: hembra.id, establecimientoId: hembra.establecimientoId },
    })
    await auditar(tx, ctx, hembra.establecimientoId, "evt_celo", c.id, { hembraId: hembra.id, fecha: v.fecha, momento: v.momento, metodo: v.metodo })
    return c
  })
  const prenada = (await avisoPrenada([hembra.id])).length > 0
  return {
    celo,
    sugerencia: sugerenciaInseminacion(v.fecha, v.momento),
    aviso: prenada ? `${etiqueta(hembra)} figura preñada: un celo puede indicar que perdió la preñez. Revisala antes de inseminar.` : null,
  }
}

export interface Omitido { identificador: string; motivo: string }

/**
 * Carga rápida: identifica cada caravana visual, CUIG o EID entre las hembras activas del
 * campo y registra un celo por hembra en una transacción (operacionId = clave: reintentar no
 * duplica). Lo que no se identifica o ya estaba registrado en ese turno se devuelve en `omitidos`.
 */
export async function cargaRapidaCelos(ctx: AuthContext, raw: unknown) {
  const v = cargaRapidaCeloSchema.parse(raw)
  if (!ctx.establecimientoIds.includes(v.establecimientoId)) throw new ReproduccionError("Campo no encontrado", 404)
  exigirRol(ctx, v.establecimientoId, "celo")
  const sugerencia = sugerenciaInseminacion(v.fecha, v.momento)
  const previos = await prisma.evtCelo.count({ where: { operacionId: v.clave } })
  if (previos) return { registrados: previos, repetido: true, hembras: [], omitidos: [] as Omitido[], prenadas: [], sugerencia }

  const identificadores = [...new Set(v.identificadores.map((s) => s.trim()).filter(Boolean))]
  const eids = [...new Set(identificadores.map(normalizeEID).filter((e): e is string => !!e))]
  const animales = await prisma.animal.findMany({
    where: {
      establecimientoId: v.establecimientoId, estadoVital: "activo",
      OR: [{ caravanaRfid: { in: eids } }, { caravanaVisual: { in: identificadores, mode: "insensitive" } }, { cuig: { in: identificadores, mode: "insensitive" } }],
    },
    select: SEL_ANIMAL,
  })
  const ya = new Set((await prisma.evtCelo.findMany({
    where: { hembraId: { in: animales.map((a) => a.id) }, fecha: fechaDia(v.fecha), momento: v.momento, ...vigente }, select: { hembraId: true },
  })).map((c) => c.hembraId))

  const omitidos: Omitido[] = []
  const elegidas = new Map<string, (typeof animales)[number]>()
  for (const id of identificadores) {
    const eid = normalizeEID(id), texto = id.toLowerCase()
    const coinciden = animales.filter((a) =>
      (eid && normalizeEID(a.caravanaRfid) === eid) || a.caravanaVisual?.toLowerCase() === texto || a.cuig?.toLowerCase() === texto)
    const a = coinciden[0]
    if (!a) omitidos.push({ identificador: id, motivo: "No es un animal activo del campo" })
    else if (coinciden.length > 1) omitidos.push({ identificador: id, motivo: `Coincide con ${coinciden.length} animales: cargala por EID` })
    else if (a.sexo !== "F") omitidos.push({ identificador: id, motivo: `${etiqueta(a)} es macho` })
    else if (a.fechaNacimiento && diaDe(a.fechaNacimiento) > v.fecha) omitidos.push({ identificador: id, motivo: `${etiqueta(a)} nació después de esa fecha` })
    else if (ya.has(a.id)) omitidos.push({ identificador: id, motivo: `${etiqueta(a)} ya tiene un celo registrado en ese turno` })
    else if (elegidas.has(a.id)) continue // la misma hembra leída dos veces (caravana y EID)
    else elegidas.set(a.id, a)
  }
  const hembras = [...elegidas.values()]
  if (!hembras.length) {
    throw new ReproduccionError(omitidos.length === 1 ? `${omitidos[0].identificador}: ${omitidos[0].motivo}` : "No se identificó ninguna hembra para registrar", 400)
  }
  const registrados = await prisma.$transaction(async (tx) => {
    // skipDuplicates: si otra carga registró el mismo turno en paralelo, el índice único la omite
    const r = await tx.evtCelo.createMany({
      data: hembras.map((a) => ({ fecha: fechaDia(v.fecha), momento: v.momento, metodo: v.metodo, hembraId: a.id, establecimientoId: v.establecimientoId, operacionId: v.clave })),
      skipDuplicates: true,
    })
    await auditar(tx, ctx, v.establecimientoId, "evt_celo", v.clave, { cargaRapida: true, fecha: v.fecha, momento: v.momento, metodo: v.metodo, hembraIds: hembras.map((a) => a.id), omitidos: omitidos.length })
    return r.count
  })
  const prenadas = new Set(await avisoPrenada(hembras.map((a) => a.id)))
  return {
    registrados, repetido: false, sugerencia, omitidos,
    hembras: hembras.map((a) => ({ id: a.id, caravana: etiqueta(a) })),
    prenadas: hembras.filter((a) => prenadas.has(a.id)).map((a) => etiqueta(a)),
  }
}

// ─── Lecturas ───────────────────────────────────────────────────────────────

type CeloHembra = { id: string; hembraId: string; fecha: Date }

/** Días desde el celo anterior de cada celo (los celos a menos de 3 días son el mismo). */
async function intervalos(celos: CeloHembra[]) {
  const resultado = new Map<string, number | null>()
  if (!celos.length) return resultado
  const desde = new Date(Math.min(...celos.map((c) => c.fecha.getTime())) - 120 * DIA)
  const hasta = new Date(Math.max(...celos.map((c) => c.fecha.getTime())))
  const todos = await prisma.evtCelo.findMany({
    where: { hembraId: { in: [...new Set(celos.map((c) => c.hembraId))] }, fecha: { gte: desde, lte: hasta }, ...vigente },
    orderBy: [{ fecha: "asc" }, { createdAt: "asc" }], select: { id: true, hembraId: true, fecha: true },
  })
  const porHembra = new Map<string, CeloHembra[]>()
  for (const c of todos) porHembra.set(c.hembraId, [...(porHembra.get(c.hembraId) ?? []), c])
  for (const lista of porHembra.values()) {
    const dias = intervalosDeCelo(lista.map((c) => diaDe(c.fecha)))
    lista.forEach((c, i) => resultado.set(c.id, dias[i]))
  }
  return resultado
}

/** Celos del campo, paginados, con el intervalo desde el anterior, la IA sugerida y el servicio que le siguió. */
export async function listarCelos(ctx: AuthContext, raw: unknown) {
  const f = filtros(ctx, raw)
  const where: Prisma.EvtCeloWhereInput = {
    establecimientoId: f.establecimientoId, hembra: buscarAnimal(f.q), ...rangoFechas(f), ...soloVigentes(f),
    ...(f.hembraId ? { hembraId: f.hembraId } : {}),
  }
  const [filas, total] = await Promise.all([
    prisma.evtCelo.findMany({
      where, orderBy: [{ fecha: "desc" }, { momento: "desc" }, { createdAt: "desc" }], ...pagina(f),
      include: { hembra: { select: { id: true, caravanaVisual: true, cuig: true, especie: { select: { nombre: true } } } } },
    }),
    prisma.evtCelo.count({ where }),
  ])
  const [dias, servicios] = await Promise.all([
    intervalos(filas.filter((c) => !c.anuladoAt)),
    filas.length
      ? prisma.evtServicio.findMany({
          where: { hembraId: { in: [...new Set(filas.map((c) => c.hembraId))] }, fecha: { gte: new Date(Math.min(...filas.map((c) => c.fecha.getTime()))) }, ...vigente },
          orderBy: { fecha: "asc" }, select: { id: true, hembraId: true, fecha: true, tipo: true },
        })
      : [],
  ])
  const data = filas.map((c) => {
    const intervalo = dias.get(c.id) ?? null
    const dia = diaDe(c.fecha)
    // El servicio que siguió al celo (ese día o hasta 2 días después)
    const servicio = servicios.find((s) => s.hembraId === c.hembraId && diaDe(s.fecha) >= dia && diaDe(s.fecha) <= sumar(dia, 2)) ?? null
    return {
      ...c, intervaloDias: intervalo, calificacion: intervalo == null ? null : calificarIntervalo(intervalo, c.hembra.especie.nombre),
      sugerencia: sugerenciaInseminacion(dia, c.momento as MomentoCelo), servicio,
    }
  })
  return { data, pagination: paginacion(f, total) }
}

export interface HembraIrregular { hembraId: string; caravana: string; fecha: string; dias: number; calificacion: Exclude<CalificacionIntervalo, "regular"> }
export interface HembraSinCelo { hembraId: string; caravana: string; especie: string; categoria: string | null; ultimoCelo: string | null; estado: string | null; desde: string | null }

/**
 * Análisis de celos del campo: para inseminar hoy, hembras con el último intervalo fuera de lo
 * normal (120 días) y hembras que hace 30 días no muestran celo ni tienen servicio (solo de las
 * especies en las que el campo registra celos; sin las preñadas, las servidas ni las recién paridas).
 */
export async function analisisCelos(ctx: AuthContext, establecimientoId: string, hoy = hoyArgentina()) {
  if (!ctx.establecimientoIds.includes(establecimientoId)) throw new ReproduccionError("Campo no encontrado", 404)
  const [porInseminar, recientes, candidatas] = await Promise.all([
    celosAInseminar(establecimientoId, hoy),
    prisma.$queryRaw<{ id: string; hembra_id: string; caravana: string | null; especie: string; fecha: Date }[]>`
      SELECT c.id, c.hembra_id, COALESCE(a.caravana_visual, a.cuig) AS caravana, e.nombre AS especie, c.fecha
      FROM evt_celo c JOIN animales a ON a.id = c.hembra_id JOIN especies e ON e.id = a.especie_id
      WHERE c.establecimiento_id = ${establecimientoId}::uuid AND c.anulado_at IS NULL AND a.estado_vital = 'activo'
        AND c.fecha >= ${sumar(hoy, -240)}::date
      ORDER BY c.hembra_id, c.fecha, c.created_at`,
    prisma.$queryRaw<{ id: string; caravana: string | null; especie: string; categoria: string | null; ultimo_celo: Date | null }[]>`
      SELECT a.id, COALESCE(a.caravana_visual, a.cuig) AS caravana, e.nombre AS especie, cat.nombre AS categoria,
        (SELECT MAX(c.fecha) FROM evt_celo c WHERE c.hembra_id = a.id AND c.anulado_at IS NULL) AS ultimo_celo
      FROM animales a JOIN especies e ON e.id = a.especie_id LEFT JOIN categorias cat ON cat.id = a.categoria_id
      WHERE a.establecimiento_id = ${establecimientoId}::uuid AND a.estado_vital = 'activo' AND a.sexo = 'F'
        AND a.especie_id IN (
          SELECT DISTINCT x.especie_id FROM evt_celo c JOIN animales x ON x.id = c.hembra_id
          WHERE c.establecimiento_id = ${establecimientoId}::uuid AND c.anulado_at IS NULL AND c.fecha >= ${sumar(hoy, -365)}::date
        )
        AND (a.fecha_nacimiento IS NULL OR a.fecha_nacimiento <= ${hoy}::date - (CASE lower(e.nombre) WHEN 'bovino' THEN ${EDAD_MINIMA.bovino} ELSE ${EDAD_MINIMA.ovino} END)::int)
        AND NOT EXISTS (SELECT 1 FROM evt_celo c WHERE c.hembra_id = a.id AND c.anulado_at IS NULL AND c.fecha > ${sumar(hoy, -DIAS_SIN_CELO)}::date)
        AND NOT EXISTS (SELECT 1 FROM evt_servicio s WHERE s.hembra_id = a.id AND s.anulado_at IS NULL AND s.fecha > ${sumar(hoy, -DIAS_SIN_CELO)}::date)
      ORDER BY a.caravana_visual NULLS LAST, a.id`,
  ])

  // Intervalos: el último de cada hembra en los últimos 120 días, si no es regular
  const porHembra = new Map<string, typeof recientes>()
  for (const c of recientes) porHembra.set(c.hembra_id, [...(porHembra.get(c.hembra_id) ?? []), c])
  const irregulares: HembraIrregular[] = []
  let celos30 = 0, regulares = 0, conIntervalo = 0
  const hembras30 = new Set<string>()
  for (const [hembraId, lista] of porHembra) {
    const dias = intervalosDeCelo(lista.map((c) => diaDe(c.fecha)))
    lista.forEach((c, i) => {
      // Celos distintos (no el mismo visto dos veces) de los últimos 30 días
      if (diaDe(c.fecha) > sumar(hoy, -DIAS_SIN_CELO) && (i === 0 || dias[i] != null)) { celos30++; hembras30.add(hembraId) }
    })
    const ultimo = [...dias.keys()].reverse().find((i) => dias[i] != null)
    if (ultimo == null || diaDe(lista[ultimo].fecha) < sumar(hoy, -120)) continue
    const calificacion = calificarIntervalo(dias[ultimo]!, lista[ultimo].especie)
    conIntervalo++
    if (calificacion === "regular") regulares++
    else irregulares.push({ hembraId, caravana: lista[ultimo].caravana ?? "sin caravana", fecha: diaDe(lista[ultimo].fecha), dias: dias[ultimo]!, calificacion })
  }

  // Sin celo: se descartan las preñadas, las servidas y las paridas hace menos de 45 días
  const estados = await estadosReproductivos(candidatas.map((c) => c.id), hoy)
  const sinCelo: HembraSinCelo[] = []
  for (const c of candidatas) {
    const e = estados.get(c.id)
    if (e && (e.estado === "preñada" || e.estado === "servida")) continue
    if (e && (e.estado === "parida" || e.estado === "lactancia") && e.desde > sumar(hoy, -DIAS_POSPARTO)) continue
    sinCelo.push({ hembraId: c.id, caravana: c.caravana ?? "sin caravana", especie: c.especie, categoria: c.categoria, ultimoCelo: c.ultimo_celo ? diaDe(c.ultimo_celo) : null, estado: e?.estado ?? null, desde: e?.desde ?? null })
  }

  return {
    porInseminar,
    irregulares: irregulares.sort((a, b) => b.fecha.localeCompare(a.fecha)),
    sinCelo: sinCelo.slice(0, 200),
    totalSinCelo: sinCelo.length,
    resumen: { celos30, hembras30: hembras30.size, porcentajeRegulares: conIntervalo ? Math.round((regulares / conIntervalo) * 100) : null, conIntervalo },
    referencia: `Intervalo normal: 18 a 24 días en vacas, 14 a 19 en ovejas. Las hembras sin celo se revisan pasados ${DIAS_SIN_CELO} días (${DIAS_POSPARTO} después del parto).`,
  }
}
