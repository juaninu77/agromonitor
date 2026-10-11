import { Badge } from "@/components/ui/badge"
import { formatoDia } from "@/lib/inventario/fechas"
import { ETIQUETA_ESTADO_REPRODUCTIVO, type EstadoReproductivo } from "@/lib/reproduccion/validation"

const CLASE: Record<EstadoReproductivo, string> = {
  vacia: "border-red-200 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200",
  servida: "border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  "preñada": "border-green-200 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200",
  parida: "border-purple-200 bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-200",
  lactancia: "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
}

/** Estado reproductivo de una hembra (derivado de sus eventos), con la fecha de parto si está preñada. */
export function EstadoReproductivoBadge({ estado, className }: { estado: { estado: string; desde: string; fechaProbableParto: string | null } | null | undefined; className?: string }) {
  if (!estado) return null
  const e = estado.estado as EstadoReproductivo
  const detalle = e === "preñada" && estado.fechaProbableParto ? `parto ${formatoDia(estado.fechaProbableParto)}` : `desde ${formatoDia(estado.desde)}`
  return (
    <Badge variant="outline" className={`${CLASE[e] ?? ""} ${className ?? ""}`} title={`${ETIQUETA_ESTADO_REPRODUCTIVO[e] ?? e} · ${detalle}`}>
      {ETIQUETA_ESTADO_REPRODUCTIVO[e] ?? e}{e === "preñada" && estado.fechaProbableParto ? ` · ${formatoDia(estado.fechaProbableParto).slice(0, 5)}` : ""}
    </Badge>
  )
}
