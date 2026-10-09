"use client"

import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { etiquetaFinanzas, MEDIOS_PAGO } from "@/lib/finanzas/constantes"
import { hoyArgentina } from "@/lib/inventario/fechas"

interface Producto { id: string; nombre: string; unidad: string; organizacionId: string | null; monedaCosto: string }
interface Ubicacion { id: string; nombre: string; campo: string }
interface Proveedor { id: string; nombre: string; organizacionId: string; activo?: boolean }
interface Cuenta { id: string; nombre: string; moneda: string; establecimientoId: string }

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const SIN = "sin"
const vacio = { productoId: "", cantidad: "", costoTotal: "", moneda: "ARS", proveedorId: "", nroLote: "", vencimiento: "", sectorId: SIN, fecha: "", comprobante: "", egreso: false, cuentaId: "", medioPago: "" }

/** Compra de un insumo: entra al stock como lote con proveedor y costo, y puede generar el egreso en Finanzas. */
export function CompraDialog({ open, onOpenChange, productos, ubicaciones, productoInicial, onGuardado }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  productos: Producto[]
  ubicaciones: Ubicacion[]
  productoInicial?: string
  onGuardado: () => void
}) {
  const [form, setForm] = useState(vacio)
  const [clave, setClave] = useState("")
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [guardando, setGuardando] = useState(false), [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setError(""); setClave(crypto.randomUUID())
    const p = productos.find((x) => x.id === productoInicial)
    setForm({ ...vacio, productoId: productoInicial ?? "", moneda: p?.monedaCosto ?? "ARS", fecha: hoyArgentina() })
    // Proveedores y cuentas: si no se pueden leer (sin permisos de Finanzas), el formulario sigue sin ellos
    fetch("/api/ventas/proveedores").then((r) => r.json()).then((b) => setProveedores(b.data ?? [])).catch(() => setProveedores([]))
    fetch("/api/finanzas/cuentas?activas=1").then((r) => (r.ok ? r.json() : { data: [] })).then((b) => setCuentas(b.data ?? [])).catch(() => setCuentas([]))
  }, [open, productoInicial]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof vacio) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })
  const producto = productos.find((p) => p.id === form.productoId)
  const provs = proveedores.filter((p) => p.organizacionId === producto?.organizacionId && p.activo !== false)
  const cuentasMoneda = cuentas.filter((c) => c.moneda === form.moneda)
  const unitario = Number(form.cantidad) > 0 && Number(form.costoTotal) > 0 ? Number(form.costoTotal) / Number(form.cantidad) : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true); setError("")
    try {
      const r = await fetch("/api/inventario/compras", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clave, productoId: form.productoId, cantidad: form.cantidad, costoTotal: form.costoTotal, moneda: form.moneda,
          proveedorId: form.proveedorId || null, nroLote: form.nroLote || null, vencimiento: form.vencimiento || null,
          sectorId: form.sectorId === SIN ? null : form.sectorId, fecha: form.fecha, comprobante: form.comprobante || null,
          egreso: form.egreso ? { cuentaId: form.cuentaId, medioPago: form.medioPago || null } : null,
        }),
      })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error ?? "No se pudo registrar la compra")
      toast.success(`Compra registrada: ${Number(form.cantidad).toLocaleString("es-AR")} ${producto?.unidad ?? ""}${b.data?.egresoId ? " y egreso en Finanzas" : ""}`)
      onOpenChange(false); onGuardado()
    } catch (e) {
      const m = e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sin conexión: no se registró la compra"
      setError(m); toast.error(m)
    } finally { setGuardando(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar compra</DialogTitle>
          <DialogDescription>Entra al stock como un lote nuevo con su proveedor y costo. Si elegís una cuenta, el pago queda como egreso en Finanzas.</DialogDescription>
        </DialogHeader>
        <form id="compra" onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="co-producto">Producto</Label>
            <select id="co-producto" className={selectClass} required value={form.productoId} onChange={(e) => { const p = productos.find((x) => x.id === e.target.value); setForm({ ...form, productoId: e.target.value, moneda: p?.monedaCosto ?? form.moneda, proveedorId: "" }) }}>
              <option value="">Seleccionar producto</option>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_110px]">
            <div className="space-y-1.5"><Label htmlFor="co-cantidad">Cantidad {producto ? `(${producto.unidad})` : ""}</Label><Input id="co-cantidad" type="number" min="0.001" step="0.001" inputMode="decimal" required value={form.cantidad} onChange={set("cantidad")} /></div>
            <div className="space-y-1.5"><Label htmlFor="co-total">Costo total</Label><Input id="co-total" type="number" min="0.01" step="0.01" inputMode="decimal" required value={form.costoTotal} onChange={set("costoTotal")} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="co-moneda">Moneda</Label>
              <select id="co-moneda" className={selectClass} value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value, cuentaId: "" })}><option value="ARS">ARS</option><option value="USD">USD</option></select>
            </div>
          </div>
          {unitario != null && <p className="-mt-2 text-xs text-muted-foreground">Costo por {producto?.unidad ?? "unidad"}: {form.moneda} {unitario.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="co-proveedor">Proveedor</Label>
              <select id="co-proveedor" className={selectClass} value={form.proveedorId} onChange={set("proveedorId")}>
                <option value="">Sin proveedor</option>
                {provs.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="co-fecha">Fecha</Label><Input id="co-fecha" type="date" required max={hoyArgentina()} value={form.fecha} onChange={set("fecha")} /></div>
            <div className="space-y-1.5"><Label htmlFor="co-lote">N° de lote (opcional)</Label><Input id="co-lote" maxLength={80} placeholder={form.fecha ? `Compra ${form.fecha}` : ""} value={form.nroLote} onChange={set("nroLote")} /></div>
            <div className="space-y-1.5"><Label htmlFor="co-venc">Vencimiento (opcional)</Label><Input id="co-venc" type="date" value={form.vencimiento} onChange={set("vencimiento")} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="co-galpon">Ubicación</Label>
              <select id="co-galpon" className={selectClass} value={form.sectorId} onChange={set("sectorId")}>
                <option value={SIN}>Sin galpón asignado</option>
                {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre} · {u.campo}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="co-comp">Factura o remito (opcional)</Label><Input id="co-comp" maxLength={80} placeholder="Ej.: A-0001-00001234" value={form.comprobante} onChange={set("comprobante")} /></div>
          </div>
          <div className="space-y-3 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.egreso} disabled={!cuentas.length} onChange={(e) => setForm({ ...form, egreso: e.target.checked })} />
              Registrar el pago como egreso en Finanzas
            </label>
            {!cuentas.length && <p className="text-xs text-muted-foreground">No hay cuentas disponibles: creá una en Finanzas para vincular el pago.</p>}
            {form.egreso && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="co-cuenta">Cuenta ({form.moneda})</Label>
                  <select id="co-cuenta" className={selectClass} required value={form.cuentaId} onChange={set("cuentaId")}>
                    <option value="">Elegir cuenta</option>
                    {cuentasMoneda.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  {!cuentasMoneda.length && <p className="text-xs text-destructive">No hay cuentas en {form.moneda}.</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="co-medio">Medio de pago</Label>
                  <select id="co-medio" className={selectClass} value={form.medioPago} onChange={set("medioPago")}>
                    <option value="">Sin especificar</option>
                    {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{etiquetaFinanzas(m)}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
          <Button type="submit" form="compra" disabled={guardando || !form.productoId}>{guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar compra</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
