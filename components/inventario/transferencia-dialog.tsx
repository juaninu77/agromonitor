"use client"

import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Producto { id: string; nombre: string; unidad: string; porUbicacion?: Record<string, number> }
interface Ubicacion { id: string; nombre: string; campo: string }

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const SIN = "sin"

/** Mover stock entre galpones (o reubicar lo que está «sin galpón»): el total no cambia. */
export function TransferenciaDialog({ open, onOpenChange, productos, ubicaciones, productoInicial, onGuardado }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  productos: Producto[]
  ubicaciones: Ubicacion[]
  productoInicial?: string
  onGuardado: () => void
}) {
  const [form, setForm] = useState({ productoId: "", desde: SIN, hacia: "", cantidad: "", motivo: "" })
  const [clave, setClave] = useState("")
  const [guardando, setGuardando] = useState(false), [error, setError] = useState("")
  useEffect(() => {
    if (!open) return
    setError(""); setClave(crypto.randomUUID())
    const p = productos.find((x) => x.id === productoInicial)
    // Origen sugerido: donde más stock hay
    const desde = p ? Object.entries(p.porUbicacion ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? SIN : SIN
    setForm({ productoId: productoInicial ?? "", desde, hacia: "", cantidad: "", motivo: "" })
  }, [open, productoInicial]) // eslint-disable-line react-hooks/exhaustive-deps

  const producto = productos.find((p) => p.id === form.productoId)
  const saldo = (k: string) => producto?.porUbicacion?.[k] ?? 0
  const nombre = (k: string) => (k === SIN ? "Sin galpón asignado" : ubicaciones.find((u) => u.id === k)?.nombre ?? "Galpón")
  const opciones = [SIN, ...ubicaciones.map((u) => u.id)]

  async function submit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true); setError("")
    try {
      const r = await fetch("/api/inventario/transferencias", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoId: form.productoId, desdeSectorId: form.desde === SIN ? null : form.desde, haciaSectorId: form.hacia === SIN ? null : form.hacia, cantidad: form.cantidad, motivo: form.motivo || null, clave }),
      })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error ?? "No se pudo transferir")
      toast.success(`${Number(form.cantidad).toLocaleString("es-AR")} ${producto?.unidad ?? ""} movidos a ${nombre(form.hacia)}`)
      onOpenChange(false); onGuardado()
    } catch (e) {
      const m = e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sin conexión: no se transfirió"
      setError(m); toast.error(m)
    } finally { setGuardando(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transferir entre galpones</DialogTitle>
          <DialogDescription>Mueve stock de una ubicación a otra conservando los lotes (primero los que vencen antes). El total no cambia.</DialogDescription>
        </DialogHeader>
        <form id="transferencia" onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tr-producto">Producto</Label>
            <select id="tr-producto" className={selectClass} required value={form.productoId} onChange={(e) => setForm({ ...form, productoId: e.target.value })}>
              <option value="">Seleccionar producto</option>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="tr-desde">Desde</Label>
              <select id="tr-desde" className={selectClass} value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })}>
                {opciones.map((k) => <option key={k} value={k}>{nombre(k)}{producto ? ` (${saldo(k).toLocaleString("es-AR")})` : ""}</option>)}
              </select>
            </div>
            <ArrowRight className="mx-auto mb-3 hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden />
            <div className="space-y-1.5">
              <Label htmlFor="tr-hacia">Hacia</Label>
              <select id="tr-hacia" className={selectClass} required value={form.hacia} onChange={(e) => setForm({ ...form, hacia: e.target.value })}>
                <option value="">Elegir destino</option>
                {opciones.filter((k) => k !== form.desde).map((k) => <option key={k} value={k}>{nombre(k)}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-cantidad">Cantidad {producto ? `(${producto.unidad})` : ""}</Label>
            <Input id="tr-cantidad" type="number" min="0.001" step="0.001" inputMode="decimal" required value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            {producto && <p className="text-xs text-muted-foreground">Disponible en {nombre(form.desde).toLowerCase()}: {saldo(form.desde).toLocaleString("es-AR")} {producto.unidad}</p>}
          </div>
          <div className="space-y-1.5"><Label htmlFor="tr-motivo">Observaciones (opcional)</Label><Input id="tr-motivo" maxLength={500} value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} /></div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
          <Button type="submit" form="transferencia" disabled={guardando || !form.productoId || !form.hacia}>{guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Transferir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
