"use client"

import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatoDia } from "@/lib/inventario/fechas"
import { ETIQUETA_MOTIVO, ETIQUETA_VIA, MOTIVOS_SANIDAD, VIAS_SANIDAD } from "@/lib/sanidad/validation"

export interface TratamientoEditable {
  id: string
  fecha: string
  observ: string | null
  veterinario: string | null
  aplicador: string | null
  via: string | null
  motivo: string | null
  operacionId: string | null
  producto: { nombre: string }
  destino: string
}

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

async function enviar(url: string, method: string, body: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error ?? "No se pudo guardar")
  return b
}
const mensaje = (e: unknown) => (e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sin conexión: no se guardó")

/** Editar datos no críticos de un tratamiento (producto, dosis, fecha y animal no cambian: para eso se anula). */
export function EditarTratamientoDialog({ tratamiento, onOpenChange, onGuardado }: { tratamiento: TratamientoEditable | null; onOpenChange: (o: boolean) => void; onGuardado: () => void }) {
  const [form, setForm] = useState({ observ: "", veterinario: "", aplicador: "", via: "", motivo: "" })
  const [guardando, setGuardando] = useState(false), [error, setError] = useState("")
  useEffect(() => {
    if (!tratamiento) return
    setError("")
    setForm({ observ: tratamiento.observ ?? "", veterinario: tratamiento.veterinario ?? "", aplicador: tratamiento.aplicador ?? "", via: tratamiento.via ?? "", motivo: tratamiento.motivo ?? "" })
  }, [tratamiento])
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault(); if (!tratamiento) return
    setGuardando(true); setError("")
    try {
      await enviar(`/api/sanidad/${tratamiento.id}`, "PATCH", { ...form, via: form.via || null, motivo: form.motivo || null })
      toast.success("Tratamiento actualizado"); onOpenChange(false); onGuardado()
    } catch (err) { setError(mensaje(err)); toast.error(mensaje(err)) } finally { setGuardando(false) }
  }

  return (
    <Dialog open={!!tratamiento} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar tratamiento</DialogTitle>
          <DialogDescription>{tratamiento && `${tratamiento.producto.nombre} · ${tratamiento.destino} · ${formatoDia(tratamiento.fecha)}`}. Para cambiar producto, dosis, fecha o animal, anulalo y registralo de nuevo.</DialogDescription>
        </DialogHeader>
        <form id="editar-tratamiento" onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="et-vet">Veterinario</Label><Input id="et-vet" maxLength={120} value={form.veterinario} onChange={set("veterinario")} /></div>
            <div className="space-y-1.5"><Label htmlFor="et-apl">Aplicador</Label><Input id="et-apl" maxLength={120} value={form.aplicador} onChange={set("aplicador")} /></div>
            <div className="space-y-1.5"><Label htmlFor="et-via">Vía</Label>
              <select id="et-via" className={selectClass} value={form.via} onChange={set("via")}><option value="">—</option>{VIAS_SANIDAD.map((v) => <option key={v} value={v}>{ETIQUETA_VIA[v]}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="et-motivo">Motivo</Label>
              <select id="et-motivo" className={selectClass} value={form.motivo} onChange={set("motivo")}><option value="">—</option>{MOTIVOS_SANIDAD.map((m) => <option key={m} value={m}>{ETIQUETA_MOTIVO[m]}</option>)}</select></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="et-obs">Observaciones</Label><Textarea id="et-obs" rows={3} maxLength={1000} value={form.observ} onChange={set("observ")} /></div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
          <Button type="submit" form="editar-tratamiento" disabled={guardando}>{guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Anular un tratamiento: queda en el historial como anulado y lo descontado vuelve al stock. */
export function AnularTratamientoDialog({ tratamiento, onOpenChange, onAnulado }: { tratamiento: TratamientoEditable | null; onOpenChange: (o: boolean) => void; onAnulado: () => void }) {
  const [motivo, setMotivo] = useState("")
  const [guardando, setGuardando] = useState(false), [error, setError] = useState("")
  useEffect(() => { if (tratamiento) { setMotivo(""); setError("") } }, [tratamiento])

  async function submit(e: FormEvent) {
    e.preventDefault(); if (!tratamiento) return
    setGuardando(true); setError("")
    try {
      const b = await enviar(`/api/sanidad/${tratamiento.id}/anular`, "POST", { motivo })
      const d = b.data as { anulados: number; masiva: boolean; stockDevuelto: number }
      toast.success(`${d.masiva ? `Aplicación masiva anulada (${d.anulados} tratamientos)` : "Tratamiento anulado"}${d.stockDevuelto ? ` · volvieron ${d.stockDevuelto.toLocaleString("es-AR")} al stock` : ""}`)
      onOpenChange(false); onAnulado()
    } catch (err) { setError(mensaje(err)); toast.error(mensaje(err)) } finally { setGuardando(false) }
  }

  return (
    <Dialog open={!!tratamiento} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anular tratamiento</DialogTitle>
          <DialogDescription>{tratamiento && `${tratamiento.producto.nombre} · ${tratamiento.destino} · ${formatoDia(tratamiento.fecha)}`}. Queda en el historial como anulado y lo descontado del stock vuelve al inventario.</DialogDescription>
        </DialogHeader>
        <form id="anular-tratamiento" onSubmit={submit} className="space-y-3">
          {tratamiento?.operacionId && <p className="erp-notice text-sm">Es parte de una aplicación masiva: se anula la aplicación completa (todos sus animales).</p>}
          <div className="space-y-1.5"><Label htmlFor="an-motivo">Motivo de la anulación</Label><Textarea id="an-motivo" required minLength={3} maxLength={500} rows={3} placeholder="Ej.: se cargó en el animal equivocado" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
          <Button type="submit" form="anular-tratamiento" variant="destructive" disabled={guardando || motivo.trim().length < 3}>{guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Anular</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
