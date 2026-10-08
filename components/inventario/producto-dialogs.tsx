"use client"

import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { hoyArgentina } from "@/lib/inventario/fechas"
import { UNIDADES_SUGERIDAS } from "@/lib/inventario/validation"

export interface ProductoInventario {
  id: string
  nombre: string
  unidad: string
  stockTotal: number
  stockMinimo: number | null
  costoReferencia: number | null
  monedaCosto: string
  activo: boolean
}

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

async function enviar(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? "No se pudo guardar")
  return json
}
const mensaje = (e: unknown) => (e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sin conexión: no se guardó")

/** Unidad, stock mínimo (punto de reposición), costo de referencia y archivado. */
export function ConfigurarProductoDialog({ producto, onOpenChange, onGuardado }: { producto: ProductoInventario | null; onOpenChange: (o: boolean) => void; onGuardado: () => void }) {
  const [form, setForm] = useState({ unidad: "", stockMinimo: "", costoReferencia: "", monedaCosto: "ARS" })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!producto) return
    setError("")
    setForm({ unidad: producto.unidad, stockMinimo: producto.stockMinimo?.toString() ?? "", costoReferencia: producto.costoReferencia?.toString() ?? "", monedaCosto: producto.monedaCosto })
  }, [producto])

  async function guardar(cambios: Record<string, unknown>, ok: string) {
    if (!producto) return
    setGuardando(true); setError("")
    try {
      await enviar(`/api/productos/${producto.id}`, "PATCH", cambios)
      toast.success(ok); onOpenChange(false); onGuardado()
    } catch (e) { setError(mensaje(e)); toast.error(mensaje(e)) } finally { setGuardando(false) }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); void guardar(form, "Producto actualizado") }

  return (
    <Dialog open={!!producto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar {producto?.nombre}</DialogTitle>
          <DialogDescription>El stock mínimo es el punto de reposición: al llegar a ese valor aparece la alerta de stock bajo.</DialogDescription>
        </DialogHeader>
        <form id="config-producto" onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cfg-unidad">Unidad de stock</Label>
              <Input id="cfg-unidad" list="cfg-unidades" required maxLength={30} value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })} />
              <datalist id="cfg-unidades">{UNIDADES_SUGERIDAS.map((u) => <option key={u} value={u} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cfg-minimo">Stock mínimo</Label>
              <Input id="cfg-minimo" type="number" min="0" step="0.001" inputMode="decimal" placeholder="Sin alerta" value={form.stockMinimo} onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <div className="space-y-1.5">
              <Label htmlFor="cfg-costo">Costo de referencia por {form.unidad || "unidad"}</Label>
              <Input id="cfg-costo" type="number" min="0" step="0.01" inputMode="decimal" placeholder="Opcional" value={form.costoReferencia} onChange={(e) => setForm({ ...form, costoReferencia: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cfg-moneda">Moneda</Label>
              <select id="cfg-moneda" className={selectClass} value={form.monedaCosto} onChange={(e) => setForm({ ...form, monedaCosto: e.target.value })}>
                <option value="ARS">ARS</option><option value="USD">USD</option>
              </select>
            </div>
          </div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          {producto?.activo ? (
            <Button type="button" variant="ghost" className="text-destructive" disabled={guardando} onClick={() => window.confirm(`¿Archivar ${producto.nombre}? Deja de ofrecerse en movimientos y aplicaciones.`) && guardar({ activo: false }, "Producto archivado")}>Archivar</Button>
          ) : (
            <Button type="button" variant="outline" disabled={guardando} onClick={() => guardar({ activo: true }, "Producto reactivado")}>Reactivar</Button>
          )}
          <Button type="submit" form="config-producto" disabled={guardando}>{guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Ingreso de un lote: con cantidad, entra al stock en la misma operación. */
export function IngresarLoteDialog({ producto, onOpenChange, onGuardado }: { producto: ProductoInventario | null; onOpenChange: (o: boolean) => void; onGuardado: () => void }) {
  const vacio = { nroLote: "", vencimiento: "", cantidad: "", costo: "", proveedor: "" }
  const [form, setForm] = useState(vacio)
  const [clave, setClave] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => { if (producto) { setForm(vacio); setError(""); setClave(crypto.randomUUID()) } }, [producto]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!producto) return
    setGuardando(true); setError("")
    try {
      await enviar(`/api/productos/${producto.id}/lotes`, "POST", {
        clave, nroLote: form.nroLote, vencimiento: form.vencimiento || null, cantidad: form.cantidad || null,
        unidad: producto.unidad, costo: form.costo || null, proveedor: form.proveedor || null,
      })
      toast.success(form.cantidad ? `Lote ${form.nroLote} ingresado: +${form.cantidad} ${producto.unidad}` : `Lote ${form.nroLote} registrado`)
      onOpenChange(false); onGuardado()
    } catch (e) { setError(mensaje(e)); toast.error(mensaje(e)) } finally { setGuardando(false) }
  }

  return (
    <Dialog open={!!producto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ingresar lote · {producto?.nombre}</DialogTitle>
          <DialogDescription>La cantidad del lote suma al stock. Las salidas sin lote elegido descuentan primero del que vence antes.</DialogDescription>
        </DialogHeader>
        <form id="ingresar-lote" onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lote-nro">N.º de lote</Label>
              <Input id="lote-nro" required maxLength={80} value={form.nroLote} onChange={(e) => setForm({ ...form, nroLote: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lote-venc">Vencimiento</Label>
              <Input id="lote-venc" type="date" min={hoyArgentina()} value={form.vencimiento} onChange={(e) => setForm({ ...form, vencimiento: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lote-cant">Cantidad ({producto?.unidad})</Label>
              <Input id="lote-cant" type="number" min="0" step="0.001" inputMode="decimal" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lote-costo">Costo del lote (opcional)</Label>
              <Input id="lote-costo" type="number" min="0" step="0.01" inputMode="decimal" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lote-prov">Proveedor (opcional)</Label>
            <Input id="lote-prov" maxLength={180} value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
          </div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
          <Button type="submit" form="ingresar-lote" disabled={guardando}>{guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ingresar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
