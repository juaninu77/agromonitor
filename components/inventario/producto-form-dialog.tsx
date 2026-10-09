"use client"

import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CATEGORIAS_INSUMO, esSanitario, etiquetaTipo, UNIDADES_SUGERIDAS } from "@/lib/inventario/validation"

export interface ProductoEditable {
  id: string
  nombre: string
  tipo: string
  principioActivo: string | null
  laboratorio: string | null
  dosisReferencia: string | null
  retiroDias: number
  notas: string | null
  unidad: string
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

/** Alta o edición de un producto: datos, tipo (con campos sanitarios si corresponde) y configuración de inventario. */
export function ProductoFormDialog({ abierto, producto, organizaciones, onOpenChange, onGuardado }: {
  abierto: boolean
  /** null = alta */
  producto: ProductoEditable | null
  /** Organizaciones donde el usuario puede cargar productos (para el alta) */
  organizaciones: { id: string; nombre: string }[]
  onOpenChange: (o: boolean) => void
  onGuardado: (id: string) => void
}) {
  const vacio = { nombre: "", tipo: "otro", principioActivo: "", laboratorio: "", dosisReferencia: "", retiroDias: "0", notas: "", unidad: "unidades", stockMinimo: "", costoReferencia: "", monedaCosto: "ARS", organizacionId: "" }
  const [form, setForm] = useState(vacio)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!abierto) return
    setError("")
    setForm(producto ? {
      nombre: producto.nombre, tipo: producto.tipo, principioActivo: producto.principioActivo ?? "", laboratorio: producto.laboratorio ?? "",
      dosisReferencia: producto.dosisReferencia ?? "", retiroDias: String(producto.retiroDias ?? 0), notas: producto.notas ?? "",
      unidad: producto.unidad, stockMinimo: producto.stockMinimo?.toString() ?? "", costoReferencia: producto.costoReferencia?.toString() ?? "", monedaCosto: producto.monedaCosto, organizacionId: "",
    } : { ...vacio, organizacionId: organizaciones[0]?.id ?? "" })
  }, [abierto, producto]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof vacio) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const sanitario = esSanitario(form.tipo)

  async function guardar(cambios: Record<string, unknown>, ok: string) {
    setGuardando(true); setError("")
    try {
      const r = producto ? await enviar(`/api/productos/${producto.id}`, "PATCH", cambios) : await enviar("/api/productos", "POST", cambios)
      toast.success(ok); onOpenChange(false); onGuardado(r.data?.id ?? producto?.id)
    } catch (e) { setError(mensaje(e)); toast.error(mensaje(e)) } finally { setGuardando(false) }
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    const { organizacionId, ...datos } = form
    void guardar({
      ...datos,
      // Los campos sanitarios solo aplican a productos sanitarios
      ...(sanitario ? {} : { principioActivo: null, dosisReferencia: null, retiroDias: 0 }),
      ...(!producto && organizaciones.length > 1 ? { organizacionId } : {}),
    }, producto ? "Producto actualizado" : "Producto creado")
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{producto ? `Editar ${producto.nombre}` : "Nuevo producto"}</DialogTitle>
          <DialogDescription>El stock mínimo es el punto de reposición: al llegar a ese valor aparece la alerta de stock bajo.</DialogDescription>
        </DialogHeader>
        <form id="producto-form" onSubmit={submit} className="space-y-4">
          {!producto && organizaciones.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="prod-org">Organización</Label>
              <select id="prod-org" className={selectClass} value={form.organizacionId} onChange={set("organizacionId")}>{organizaciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-[1fr_190px]">
            <div className="space-y-1.5"><Label htmlFor="prod-nombre">Nombre</Label><Input id="prod-nombre" required maxLength={180} autoFocus value={form.nombre} onChange={set("nombre")} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-tipo">Tipo</Label>
              <select id="prod-tipo" className={selectClass} value={form.tipo} onChange={set("tipo")}>
                {CATEGORIAS_INSUMO.map((c) => <optgroup key={c.id} label={c.label}>{c.tipos.map((t) => <option key={t} value={t}>{etiquetaTipo(t)}</option>)}</optgroup>)}
              </select>
            </div>
          </div>
          {sanitario && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="prod-pa">Principio activo</Label><Input id="prod-pa" maxLength={180} value={form.principioActivo} onChange={set("principioActivo")} /></div>
              <div className="space-y-1.5"><Label htmlFor="prod-dosis">Dosis de referencia</Label><Input id="prod-dosis" maxLength={180} placeholder="Ej.: 1 ml cada 50 kg" value={form.dosisReferencia} onChange={set("dosisReferencia")} /></div>
              <div className="space-y-1.5"><Label htmlFor="prod-retiro">Días de retiro (carne)</Label><Input id="prod-retiro" type="number" min="0" max="3650" value={form.retiroDias} onChange={set("retiroDias")} /></div>
            </div>
          )}
          <div className="space-y-1.5"><Label htmlFor="prod-lab">{sanitario ? "Laboratorio" : "Marca / fabricante"} (opcional)</Label><Input id="prod-lab" maxLength={180} value={form.laboratorio} onChange={set("laboratorio")} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cfg-unidad">Unidad de stock</Label>
              <Input id="cfg-unidad" list="cfg-unidades" required maxLength={30} value={form.unidad} onChange={set("unidad")} />
              <datalist id="cfg-unidades">{UNIDADES_SUGERIDAS.map((u) => <option key={u} value={u} />)}</datalist>
            </div>
            <div className="space-y-1.5"><Label htmlFor="cfg-minimo">Stock mínimo</Label><Input id="cfg-minimo" type="number" min="0" step="0.001" inputMode="decimal" placeholder="Sin alerta" value={form.stockMinimo} onChange={set("stockMinimo")} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <div className="space-y-1.5"><Label htmlFor="cfg-costo">Costo de referencia por {form.unidad || "unidad"}</Label><Input id="cfg-costo" type="number" min="0" step="0.01" inputMode="decimal" placeholder="Opcional" value={form.costoReferencia} onChange={set("costoReferencia")} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="cfg-moneda">Moneda</Label>
              <select id="cfg-moneda" className={selectClass} value={form.monedaCosto} onChange={set("monedaCosto")}><option value="ARS">ARS</option><option value="USD">USD</option></select>
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="prod-notas">Notas (opcional)</Label><Input id="prod-notas" maxLength={2000} value={form.notas} onChange={set("notas")} /></div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          {producto ? (producto.activo ? (
            <Button type="button" variant="ghost" className="text-destructive" disabled={guardando} onClick={() => window.confirm(`¿Archivar ${producto.nombre}? Deja de ofrecerse en movimientos y aplicaciones.`) && guardar({ activo: false }, "Producto archivado")}>Archivar</Button>
          ) : (
            <Button type="button" variant="outline" disabled={guardando} onClick={() => guardar({ activo: true }, "Producto reactivado")}>Reactivar</Button>
          )) : <span />}
          <Button type="submit" form="producto-form" disabled={guardando}>{guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{producto ? "Guardar" : "Crear producto"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Editar número, vencimiento, proveedor o costo de un lote (la cantidad cambia con movimientos). */
export function EditarLoteDialog({ productoId, lote, onOpenChange, onGuardado }: {
  productoId: string
  lote: { id: string; nroLote: string; vencimiento: string | null; proveedor: string | null; costo: number | null; moneda?: string } | null
  onOpenChange: (o: boolean) => void
  onGuardado: () => void
}) {
  const [form, setForm] = useState({ nroLote: "", vencimiento: "", proveedor: "", costo: "", moneda: "ARS" })
  const [guardando, setGuardando] = useState(false), [error, setError] = useState("")
  useEffect(() => { if (lote) { setError(""); setForm({ nroLote: lote.nroLote, vencimiento: lote.vencimiento?.slice(0, 10) ?? "", proveedor: lote.proveedor ?? "", costo: lote.costo?.toString() ?? "", moneda: lote.moneda ?? "ARS" }) } }, [lote])
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!lote) return
    setGuardando(true); setError("")
    try { await enviar(`/api/productos/${productoId}/lotes/${lote.id}`, "PATCH", { ...form, vencimiento: form.vencimiento || null }); toast.success("Lote actualizado"); onOpenChange(false); onGuardado() }
    catch (e) { setError(mensaje(e)); toast.error(mensaje(e)) } finally { setGuardando(false) }
  }
  return (
    <Dialog open={!!lote} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Editar lote {lote?.nroLote}</DialogTitle><DialogDescription>La cantidad no se edita: cambia con entradas, salidas y ajustes.</DialogDescription></DialogHeader>
        <form id="editar-lote" onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="el-nro">N.º de lote</Label><Input id="el-nro" required maxLength={80} value={form.nroLote} onChange={(e) => setForm({ ...form, nroLote: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="el-venc">Vencimiento</Label><Input id="el-venc" type="date" value={form.vencimiento} onChange={(e) => setForm({ ...form, vencimiento: e.target.value })} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="el-prov">Proveedor</Label><Input id="el-prov" maxLength={180} value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="el-costo">Costo por unidad</Label><div className="flex gap-2"><Input id="el-costo" type="number" min="0" step="0.01" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} /><select aria-label="Moneda del costo" className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}><option value="ARS">ARS</option><option value="USD">USD</option></select></div></div>
          </div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button><Button type="submit" form="editar-lote" disabled={guardando}>Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
