// Indicadores del plan sanitario (spec 02 §2.10), agregados en la base:
// - cobertura: tareas obligatorias del año ya vencidas en el calendario que se cumplieron;
// - tareas del plan vencidas sin cumplir;
// - costo sanitario del año por animal y por categoría (solo ARS; los tratamientos por
//   grupo no se pueden repartir por categoría);
// - casos curativos por mes (12 meses) con alerta de brote;
// - animales bajo retiro hoy.

import { Prisma } from "@prisma/client"
import { hoyArgentina } from "@/lib/inventario/fechas"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { SanidadError } from "./errores"
import { retirosVigentes } from "./retiro"

/** Alerta de brote: el mes actual tiene al menos 3 casos y más del doble del promedio de los 3 meses anteriores. */
export function alertaBrote(serie: { mes: string; casos: number }[]) {
  if (serie.length < 4) return null
  const actual = serie[serie.length - 1]
  const previos = serie.slice(-4, -1)
  const promedio = previos.reduce((n, m) => n + m.casos, 0) / previos.length
  if (actual.casos >= 3 && actual.casos > 2 * promedio) return { casos: actual.casos, promedioPrevio: Math.round(promedio * 10) / 10 }
  return null
}

/** Los últimos 12 meses (AAAA-MM), del más viejo al actual. */
export function ultimosMeses(hoy: string, n = 12) {
  const [a, m] = hoy.split("-").map(Number)
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(Date.UTC(a, m - 1 - (n - 1 - k), 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  })
}

export async function indicadoresSanitarios(ctx: AuthContext, establecimientoId: string) {
  if (!ctx.establecimientoIds.includes(establecimientoId)) throw new SanidadError("Campo no encontrado", 404)
  const hoy = hoyArgentina()
  const anio = hoy.slice(0, 4)
  const inicioAnio = new Date(`${anio}-01-01T00:00:00Z`)
  const finDeHoy = new Date(`${hoy}T23:59:59-03:00`)
  const inicioHoy = new Date(`${hoy}T00:00:00-03:00`)
  const meses = ultimosMeses(hoy)
  const desde = new Date(`${meses[0]}-01T00:00:00Z`)
  const delCampo: Prisma.EvtSanidadWhereInput = { anuladoAt: null, OR: [{ animal: { establecimientoId } }, { lote: { establecimientoId } }] }
  const tareasAnio: Prisma.TareaWhereInput = { establecimientoId, calendarioSanitarioId: { not: null }, fechaLimite: { gte: inicioAnio, lte: finDeHoy }, estado: { not: "cancelada" }, itemProtocolo: { obligatorio: true } }

  const [debidas, cumplidas, vencidas, costoTotal, animalesActivos, porCategoria, curativos, retiros] = await Promise.all([
    prisma.tarea.count({ where: tareasAnio }),
    prisma.tarea.count({ where: { ...tareasAnio, estado: "completada" } }),
    prisma.tarea.count({ where: { establecimientoId, calendarioSanitarioId: { not: null }, estado: { in: ["pendiente", "en_progreso"] }, fechaLimite: { lt: inicioHoy } } }),
    prisma.evtSanidad.aggregate({ where: { AND: [delCampo, { fecha: { gte: inicioAnio } }] }, _sum: { costo: true } }),
    prisma.animal.count({ where: { establecimientoId, estadoVital: "activo" } }),
    prisma.$queryRaw<{ categoria: string; total: number; animales: number }[]>`
      SELECT COALESCE(c.nombre, 'Sin categoría') AS categoria, SUM(e.costo)::float AS total, COUNT(DISTINCT e.animal_id)::int AS animales
      FROM evt_sanidad e
      JOIN animales a ON a.id = e.animal_id
      LEFT JOIN categorias c ON c.id = a.categoria_id
      WHERE e.anulado_at IS NULL AND e.costo IS NOT NULL AND a.establecimiento_id = ${establecimientoId}::uuid AND e.fecha >= ${inicioAnio}::date
      GROUP BY 1 ORDER BY total DESC`,
    prisma.$queryRaw<{ mes: string; casos: number }[]>`
      SELECT to_char(date_trunc('month', e.fecha), 'YYYY-MM') AS mes, COUNT(*)::int AS casos
      FROM evt_sanidad e
      LEFT JOIN animales a ON a.id = e.animal_id
      LEFT JOIN lotes l ON l.id = e.lote_id
      WHERE e.anulado_at IS NULL AND e.motivo = 'curativo' AND COALESCE(a.establecimiento_id, l.establecimiento_id) = ${establecimientoId}::uuid AND e.fecha >= ${desde}::date
      GROUP BY 1`,
    retirosVigentes(prisma, { establecimientoIds: [establecimientoId] }, hoy),
  ])
  const serie = meses.map((mes) => ({ mes, casos: curativos.find((c) => c.mes === mes)?.casos ?? 0 }))
  const total = costoTotal._sum.costo ? Number(costoTotal._sum.costo) : 0
  return {
    anio: Number(anio),
    cobertura: { debidas, cumplidas, porcentaje: debidas ? Math.round((cumplidas / debidas) * 100) : null },
    tareasVencidas: vencidas,
    costo: {
      totalAnio: Math.round(total * 100) / 100,
      porAnimal: animalesActivos ? Math.round((total / animalesActivos) * 100) / 100 : null,
      animalesActivos,
      porCategoria: porCategoria.map((c) => ({ ...c, total: Math.round(c.total * 100) / 100, porAnimal: c.animales ? Math.round((c.total / c.animales) * 100) / 100 : null })),
    },
    curativosPorMes: serie,
    alertaBrote: alertaBrote(serie),
    animalesBajoRetiro: retiros.size,
  }
}
