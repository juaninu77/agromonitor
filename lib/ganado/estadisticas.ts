// Estadísticas y filtros del listado de ganado que dependen de la ÚLTIMA
// pesada de cada animal. Se resuelven en SQL (DISTINCT ON / LATERAL) para no
// traer todo el rodeo a memoria en cada página del listado.

import { prisma } from "@/lib/prisma"

export interface EstadisticasRodeo {
  total: number
  porCategoria: Record<string, number>
  pesoPromedio: number
  conPeso: number
  activos: number
  pesoPorCategoria: { category: string; avgWeight: number; count: number }[]
}

interface FilaAgregada {
  categoria: string | null
  estado_vital: string
  total: number
  con_peso: number
  suma_peso: number
}

export const ESTADISTICAS_VACIAS: EstadisticasRodeo = {
  total: 0,
  porCategoria: {},
  pesoPromedio: 0,
  conPeso: 0,
  activos: 0,
  pesoPorCategoria: [],
}

/**
 * Agrega en la base, para los animales indicados: cantidad por categoría y
 * estado, cuántos tienen pesada y la suma de la última pesada de cada uno.
 * Una sola consulta, sin cargar filas de animales ni pesadas en memoria.
 */
export async function estadisticasDeAnimales(animalIds: string[]): Promise<EstadisticasRodeo> {
  if (animalIds.length === 0) return { ...ESTADISTICAS_VACIAS, porCategoria: {}, pesoPorCategoria: [] }

  const filas = await prisma.$queryRaw<FilaAgregada[]>`
    SELECT c.nombre AS categoria,
           a.estado_vital,
           count(*)::int AS total,
           count(p.peso_kg)::int AS con_peso,
           coalesce(sum(p.peso_kg), 0)::float AS suma_peso
    FROM animales a
    LEFT JOIN categorias c ON c.id = a.categoria_id
    LEFT JOIN LATERAL (
      SELECT p.peso_kg
      FROM evt_pesada p
      WHERE p.animal_id = a.id
      ORDER BY p.fecha DESC, p.created_at DESC, p.id DESC
      LIMIT 1
    ) p ON p.peso_kg > 0
    WHERE a.id = ANY(${animalIds}::uuid[])
    GROUP BY 1, 2
  `

  return agregarFilas(filas)
}

/** Combina las filas agregadas (exportado para poder testearlo sin base). */
export function agregarFilas(filas: FilaAgregada[]): EstadisticasRodeo {
  const stats: EstadisticasRodeo = { ...ESTADISTICAS_VACIAS, porCategoria: {}, pesoPorCategoria: [] }
  const porCategoriaPeso = new Map<string, { count: number; suma: number }>()
  let sumaTotal = 0

  for (const fila of filas) {
    const total = Number(fila.total)
    const conPeso = Number(fila.con_peso)
    const suma = Number(fila.suma_peso)
    stats.total += total
    stats.conPeso += conPeso
    sumaTotal += suma
    if (fila.estado_vital === "activo") stats.activos += total
    if (fila.categoria) stats.porCategoria[fila.categoria] = (stats.porCategoria[fila.categoria] || 0) + total
    if (conPeso > 0) {
      const nombre = fila.categoria || "Sin categoría"
      const acumulado = porCategoriaPeso.get(nombre) || { count: 0, suma: 0 }
      porCategoriaPeso.set(nombre, { count: acumulado.count + conPeso, suma: acumulado.suma + suma })
    }
  }

  stats.pesoPromedio = stats.conPeso > 0 ? Math.round(sumaTotal / stats.conPeso) : 0
  stats.pesoPorCategoria = Array.from(porCategoriaPeso, ([category, { count, suma }]) => ({
    category,
    count,
    avgWeight: Math.round(suma / count),
  }))
  return stats
}

export interface FiltroUltimaPesada {
  pesoMin?: number
  pesoMax?: number
  ccMin?: number
  ccMax?: number
}

/**
 * Ids de los animales de los establecimientos indicados cuya ÚLTIMA pesada
 * (no cualquiera) cumple el rango de peso y/o condición corporal.
 */
export async function animalIdsPorUltimaPesada(
  establecimientoIds: string[],
  filtro: FiltroUltimaPesada
): Promise<string[]> {
  if (establecimientoIds.length === 0) return []
  const filas = await prisma.$queryRaw<{ animal_id: string }[]>`
    SELECT u.animal_id
    FROM (
      SELECT DISTINCT ON (p.animal_id) p.animal_id, p.peso_kg, p.cc
      FROM evt_pesada p
      JOIN animales a ON a.id = p.animal_id
      WHERE p.animal_id IS NOT NULL
        AND a.establecimiento_id = ANY(${establecimientoIds}::uuid[])
      ORDER BY p.animal_id, p.fecha DESC, p.created_at DESC, p.id DESC
    ) u
    WHERE (${filtro.pesoMin ?? null}::float IS NULL OR u.peso_kg >= ${filtro.pesoMin ?? null}::float)
      AND (${filtro.pesoMax ?? null}::float IS NULL OR u.peso_kg <= ${filtro.pesoMax ?? null}::float)
      AND (${filtro.ccMin ?? null}::float IS NULL OR u.cc >= ${filtro.ccMin ?? null}::float)
      AND (${filtro.ccMax ?? null}::float IS NULL OR u.cc <= ${filtro.ccMax ?? null}::float)
  `
  return filas.map((f) => f.animal_id)
}
