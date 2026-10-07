// Historial de límites de un lugar, reconstruido desde la auditoría.
// Cada UPDATE que tocó la geometría guarda { geometriaAnterior, geometriaNueva }.

import { areaHa, geometrySchema, type Geometry } from "./geometry"

export interface VersionLimite {
  id: string
  fecha: string
  autor: string | null
  geometria: Geometry
  areaHa: number | null
  motivo: "edicion" | "division" | "original"
  actual: boolean
}

interface FilaAuditoria {
  id: string
  fecha: Date
  detalle: unknown
  usuario: { nombre: string; apellido: string } | null
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Lista de versiones del límite (más reciente primero). Incluye el límite
 * original (geometría anterior al primer cambio registrado) y marca la vigente.
 */
export function versionesDeLimites(filas: FilaAuditoria[], geometriaActual: unknown): VersionLimite[] {
  const versiones: VersionLimite[] = []
  for (const f of filas) {
    const d = (f.detalle ?? {}) as Record<string, unknown>
    if (!("geometriaNueva" in d) && !("geometriaAnterior" in d)) continue
    const anterior = geometrySchema.safeParse(d.geometriaAnterior)
    const nueva = geometrySchema.safeParse(d.geometriaNueva)
    if (versiones.length === 0 && anterior.success && (!nueva.success || !igual(anterior.data, nueva.data))) {
      versiones.push({ id: `${f.id}-original`, fecha: f.fecha.toISOString(), autor: null, geometria: anterior.data, areaHa: areaHa(anterior.data), motivo: "original", actual: false })
    }
    if (!nueva.success) continue
    if (versiones.length && igual(versiones[versiones.length - 1].geometria, nueva.data)) continue
    versiones.push({
      id: f.id,
      fecha: f.fecha.toISOString(),
      autor: f.usuario ? `${f.usuario.nombre} ${f.usuario.apellido}`.trim() : null,
      geometria: nueva.data,
      areaHa: areaHa(nueva.data),
      motivo: d.division ? "division" : "edicion",
      actual: false,
    })
  }
  const vigente = versiones.findLast((v) => igual(v.geometria, geometriaActual))
  if (vigente) vigente.actual = true
  return versiones.reverse()
}
