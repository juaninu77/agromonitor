"use client"

import { useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTenant } from "@/lib/context/tenant-context"
import { livestockTypes } from "@/lib/mapa/sector-state"

const select = "erp-select w-full"

/** Formulario para trasladar los animales elegidos a otro campo de la organización. */
export function TrasladoForm({ fieldId, origenSectorId, seleccionados, guardando, onEnviar }: {
  fieldId: string
  origenSectorId: string
  seleccionados: number
  guardando: boolean
  onEnviar: (body: object) => Promise<unknown>
}) {
  const { establecimientos } = useTenant()
  const otros = establecimientos.filter((e) => e.id !== fieldId)
  const [campo, setCampo] = useState(otros[0]?.id ?? "")
  const [lugar, setLugar] = useState("")
  const [grupo, setGrupo] = useState("")
  const [dte, setDte] = useState("")
  const [motivo, setMotivo] = useState("")
  const lugares = useQuery({
    queryKey: ["sectores-traslado", campo],
    enabled: !!campo,
    queryFn: async () => {
      const r = await fetch(`/api/sectores?establecimientoId=${campo}`)
      const b = await r.json()
      if (!r.ok) throw new Error(b.error ?? "No se pudieron cargar los lugares")
      return (b.data as { id: string; nombre: string; tipo: string }[]).filter((s) => livestockTypes.has(s.tipo))
    },
  })
  const grupos = useQuery({
    queryKey: ["lotes-traslado", campo],
    enabled: !!campo,
    queryFn: async () => {
      const r = await fetch(`/api/establecimientos/${campo}/lotes?activos=1`)
      if (!r.ok) return []
      const b = await r.json()
      return (Array.isArray(b) ? b : b.data ?? []) as { id: string; nombre: string }[]
    },
  })
  if (!otros.length) return <p className="rounded-lg border p-3 text-sm text-muted-foreground">La organización tiene un solo campo. Para trasladar animales, primero creá otro campo en Configuración.</p>

  async function enviar(e: FormEvent) {
    e.preventDefault()
    await onEnviar({ origenSectorId, destinoSectorId: lugar, loteDestinoId: grupo || null, dte, motivo })
  }
  return (
    <form className="space-y-3 rounded-lg border bg-muted/30 p-3" onSubmit={enviar}>
      <p className="text-sm text-muted-foreground">Elegí los animales en la lista y el campo de destino. Su historial (pesadas, sanidad, reproducción) viaja con ellos.</p>
      <label className="erp-field"><span>Campo de destino</span>
        <select className={select} value={campo} onChange={(e) => { setCampo(e.target.value); setLugar(""); setGrupo("") }} disabled={guardando} required>
          {otros.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      </label>
      <label className="erp-field"><span>Lugar de destino</span>
        <select className={select} value={lugar} onChange={(e) => setLugar(e.target.value)} disabled={guardando || lugares.isPending} required>
          <option value="">{lugares.isPending ? "Cargando lugares…" : lugares.data?.length ? "Elegir lugar" : "El campo no tiene potreros ni corrales"}</option>
          {lugares.data?.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
      </label>
      <label className="erp-field"><span>Grupo en el destino (opcional)</span>
        <select className={select} value={grupo} onChange={(e) => setGrupo(e.target.value)} disabled={guardando}>
          <option value="">Sin grupo</option>
          {grupos.data?.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="erp-field"><span>N.º de DTe (opcional)</span><Input maxLength={40} value={dte} onChange={(e) => setDte(e.target.value)} disabled={guardando} /></label>
        <label className="erp-field"><span>Motivo (opcional)</span><Input maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={guardando} placeholder="Ej. Recría en Campo Sur" /></label>
      </div>
      <Button className="w-full" disabled={guardando || !seleccionados || !lugar}>{guardando ? "Trasladando…" : `Trasladar ${seleccionados || ""} ${seleccionados === 1 ? "animal" : "animales"}`}</Button>
    </form>
  )
}
