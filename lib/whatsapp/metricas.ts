// Uso del asistente de WhatsApp, agregado en SQL sobre whatsapp_mensajes (nunca se cargan
// los mensajes). Los días son de Argentina. El costo de Claude es el estimado por consulta
// (precios.ts); el real de Anthropic y el de Meta salen de costos.ts.

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { hoyArgentina } from "@/lib/inventario/fechas"

export const PERIODOS_METRICAS = [7, 30, 90] as const
export type DiasMetricas = (typeof PERIODOS_METRICAS)[number]

export interface MetricasWhatsapp {
  desde: string
  hasta: string
  totales: {
    recibidos: number
    respondidos: number
    consultasIa: number
    errores: number
    usuariosActivos: number
    vinculados: number
    costoIaUsd: number
    /** Notas de voz transcriptas y su costo estimado en OpenAI */
    audios: number
    costoAudioUsd: number
    tokensEntrada: number
    tokensSalida: number
    tokensCacheLeidos: number
    tokensCacheEscritos: number
    /** Parte de la entrada que se leyó de la caché (0–1) */
    aciertoCache: number | null
    latenciaMedianaMs: number | null
    latenciaP90Ms: number | null
  }
  porDia: { dia: string; recibidos: number; respondidos: number; errores: number; costoIaUsd: number }[]
  porUsuario: { usuarioId: string; nombre: string; consultas: number; costoIaUsd: number; ultimo: string }[]
  porCampo: { establecimientoId: string; campo: string; organizacion: string; consultas: number; costoIaUsd: number }[]
  herramientas: { nombre: string; usos: number }[]
  errores: { fecha: string; tipo: string; error: string }[]
}

const n = (v: unknown) => (v == null ? 0 : Number(v))
const nulo = (v: unknown) => (v == null ? null : Number(v))

/** Fecha y hora de Argentina de una columna timestamp guardada en UTC. */
const local = (col: Prisma.Sql) => Prisma.sql`((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Argentina/Buenos_Aires')`

/** Días de Argentina [desde, hasta] del período que termina hoy. */
export function rangoMetricas(dias: DiasMetricas, hoy = hoyArgentina()) {
  const fin = new Date(`${hoy}T00:00:00Z`)
  const inicio = new Date(fin.getTime() - (dias - 1) * 86_400_000)
  return { desde: inicio.toISOString().slice(0, 10), hasta: hoy }
}

/** Todos los días del período, para que el gráfico muestre también los días sin mensajes. */
function diasEntre(desde: string, hasta: string) {
  const res: string[] = []
  for (let d = new Date(`${desde}T00:00:00Z`); d <= new Date(`${hasta}T00:00:00Z`); d = new Date(d.getTime() + 86_400_000)) res.push(d.toISOString().slice(0, 10))
  return res
}

export async function metricasWhatsapp(dias: DiasMetricas): Promise<MetricasWhatsapp> {
  const { desde, hasta } = rangoMetricas(dias)
  const enPeriodo = Prisma.sql`${local(Prisma.sql`m.created_at`)}::date BETWEEN ${desde}::date AND ${hasta}::date`

  const [totales, porDia, porUsuario, porCampo, herramientas, errores, vinculados] = await Promise.all([
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT
        count(*) FILTER (WHERE m.sentido = 'entrante') AS recibidos,
        count(*) FILTER (WHERE m.sentido = 'saliente') AS respondidos,
        count(*) FILTER (WHERE m.llamadas_ia > 0) AS consultas_ia,
        count(*) FILTER (WHERE m.estado = 'error') AS errores,
        count(DISTINCT m.vinculo_id) FILTER (WHERE m.sentido = 'entrante') AS usuarios,
        coalesce(sum(m.costo_usd), 0) AS costo,
        count(*) FILTER (WHERE m.costo_audio_usd IS NOT NULL) AS audios,
        coalesce(sum(m.costo_audio_usd), 0) AS costo_audio,
        coalesce(sum(m.tokens_entrada), 0) AS entrada,
        coalesce(sum(m.tokens_salida), 0) AS salida,
        coalesce(sum(m.tokens_cache_leidos), 0) AS cache_leidos,
        coalesce(sum(m.tokens_cache_escritos), 0) AS cache_escritos,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY m.duracion_ms) AS p50,
        percentile_cont(0.9) WITHIN GROUP (ORDER BY m.duracion_ms) AS p90
      FROM whatsapp_mensajes m
      WHERE ${enPeriodo}`,
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT to_char(${local(Prisma.sql`m.created_at`)}::date, 'YYYY-MM-DD') AS dia,
        count(*) FILTER (WHERE m.sentido = 'entrante') AS recibidos,
        count(*) FILTER (WHERE m.sentido = 'saliente') AS respondidos,
        count(*) FILTER (WHERE m.estado = 'error') AS errores,
        coalesce(sum(m.costo_usd), 0) AS costo
      FROM whatsapp_mensajes m
      WHERE ${enPeriodo}
      GROUP BY 1`,
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT u.id AS usuario_id, trim(concat(u.nombre, ' ', u.apellido)) AS nombre,
        count(*) AS consultas, coalesce(sum(m.costo_usd), 0) AS costo, max(m.created_at) AS ultimo
      FROM whatsapp_mensajes m
      JOIN whatsapp_vinculos v ON v.id = m.vinculo_id
      JOIN usuarios u ON u.id = v.usuario_id
      WHERE m.sentido = 'entrante' AND ${enPeriodo}
      GROUP BY u.id, u.nombre, u.apellido
      ORDER BY consultas DESC, costo DESC
      LIMIT 10`,
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT e.id AS establecimiento_id, e.nombre AS campo, o.nombre AS organizacion,
        count(*) AS consultas, coalesce(sum(m.costo_usd), 0) AS costo
      FROM whatsapp_mensajes m
      JOIN establecimientos e ON e.id = m.establecimiento_id
      JOIN organizaciones o ON o.id = e.organizacion_id
      WHERE ${enPeriodo}
      GROUP BY e.id, e.nombre, o.nombre
      ORDER BY costo DESC
      LIMIT 10`,
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT h AS nombre, count(*) AS usos
      FROM whatsapp_mensajes m, unnest(m.herramientas) AS h
      WHERE ${enPeriodo}
      GROUP BY h
      ORDER BY usos DESC`,
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT m.created_at AS fecha, m.tipo, left(coalesce(m.error, ''), 200) AS error
      FROM whatsapp_mensajes m
      WHERE m.estado = 'error' AND ${enPeriodo}
      ORDER BY m.created_at DESC
      LIMIT 10`,
    prisma.whatsappVinculo.count({ where: { verificadoAt: { not: null }, waId: { not: null } } }),
  ])

  const t = totales[0] ?? {}
  const entrada = n(t.entrada), leidos = n(t.cache_leidos), escritos = n(t.cache_escritos)
  const totalEntrada = entrada + leidos + escritos
  const diaMap = new Map(porDia.map((d) => [String(d.dia), d]))

  return {
    desde,
    hasta,
    totales: {
      recibidos: n(t.recibidos),
      respondidos: n(t.respondidos),
      consultasIa: n(t.consultas_ia),
      errores: n(t.errores),
      usuariosActivos: n(t.usuarios),
      vinculados,
      costoIaUsd: n(t.costo),
      audios: n(t.audios),
      costoAudioUsd: n(t.costo_audio),
      tokensEntrada: entrada,
      tokensSalida: n(t.salida),
      tokensCacheLeidos: leidos,
      tokensCacheEscritos: escritos,
      aciertoCache: totalEntrada ? leidos / totalEntrada : null,
      latenciaMedianaMs: nulo(t.p50),
      latenciaP90Ms: nulo(t.p90),
    },
    porDia: diasEntre(desde, hasta).map((dia) => {
      const d = diaMap.get(dia)
      return { dia, recibidos: n(d?.recibidos), respondidos: n(d?.respondidos), errores: n(d?.errores), costoIaUsd: n(d?.costo) }
    }),
    porUsuario: porUsuario.map((u) => ({ usuarioId: String(u.usuario_id), nombre: String(u.nombre || "Sin nombre"), consultas: n(u.consultas), costoIaUsd: n(u.costo), ultimo: new Date(u.ultimo as Date).toISOString() })),
    porCampo: porCampo.map((c) => ({ establecimientoId: String(c.establecimiento_id), campo: String(c.campo), organizacion: String(c.organizacion), consultas: n(c.consultas), costoIaUsd: n(c.costo) })),
    herramientas: herramientas.map((h) => ({ nombre: String(h.nombre), usos: n(h.usos) })),
    errores: errores.map((e) => ({ fecha: new Date(e.fecha as Date).toISOString(), tipo: String(e.tipo), error: String(e.error) })),
  }
}
