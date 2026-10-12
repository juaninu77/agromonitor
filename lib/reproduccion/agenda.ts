// Agenda reproductiva del campo (spec 03 §3.10), derivada de los eventos vigentes:
// - tacto: hembras servidas sin tacto ni parto posterior (por torada, o por hembra si no tiene);
// - parto previsto: preñadas sin parto, por grupo y mes de la fecha probable;
// - señalada (ovinos): grupos con corderos nacidos después de su última señalada;
// - destete: crías propias sin destete, por grupo y mes de nacimiento.
// Cada pendiente tiene una clave estable. sincronizarTareasReproductivas() la materializa como
// Tarea tipo 'reproduccion' (cuando vence en 30 días o menos) y completa las que ya no están.

import { prisma } from "@/lib/prisma"
import { formatoDia, hoyArgentina } from "@/lib/inventario/fechas"

export const DIAS_TACTO: Record<string, number> = { bovino: 60, ovino: 45, caprino: 45 }
export const DIAS_SENALADA = 30
export const DIAS_DESTETE: Record<string, number> = { bovino: 180, ovino: 90, caprino: 90 }
const HORIZONTE_AGENDA = 60
const HORIZONTE_TAREAS = 30

export type TipoPendiente = "tacto" | "parto" | "senalada" | "destete"
export interface Pendiente {
  clave: string
  tipo: TipoPendiente
  titulo: string
  detalle: string
  fecha: string
  vencida: boolean
  cantidad: number
  toradaId?: string | null
  loteId?: string | null
  animalId?: string | null
}

const DIA = 86_400_000
const sumar = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10)
const dia = (d: Date) => d.toISOString().slice(0, 10)
const dias = (tabla: Record<string, number>, especie: string) => tabla[especie.toLowerCase()] ?? tabla.bovino
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Pendientes reproductivos del campo hasta 60 días adelante (los vencidos, siempre). */
export async function agendaReproductiva(establecimientoId: string, hoy = hoyArgentina()): Promise<Pendiente[]> {
  const desde = sumar(hoy, -540)
  const [tactos, partos, senaladas, destetes] = await Promise.all([
    prisma.$queryRaw<{ torada_id: string | null; torada: string | null; hembra_id: string; caravana: string | null; especie: string; ultimo: Date }[]>`
      SELECT s.torada_id, t.nombre AS torada, s.hembra_id, COALESCE(a.caravana_visual, a.cuig) AS caravana, e.nombre AS especie, MAX(s.fecha) AS ultimo
      FROM evt_servicio s
      JOIN animales a ON a.id = s.hembra_id JOIN especies e ON e.id = a.especie_id
      LEFT JOIN toradas t ON t.id = s.torada_id
      WHERE a.establecimiento_id = ${establecimientoId}::uuid AND a.estado_vital = 'activo' AND s.anulado_at IS NULL AND s.fecha >= ${sumar(hoy, -365)}::date
        AND NOT EXISTS (SELECT 1 FROM evt_tacto x WHERE x.hembra_id = s.hembra_id AND x.anulado_at IS NULL AND x.fecha >= s.fecha)
        AND NOT EXISTS (SELECT 1 FROM evt_paricion p WHERE p.madre_id = s.hembra_id AND p.anulado_at IS NULL AND p.fecha >= s.fecha)
      GROUP BY s.torada_id, t.nombre, s.hembra_id, a.caravana_visual, a.cuig, e.nombre`,
    prisma.$queryRaw<{ lote_id: string | null; lote: string | null; fpp: Date }[]>`
      SELECT lh.lote_id, l.nombre AS lote, u.fecha_probable_parto AS fpp FROM (
        SELECT DISTINCT ON (t.hembra_id) t.hembra_id, t.fecha, t.resultado, t.fecha_probable_parto
        FROM evt_tacto t JOIN animales a ON a.id = t.hembra_id
        WHERE a.establecimiento_id = ${establecimientoId}::uuid AND a.estado_vital = 'activo' AND t.anulado_at IS NULL
        ORDER BY t.hembra_id, t.fecha DESC, t.created_at DESC
      ) u
      LEFT JOIN animal_lote_hist lh ON lh.animal_id = u.hembra_id AND lh.hasta IS NULL
      LEFT JOIN lotes l ON l.id = lh.lote_id
      WHERE u.resultado = 'preñada' AND u.fecha_probable_parto IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM evt_paricion p WHERE p.madre_id = u.hembra_id AND p.anulado_at IS NULL AND p.fecha >= u.fecha)`,
    prisma.$queryRaw<{ lote_id: string; lote: string; primero: Date; crias: number }[]>`
      SELECT l.id AS lote_id, l.nombre AS lote, MIN(p.fecha) AS primero, COUNT(*)::int AS crias
      FROM evt_paricion p
      JOIN animales a ON a.id = p.madre_id JOIN especies e ON e.id = a.especie_id
      JOIN animal_lote_hist lh ON lh.animal_id = a.id AND lh.hasta IS NULL JOIN lotes l ON l.id = lh.lote_id
      WHERE a.establecimiento_id = ${establecimientoId}::uuid AND e.nombre IN ('ovino', 'caprino') AND p.anulado_at IS NULL AND p.resultado = 'vivo'
        AND p.fecha >= ${sumar(hoy, -150)}::date
        AND p.fecha > COALESCE((SELECT MAX(s.fecha) FROM evt_senalada s WHERE s.lote_id = l.id AND s.anulado_at IS NULL), '1900-01-01'::date)
      GROUP BY l.id, l.nombre`,
    prisma.$queryRaw<{ lote_id: string | null; lote: string | null; mes: string; primero: Date; crias: number; especie: string }[]>`
      SELECT lh.lote_id, l.nombre AS lote, to_char(a.fecha_nacimiento, 'YYYY-MM') AS mes, MIN(a.fecha_nacimiento) AS primero, COUNT(*)::int AS crias, e.nombre AS especie
      FROM animales a JOIN especies e ON e.id = a.especie_id
      LEFT JOIN animal_lote_hist lh ON lh.animal_id = a.id AND lh.hasta IS NULL
      LEFT JOIN lotes l ON l.id = lh.lote_id
      WHERE a.establecimiento_id = ${establecimientoId}::uuid AND a.estado_vital = 'activo' AND a.origen = 'cria_propia'
        AND a.fecha_nacimiento >= ${desde}::date
        AND NOT EXISTS (SELECT 1 FROM evt_destete d WHERE d.animal_id = a.id AND d.anulado_at IS NULL)
      GROUP BY lh.lote_id, l.nombre, to_char(a.fecha_nacimiento, 'YYYY-MM'), e.nombre`,
  ])

  const items: Pendiente[] = []
  const agregar = (p: Omit<Pendiente, "vencida">) => items.push({ ...p, vencida: p.fecha < hoy })

  // Tacto: por torada (agrupado) o por hembra suelta
  const porTorada = new Map<string, { nombre: string; n: number; fecha: string }>()
  for (const t of tactos) {
    const fecha = sumar(dia(t.ultimo), dias(DIAS_TACTO, t.especie))
    if (t.torada_id) {
      const g = porTorada.get(t.torada_id) ?? { nombre: t.torada ?? "", n: 0, fecha }
      porTorada.set(t.torada_id, { ...g, n: g.n + 1, fecha: fecha > g.fecha ? fecha : g.fecha })
    } else {
      agregar({ clave: `tacto:hembra:${t.hembra_id}:${dia(t.ultimo)}`, tipo: "tacto", titulo: `Tacto de ${t.caravana ?? "una hembra"}`, detalle: `Servida el ${formatoDia(t.ultimo)}`, fecha, cantidad: 1, animalId: t.hembra_id })
    }
  }
  for (const [id, g] of porTorada) {
    agregar({ clave: `tacto:torada:${id}`, tipo: "tacto", titulo: `Tacto de «${g.nombre}»`, detalle: `${plural(g.n, "hembra servida", "hembras servidas")} sin tacto`, fecha: g.fecha, cantidad: g.n, toradaId: id })
  }

  // Partos previstos: por grupo y mes de la fecha probable
  const porMes = new Map<string, { loteId: string | null; lote: string | null; n: number; fecha: string }>()
  for (const p of partos) {
    const f = dia(p.fpp), k = `${p.lote_id ?? "sin-grupo"}:${f.slice(0, 7)}`
    const g = porMes.get(k) ?? { loteId: p.lote_id, lote: p.lote, n: 0, fecha: f }
    porMes.set(k, { ...g, n: g.n + 1, fecha: f < g.fecha ? f : g.fecha })
  }
  for (const [k, g] of porMes) {
    agregar({ clave: `parto:lote:${k}`, tipo: "parto", titulo: `Partos previstos${g.lote ? ` en ${g.lote}` : ""}`, detalle: `${plural(g.n, "preñada", "preñadas")} con parto desde el ${formatoDia(g.fecha)}`, fecha: g.fecha, cantidad: g.n, loteId: g.loteId })
  }

  // Señalada (ovinos): desde el primer cordero nacido después de la última señalada del grupo
  for (const s of senaladas) {
    agregar({ clave: `senalada:lote:${s.lote_id}:${dia(s.primero)}`, tipo: "senalada", titulo: `Señalada de ${s.lote}`, detalle: `${plural(s.crias, "cordero nacido", "corderos nacidos")} desde el ${formatoDia(s.primero)}`, fecha: sumar(dia(s.primero), DIAS_SENALADA), cantidad: s.crias, loteId: s.lote_id })
  }

  // Destete: crías por grupo y mes de nacimiento
  for (const d of destetes) {
    agregar({
      clave: `destete:lote:${d.lote_id ?? "sin-grupo"}:${d.mes}`, tipo: "destete", titulo: `Destete${d.lote ? ` en ${d.lote}` : ""}`,
      detalle: `${plural(d.crias, "cría nacida", "crías nacidas")} en ${d.mes.slice(5)}/${d.mes.slice(0, 4)}`, fecha: sumar(dia(d.primero), dias(DIAS_DESTETE, d.especie)), cantidad: d.crias, loteId: d.lote_id,
    })
  }

  const limite = sumar(hoy, HORIZONTE_AGENDA)
  return items.filter((i) => i.fecha <= limite).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.titulo.localeCompare(b.titulo))
}

/**
 * Lleva la agenda a Tareas (tipo 'reproduccion'): crea las que vencen en 30 días o menos y
 * no existen (una cancelada no se recrea: la clave es única) y completa las pendientes cuyo
 * pendiente ya no está (el evento se registró). Best effort: nunca rompe la operación que la llama.
 */
export async function sincronizarTareasReproductivas(establecimientoId: string, hoy = hoyArgentina()) {
  try {
    const agenda = await agendaReproductiva(establecimientoId, hoy)
    const vigentes = new Set(agenda.map((a) => a.clave))
    const aCrear = agenda.filter((a) => a.fecha <= sumar(hoy, HORIZONTE_TAREAS))
    const [creadas, cumplidas] = await Promise.all([
      aCrear.length
        ? prisma.tarea.createMany({
            data: aCrear.map((a) => ({
              titulo: a.titulo.slice(0, 200), descripcion: `${a.detalle}. Registralo en Reproducción.`, tipo: "reproduccion", estado: "pendiente",
              prioridad: a.vencida ? "alta" : "media", fechaLimite: new Date(`${a.fecha}T12:00:00-03:00`), establecimientoId, claveReproduccion: a.clave,
            })),
            skipDuplicates: true,
          })
        : { count: 0 },
      prisma.tarea.updateMany({
        where: { establecimientoId, tipo: "reproduccion", estado: { in: ["pendiente", "en_progreso"] }, claveReproduccion: { not: null, notIn: [...vigentes] } },
        data: { estado: "completada", fechaCompletada: new Date() },
      }),
    ])
    return { creadas: creadas.count, cumplidas: cumplidas.count }
  } catch (error) {
    console.error("No se pudieron sincronizar las tareas reproductivas:", error)
    return { creadas: 0, cumplidas: 0 }
  }
}

/** Última sincronización por campo en esta instancia del servidor (evita repetirla en cada lectura). */
const ultimaSincronizacion = new Map<string, number>()
const CADA_MS = 10 * 60_000

/**
 * Sincroniza los campos que no se sincronizaron en los últimos 10 minutos (al abrir Tareas).
 * Best effort, como sincronizarTareasReproductivas.
 */
export async function sincronizarSiHaceFalta(establecimientoIds: string[], ahora = Date.now()) {
  const pendientes = establecimientoIds.filter((id) => ahora - (ultimaSincronizacion.get(id) ?? 0) >= CADA_MS)
  for (const id of pendientes) ultimaSincronizacion.set(id, ahora)
  await Promise.all(pendientes.map((id) => sincronizarTareasReproductivas(id)))
  return pendientes.length
}
