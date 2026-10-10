// Carencia y retiro (spec 02 §2.8). Un animal está bajo retiro hasta la fecha de
// liberación de su aplicación vigente más tardía: fecha de aplicación + carencia del
// evento (si se cargó) o días de retiro del producto. Cuenta lo aplicado al animal y lo
// aplicado a un grupo mientras el animal estaba en él. Los tratamientos anulados no
// cuentan. Se calcula en SQL (nunca se carga el historial completo).

import { Prisma } from "@prisma/client"
import { formatoDia, hoyArgentina } from "@/lib/inventario/fechas"

type Db = Pick<Prisma.TransactionClient, "$queryRaw">

export interface Retiro {
  animalId: string
  /** Primer día en que el animal queda liberado (AAAA-MM-DD). */
  hasta: string
  producto: string
  fechaAplicacion: string
}

interface Fila { animal_id: string; libera: Date; producto: string; fecha: Date }

const dia = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Retiros vigentes al día `hoy` (Argentina), del conjunto de animales indicado o de los
 * animales activos de los campos indicados (opcionalmente de una especie).
 */
export async function retirosVigentes(
  db: Db,
  filtro: { animalIds?: string[]; establecimientoIds?: string[]; especie?: string | null },
  hoy = hoyArgentina(),
): Promise<Map<string, Retiro>> {
  if (filtro.animalIds && !filtro.animalIds.length) return new Map()
  if (!filtro.animalIds && !filtro.establecimientoIds?.length) return new Map()
  const condAnimal = filtro.animalIds
    ? Prisma.sql`a.id = ANY(${filtro.animalIds}::uuid[])`
    : Prisma.sql`a.establecimiento_id = ANY(${filtro.establecimientoIds}::uuid[]) AND a.estado_vital = 'activo'`
  const condEspecie = filtro.especie
    ? Prisma.sql`AND EXISTS (SELECT 1 FROM especies es WHERE es.id = a.especie_id AND lower(es.nombre) = lower(${filtro.especie}))`
    : Prisma.empty
  const hoyDate = new Date(`${hoy}T00:00:00Z`)
  const filas = await db.$queryRaw<Fila[]>`
    WITH aplicaciones AS (
      SELECT e.animal_id, e.fecha, (e.fecha + COALESCE(e.carencia_dias, p.retiro_dias))::date AS libera, p.nombre AS producto
      FROM evt_sanidad e
      JOIN productos p ON p.id = e.producto_id
      WHERE e.anulado_at IS NULL AND e.animal_id IS NOT NULL AND COALESCE(e.carencia_dias, p.retiro_dias) > 0
      UNION ALL
      SELECT h.animal_id, e.fecha, (e.fecha + COALESCE(e.carencia_dias, p.retiro_dias))::date AS libera, p.nombre AS producto
      FROM evt_sanidad e
      JOIN productos p ON p.id = e.producto_id
      JOIN animal_lote_hist h ON h.lote_id = e.lote_id
        AND h.desde::date <= e.fecha AND (h.hasta IS NULL OR h.hasta::date >= e.fecha)
      WHERE e.anulado_at IS NULL AND e.lote_id IS NOT NULL AND COALESCE(e.carencia_dias, p.retiro_dias) > 0
    )
    SELECT DISTINCT ON (ap.animal_id) ap.animal_id, ap.libera, ap.producto, ap.fecha
    FROM aplicaciones ap
    JOIN animales a ON a.id = ap.animal_id
    WHERE ${condAnimal} ${condEspecie} AND ap.libera > ${hoyDate}::date
    ORDER BY ap.animal_id, ap.libera DESC`
  return new Map(filas.map((f) => [f.animal_id, { animalId: f.animal_id, hasta: dia(f.libera), producto: f.producto, fechaAplicacion: dia(f.fecha) }]))
}

/** Retiro vigente de un animal, o null. */
export async function retiroDeAnimal(db: Db, animalId: string, hoy = hoyArgentina()) {
  return (await retirosVigentes(db, { animalIds: [animalId] }, hoy)).get(animalId) ?? null
}

/**
 * Un DT-e no lista los animales que viajan: si es a faena y en el campo hay animales de
 * esa especie bajo retiro, se pide confirmar que ninguno de ellos va en el documento.
 * Devuelve el aviso (o null si no hay nada que confirmar).
 */
export async function avisoRetiroDte(db: Db, d: { establecimientoId: string; especie: string; motivo: string | null | undefined; fecha?: string }) {
  if (d.motivo !== "faena") return null
  const especie = d.especie.trim().toLowerCase().replace(/s$/, "")
  const retiros = [...(await retirosVigentes(db, { establecimientoIds: [d.establecimientoId], especie }, d.fecha)).values()]
  if (!retiros.length) return null
  const ultimo = retiros.reduce((m, r) => (r.hasta > m ? r.hasta : m), retiros[0].hasta)
  return {
    cantidad: retiros.length,
    mensaje: `Hay ${retiros.length} ${retiros.length === 1 ? "animal" : "animales"} de esa especie bajo retiro en el campo (el último se libera el ${formatoDia(ultimo)}). Confirmá que ninguno viaja a faena en este DT-e.`,
  }
}
