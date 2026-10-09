"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface DatosExtra {
  veterinario: string
  aplicador: string
  carenciaDias: string
  costo: string
}

export const datosExtraIniciales: DatosExtra = { veterinario: "", aplicador: "", carenciaDias: "", costo: "" }

/** Campos del pedido según los datos extra (vacío = sin dato). */
export function camposExtra(v: DatosExtra, conCosto = true) {
  return {
    veterinario: v.veterinario || null,
    aplicador: v.aplicador || null,
    carenciaDias: v.carenciaDias === "" ? null : v.carenciaDias,
    ...(conCosto ? { costo: v.costo === "" ? null : v.costo } : {}),
  }
}

/**
 * Veterinario, aplicador, carencia y costo de una aplicación. La carencia por defecto es
 * el retiro del producto; el costo, si se deja vacío, sale del lote descontado del stock.
 */
export function DatosAplicacion({ valor, onChange, retiroDias, conCosto = true }: {
  valor: DatosExtra
  onChange: (v: DatosExtra) => void
  retiroDias?: number | null
  conCosto?: boolean
}) {
  const set = (k: keyof DatosExtra) => (e: { target: { value: string } }) => onChange({ ...valor, [k]: e.target.value })
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="da-vet">Veterinario</Label><Input id="da-vet" maxLength={120} placeholder="Quién indicó el tratamiento" value={valor.veterinario} onChange={set("veterinario")} /></div>
      <div className="space-y-1.5"><Label htmlFor="da-apl">Aplicador</Label><Input id="da-apl" maxLength={120} placeholder="Quién lo aplicó" value={valor.aplicador} onChange={set("aplicador")} /></div>
      <div className="space-y-1.5">
        <Label htmlFor="da-car">Carencia (días)</Label>
        <Input id="da-car" type="number" min="0" max="3650" step="1" inputMode="numeric" value={valor.carenciaDias} onChange={set("carenciaDias")}
          placeholder={retiroDias != null ? `${retiroDias} (retiro del producto)` : "Retiro del producto"} />
      </div>
      {conCosto && (
        <div className="space-y-1.5">
          <Label htmlFor="da-costo">Costo (ARS)</Label>
          <Input id="da-costo" type="number" min="0" step="0.01" inputMode="decimal" value={valor.costo} onChange={set("costo")} placeholder="Se calcula del stock descontado" />
        </div>
      )}
    </div>
  )
}
