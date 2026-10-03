"use client"

import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface ResultadoFila {
  fila: number
  ok: boolean
  errores: string[]
  identificacion: string
  animalId?: string
}

export interface ResumenAltaMasiva {
  total: number
  validas: number
  conError: number
}

/** Respuesta de POST /api/ganado/bovinos/lote (200 ó 422). */
export interface RespuestaAltaMasiva {
  success: boolean
  dryRun: boolean
  error?: string
  resumen: ResumenAltaMasiva
  filas: ResultadoFila[]
}

export async function enviarAltaMasiva(
  filas: unknown[],
  opciones: { establecimientoId: string; dryRun: boolean },
): Promise<RespuestaAltaMasiva> {
  const r = await fetch("/api/ganado/bovinos/lote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ establecimientoId: opciones.establecimientoId, dryRun: opciones.dryRun, filas }),
  })
  const body = (await r.json().catch(() => null)) as Partial<RespuestaAltaMasiva> | null
  if (r.status === 200 || r.status === 422) return body as RespuestaAltaMasiva
  throw new Error(body?.error ?? `Error ${r.status} al validar los animales`)
}

export function ResumenChips({ resumen, dryRun }: { resumen: ResumenAltaMasiva; dryRun: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      <Badge variant="outline">{resumen.total} fila{resumen.total === 1 ? "" : "s"}</Badge>
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        {resumen.validas} {dryRun ? "válida" : "registrada"}
        {resumen.validas === 1 ? "" : "s"}
      </Badge>
      {resumen.conError > 0 && (
        <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
          <AlertCircle className="mr-1 h-3 w-3" />
          {resumen.conError} con error{resumen.conError === 1 ? "" : "es"}
        </Badge>
      )}
    </div>
  )
}

/**
 * Tabla compacta con el resultado por fila de la validación. Las filas con
 * error van primero. Funciona en móvil (una columna) y escritorio.
 */
export function ResultadoFilas({ filas, soloErrores = false, maxFilas = 200 }: { filas: ResultadoFila[]; soloErrores?: boolean; maxFilas?: number }) {
  const ordenadas = [...filas].sort((a, b) => Number(a.ok) - Number(b.ok) || a.fila - b.fila)
  const visibles = (soloErrores ? ordenadas.filter((f) => !f.ok) : ordenadas).slice(0, maxFilas)
  if (visibles.length === 0) return null
  return (
    <ul className="divide-y divide-border rounded-lg border" aria-label="Resultado por fila">
      {visibles.map((f) => (
        <li
          key={`${f.fila}-${f.identificacion}`}
          className={cn("flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-start sm:gap-3", !f.ok && "bg-red-50/60 dark:bg-red-950/20")}
        >
          <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">Fila {f.fila}</span>
          <span className="w-40 shrink-0 truncate font-medium">{f.identificacion}</span>
          {f.ok ? (
            <span className="flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Lista para registrar
            </span>
          ) : (
            <ul className="flex-1 space-y-0.5 text-red-700 dark:text-red-300">
              {f.errores.map((e, i) => (
                <li key={i} className="flex gap-1">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
      {ordenadas.length > visibles.length && (
        <li className="px-3 py-2 text-xs text-muted-foreground">… y {ordenadas.length - visibles.length} filas más</li>
      )}
    </ul>
  )
}
