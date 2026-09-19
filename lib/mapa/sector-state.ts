export const grazingTypes = new Set(["potrero", "cultivo"])
export const livestockTypes = new Set(["potrero", "cultivo", "corral", "manga", "feedlot", "enfermeria", "embarcadero"])
export const isParcel = (type: string) => grazingTypes.has(type)
export function sectorState(s: { tipo: string; bovinos: number; ovinos: number; forrajes: unknown[]; descanso?: { estado: string } | null }) {
  if (s.bovinos + s.ovinos > 0) return { key: "ocupado", label: "Con ganado", color: "#2563eb" }
  if (s.descanso?.estado === "inicio") return { key: "descanso", label: "En descanso", color: "#8b5cf6" }
  if (s.forrajes.length) return { key: "cultivado", label: "Con cultivo", color: "#b7791f" }
  if (isParcel(s.tipo)) return { key: "sin-ganado", label: "Sin ganado registrado", color: "#64748b" }
  return { key: "instalacion", label: "Instalación", color: "#64748b" }
}
export function waterLabel(water?: { estado: string } | null) {
  if (!water) return "Sin revisión registrada"
  return ({ disponible: "Agua disponible", sin_agua: "Sin agua", requiere_revision: "Requiere revisión" } as Record<string, string>)[water.estado] ?? "Sin revisión registrada"
}
