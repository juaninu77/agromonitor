// Estado reproductivo de cada hembra, derivado de sus eventos vigentes (spec 00: no se guarda).
// Una sola consulta para un conjunto de animales; la regla vive en derivarEstado() (client-safe).

import { prisma } from "@/lib/prisma"
import { hoyArgentina } from "@/lib/inventario/fechas"
import { derivarEstado, type EstadoDerivado } from "./validation"

interface Fila {
  id: string
  especie: string
  servicio: Date | null
  tacto_fecha: Date | null
  tacto_resultado: string | null
  fecha_probable_parto: Date | null
  parto_fecha: Date | null
  parto_resultado: string | null
  cria_destetada: boolean
}
const dia = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

/** Estado de las hembras pedidas (los machos y las hembras sin eventos no aparecen). */
export async function estadosReproductivos(animalIds: string[], hoy = hoyArgentina()): Promise<Map<string, EstadoDerivado>> {
  if (!animalIds.length) return new Map()
  const filas = await prisma.$queryRaw<Fila[]>`
    SELECT a.id, e.nombre AS especie,
      (SELECT MAX(s.fecha) FROM evt_servicio s WHERE s.hembra_id = a.id AND s.anulado_at IS NULL) AS servicio,
      t.fecha AS tacto_fecha, t.resultado AS tacto_resultado, t.fecha_probable_parto,
      p.fecha AS parto_fecha, p.resultado AS parto_resultado,
      EXISTS (
        SELECT 1 FROM evt_paricion pc JOIN evt_destete d ON d.animal_id = pc.nacido_animal_id AND d.anulado_at IS NULL
        WHERE pc.madre_id = a.id AND pc.fecha = p.fecha AND pc.anulado_at IS NULL
      ) AS cria_destetada
    FROM animales a
    JOIN especies e ON e.id = a.especie_id
    LEFT JOIN LATERAL (
      SELECT fecha, resultado, fecha_probable_parto FROM evt_tacto
      WHERE hembra_id = a.id AND anulado_at IS NULL ORDER BY fecha DESC, created_at DESC LIMIT 1
    ) t ON true
    LEFT JOIN LATERAL (
      SELECT fecha, resultado FROM evt_paricion
      WHERE madre_id = a.id AND anulado_at IS NULL ORDER BY fecha DESC, (resultado = 'vivo') DESC LIMIT 1
    ) p ON true
    WHERE a.id = ANY(${animalIds}::uuid[]) AND a.sexo = 'F'`
  const estados = new Map<string, EstadoDerivado>()
  for (const f of filas) {
    const estado = derivarEstado({
      ultimoServicio: dia(f.servicio),
      ultimoTacto: f.tacto_fecha ? { fecha: dia(f.tacto_fecha)!, resultado: f.tacto_resultado!, fechaProbableParto: dia(f.fecha_probable_parto) } : null,
      ultimoParto: f.parto_fecha ? { fecha: dia(f.parto_fecha)!, resultado: f.parto_resultado! } : null,
      criaDestetada: f.cria_destetada,
    }, hoy, f.especie)
    if (estado) estados.set(f.id, estado)
  }
  return estados
}
