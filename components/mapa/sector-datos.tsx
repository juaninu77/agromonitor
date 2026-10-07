"use client"

import { useState, type FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Archive } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { MapSector } from "@/lib/mapa/types"

const USOS = [
  ["", "Sin especificar"],
  ["pastoreo", "Pastoreo"],
  ["encierre", "Encierre"],
  ["manejo", "Manejo"],
  ["engorde", "Engorde"],
] as const

type SectorConDatos = MapSector & { uso?: string | null; tieneBalanza?: boolean }

async function patch(id: string, body: object) {
  const r = await fetch(`/api/sectores/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error ?? "No se pudo guardar")
  return b
}

/**
 * Datos del lugar (superficie, capacidad, uso, instalaciones, descripción) y
 * archivado. Los que no pueden editar ven un resumen de solo lectura.
 */
export function SectorDatos({ sector, canEdit, onArchivado }: { sector: SectorConDatos; canEdit: boolean; onArchivado: () => void }) {
  const client = useQueryClient()
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState(() => ({
    superficieHa: sector.superficieHa?.toString() ?? "",
    capacidad: sector.capacidad?.toString() ?? "",
    uso: sector.uso ?? "",
    tieneAgua: sector.tieneAgua,
    tieneSombra: sector.tieneSombra,
    tieneBalanza: sector.tieneBalanza ?? false,
    descripcion: sector.descripcion ?? "",
  }))
  const refrescar = () => Promise.all(["mapa", "sectores", "sector-ficha"].map((k) => client.invalidateQueries({ queryKey: [k] })))

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    try {
      await patch(sector.id, {
        version: sector.version,
        superficieHa: form.superficieHa === "" ? null : form.superficieHa,
        capacidad: form.capacidad === "" ? null : form.capacidad,
        uso: form.uso || null,
        tieneAgua: form.tieneAgua,
        tieneSombra: form.tieneSombra,
        tieneBalanza: form.tieneBalanza,
        descripcion: form.descripcion.trim() || null,
      })
      await refrescar()
      toast.success("Datos del lugar actualizados")
      setEditando(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar")
    } finally {
      setGuardando(false)
    }
  }

  async function archivar() {
    if (!window.confirm(`¿Archivar «${sector.nombre}»? Deja de verse en el mapa y en los listados; podés restaurarlo desde «Lugares archivados». No se borra ningún dato.`)) return
    setGuardando(true)
    try {
      await patch(sector.id, { version: sector.version, activo: false })
      await refrescar()
      client.invalidateQueries({ queryKey: ["sectores-archivados"] })
      toast.success(`«${sector.nombre}» archivado`)
      onArchivado()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo archivar")
    } finally {
      setGuardando(false)
    }
  }

  if (!editando) {
    return (
      <div className="space-y-2 rounded-lg border p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium">Datos del lugar</h3>
          {canEdit && <Button size="sm" variant="outline" onClick={() => setEditando(true)}>Editar datos</Button>}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
          <dt>Superficie declarada</dt><dd className="text-foreground">{sector.superficieHa != null ? `${sector.superficieHa.toLocaleString("es-AR")} ha` : "—"}</dd>
          <dt>Capacidad</dt><dd className="text-foreground">{sector.capacidad != null ? `${sector.capacidad} animales` : "—"}</dd>
          <dt>Uso</dt><dd className="text-foreground">{USOS.find(([v]) => v === (sector.uso ?? ""))?.[1] ?? sector.uso}</dd>
          <dt>Instalaciones</dt><dd className="text-foreground">{[sector.tieneAgua && "agua", sector.tieneSombra && "sombra", sector.tieneBalanza && "balanza"].filter(Boolean).join(", ") || "—"}</dd>
        </dl>
        {sector.descripcion && <p className="whitespace-pre-wrap text-muted-foreground">{sector.descripcion}</p>}
      </div>
    )
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const marcar = (k: "tieneAgua" | "tieneSombra" | "tieneBalanza") => (e: { target: { checked: boolean } }) => setForm((f) => ({ ...f, [k]: e.target.checked }))
  return (
    <form onSubmit={guardar} className="space-y-3 rounded-lg border p-3 text-sm">
      <h3 className="font-medium">Datos del lugar</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="erp-field"><span>Superficie declarada (ha)</span><Input type="number" min="0" step="0.01" value={form.superficieHa} onChange={set("superficieHa")} disabled={guardando} /></label>
        <label className="erp-field"><span>Capacidad (animales)</span><Input type="number" min="0" step="1" value={form.capacidad} onChange={set("capacidad")} disabled={guardando} /></label>
      </div>
      <label className="erp-field"><span>Uso</span>
        <select className="erp-select w-full" value={form.uso} onChange={set("uso")} disabled={guardando}>
          {USOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">Instalaciones</legend>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.tieneAgua} onChange={marcar("tieneAgua")} disabled={guardando} />Agua</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.tieneSombra} onChange={marcar("tieneSombra")} disabled={guardando} />Sombra</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.tieneBalanza} onChange={marcar("tieneBalanza")} disabled={guardando} />Balanza</label>
      </fieldset>
      <label className="erp-field"><span>Descripción</span><Textarea maxLength={3000} rows={3} value={form.descripcion} onChange={set("descripcion")} disabled={guardando} /></label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</Button>
          <Button type="button" size="sm" variant="outline" disabled={guardando} onClick={() => setEditando(false)}>Cancelar</Button>
        </div>
        <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={guardando} onClick={archivar}>
          <Archive className="mr-1.5 h-4 w-4" aria-hidden />Archivar lugar
        </Button>
      </div>
    </form>
  )
}
