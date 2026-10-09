"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DatosAplicacion, camposExtra, datosExtraIniciales } from "./datos-aplicacion"
import { DescuentoStock, descuentoInicial, postSanidad, textoStock, type EstadoDescuento, type ProductoConStock } from "./descuento-stock"
import { hoyArgentina } from "@/lib/inventario/fechas"
import { ETIQUETA_MOTIVO, ETIQUETA_VIA, MOTIVOS_SANIDAD, VIAS_SANIDAD } from "@/lib/sanidad/validation"

type Producto = ProductoConStock & { retiroDias?: number | null }
interface Opcion { id: string; nombre: string }

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const ESPECIES = [["", "Todas las especies"], ["bovino", "Bovinos"], ["ovino", "Ovinos"], ["equino", "Equinos"], ["caprino", "Caprinos"], ["porcino", "Porcinos"]] as const
const destinoVacio = { loteId: "", especie: "", categoriaId: "", sectorId: "" }

/**
 * Aplicación masiva: el mismo tratamiento a todos los animales activos del campo que
 * cumplan los filtros (grupo, especie, categoría, potrero). Se registra en una sola
 * operación del servidor, con un único descuento de stock.
 */
export function AplicacionMasivaDialog({ open, onOpenChange, estId, lotes, productos, onSuccess }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  estId: string
  lotes: Opcion[]
  productos: Producto[]
  onSuccess: () => void
}) {
  const [destino, setDestino] = useState(destinoVacio)
  const [form, setForm] = useState({ productoId: "", dosis: "", unidad: "ml", via: "", motivo: "preventivo", fecha: hoyArgentina(), observ: "" })
  const [extra, setExtra] = useState(datosExtraIniciales)
  const [descuento, setDescuento] = useState<EstadoDescuento>(descuentoInicial)
  const [clave, setClave] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setDestino(destinoVacio); setExtra(datosExtraIniciales); setDescuento(descuentoInicial); setError(""); setClave(crypto.randomUUID())
    setForm({ productoId: "", dosis: "", unidad: "ml", via: "", motivo: "preventivo", fecha: hoyArgentina(), observ: "" })
  }, [open])

  const categorias = useQuery({
    queryKey: ["categorias", destino.especie],
    queryFn: async () => { const r = await fetch(`/api/categorias${destino.especie ? `?especie=${destino.especie}` : ""}`); const b = await r.json(); return (b.data ?? []) as (Opcion & { especie?: { nombre: string } })[] },
    enabled: open, staleTime: 300_000,
  })
  const potreros = useQuery({
    queryKey: ["sectores", estId, "sanidad"],
    queryFn: async () => { const r = await fetch(`/api/sectores?establecimientoId=${estId}`); const b = await r.json(); return ((b.data ?? []) as (Opcion & { tipo: string; activo?: boolean })[]).filter((s) => s.activo !== false && !["galpon", "camino", "alambrado", "aguada", "tranquera"].includes(s.tipo)) },
    enabled: open && !!estId, staleTime: 60_000,
  })
  const destinoParams = new URLSearchParams({ establecimientoId: estId, ...Object.fromEntries(Object.entries(destino).filter(([, v]) => v)) })
  const conteo = useQuery({
    queryKey: ["sanidad", "destinos", destinoParams.toString()],
    queryFn: async () => { const r = await fetch(`/api/sanidad/destinos?${destinoParams}`); const b = await r.json(); if (!r.ok) throw new Error(b.error ?? "No se pudo contar"); return b.data as { cantidad: number; excede: boolean } },
    enabled: open && !!estId,
  })
  const cantidad = conteo.data?.cantidad ?? 0
  const producto = productos.find((p) => p.id === form.productoId)
  const sinFiltros = !destino.loteId && !destino.especie && !destino.categoriaId && !destino.sectorId
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })
  const setD = (k: keyof typeof destino) => (e: { target: { value: string } }) => setDestino({ ...destino, [k]: e.target.value, ...(k === "especie" ? { categoriaId: "" } : {}) })

  async function confirmar() {
    if (!form.productoId) return setError("Elegí el producto")
    if (!cantidad) return setError("No hay animales que cumplan esos filtros")
    if (sinFiltros && !window.confirm(`Sin filtros se aplica a los ${cantidad} animales activos del campo. ¿Continuar?`)) return
    setEnviando(true); setError("")
    try {
      const json = await postSanidad({
        clave, animalesEsperados: cantidad,
        destino: { establecimientoId: estId, ...Object.fromEntries(Object.entries(destino).filter(([, v]) => v)) },
        productoId: form.productoId, fecha: form.fecha, dosis: form.dosis || null, unidad: form.dosis ? form.unidad : null,
        via: form.via || null, motivo: form.motivo || null, observ: form.observ || null,
        ...camposExtra(extra, false),
        ...(descuento.activo && descuento.cantidad ? { descontarPorAnimal: descuento.cantidad, ...(descuento.loteProductoId ? { loteProductoId: descuento.loteProductoId } : {}) } : {}),
      }, "/api/sanidad/masiva")
      toast.success(`${json.data.cantidad} tratamientos registrados${textoStock(json.data.stock)}`)
      onOpenChange(false); onSuccess()
    } catch (e) {
      const m = e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sin conexión: no se registró"
      setError(m); toast.error(m)
      // Si cambió la cantidad de animales, recontar para que el usuario confirme de nuevo
      if (/Ahora son/.test(m)) void conteo.refetch()
    } finally { setEnviando(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-purple-600" />Aplicación masiva</DialogTitle>
          <DialogDescription>El mismo tratamiento a todos los animales activos que cumplan los filtros. Se registra todo junto: si algo falla, no se guarda nada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset className="space-y-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">A quiénes</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="am-grupo">Grupo</Label>
                <select id="am-grupo" className={selectClass} value={destino.loteId} onChange={setD("loteId")}><option value="">Todos los grupos</option>{lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="am-especie">Especie</Label>
                <select id="am-especie" className={selectClass} value={destino.especie} onChange={setD("especie")}>{ESPECIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="am-cat">Categoría</Label>
                <select id="am-cat" className={selectClass} value={destino.categoriaId} onChange={setD("categoriaId")}><option value="">Todas las categorías</option>{(categorias.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}{!destino.especie && c.especie ? ` (${c.especie.nombre})` : ""}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="am-potrero">Potrero o corral</Label>
                <select id="am-potrero" className={selectClass} value={destino.sectorId} onChange={setD("sectorId")}><option value="">Cualquier lugar</option>{(potreros.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>
            </div>
            <p role="status" className="text-sm">
              {conteo.isFetching ? <Loader2 className="inline h-4 w-4 animate-spin" /> : conteo.isError ? <span className="text-destructive">{conteo.error.message}</span> : <><strong>{cantidad}</strong> {cantidad === 1 ? "animal activo" : "animales activos"}{conteo.data?.excede ? " (demasiados: filtrá más)" : ""}{sinFiltros && cantidad ? " · todo el campo" : ""}</>}
            </p>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="am-prod">Producto *</Label>
              <select id="am-prod" className={selectClass} value={form.productoId} onChange={(e) => { setForm({ ...form, productoId: e.target.value }); setDescuento(descuentoInicial) }}>
                <option value="">Seleccionar producto</option>{productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select></div>
            <div className="space-y-1.5"><Label htmlFor="am-dosis">Dosis por animal</Label>
              <div className="flex gap-2"><Input id="am-dosis" type="number" min="0" step="0.1" inputMode="decimal" placeholder="Ej: 5" value={form.dosis} onChange={set("dosis")} />
                <select aria-label="Unidad de la dosis" className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={form.unidad} onChange={set("unidad")}><option value="ml">ml</option><option value="cc">cc</option><option value="comprimido">comp.</option></select></div></div>
            <div className="space-y-1.5"><Label htmlFor="am-via">Vía</Label>
              <select id="am-via" className={selectClass} value={form.via} onChange={set("via")}><option value="">—</option>{VIAS_SANIDAD.map((v) => <option key={v} value={v}>{ETIQUETA_VIA[v]}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="am-motivo">Motivo</Label>
              <select id="am-motivo" className={selectClass} value={form.motivo} onChange={set("motivo")}>{MOTIVOS_SANIDAD.map((m) => <option key={m} value={m}>{ETIQUETA_MOTIVO[m]}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="am-fecha">Fecha</Label><Input id="am-fecha" type="date" max={hoyArgentina()} value={form.fecha} onChange={set("fecha")} /></div>
          </div>
          <DatosAplicacion valor={extra} onChange={setExtra} retiroDias={producto?.retiroDias} conCosto={false} />
          <DescuentoStock producto={producto} dosis={form.dosis} unidadDosis={form.unidad} animales={1} porAnimal={cantidad} valor={descuento} onChange={setDescuento} />
          <div className="space-y-1.5"><Label htmlFor="am-obs">Observaciones</Label><Textarea id="am-obs" rows={2} maxLength={1000} value={form.observ} onChange={set("observ")} /></div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
            <Button onClick={confirmar} disabled={enviando || conteo.isFetching || !cantidad || !form.productoId}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Aplicar a {cantidad} {cantidad === 1 ? "animal" : "animales"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
