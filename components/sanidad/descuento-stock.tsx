"use client"

import { useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { consumoSugerido } from "@/lib/inventario/consumo"

export interface ProductoConStock {
  id: string
  nombre: string
  unidad?: string
  stockTotal?: number
  lotes: { id: string; nroLote: string; saldo?: number; vencido?: boolean }[]
}

export interface EstadoDescuento {
  activo: boolean
  cantidad: string
  loteProductoId: string
  /** El usuario editó la cantidad: no se recalcula sola */
  manual: boolean
}

export const descuentoInicial: EstadoDescuento = { activo: true, cantidad: "", loteProductoId: "", manual: false }

/**
 * Bloque «Descontar del stock» de una aplicación sanitaria: sugiere la cantidad en la
 * unidad del producto (dosis × animales cuando se puede) y permite elegir el lote.
 */
export function DescuentoStock({ producto, dosis, unidadDosis, animales, valor, onChange, porAnimal = 0 }: {
  producto: ProductoConStock | undefined
  dosis: string
  unidadDosis: string
  animales: number
  valor: EstadoDescuento
  onChange: (v: EstadoDescuento) => void
  /** Aplicación masiva: la cantidad es por animal y se repite para tantos animales */
  porAnimal?: number
}) {
  const sugerido = producto ? consumoSugerido(producto.unidad ?? "", dosis ? Number(dosis) : null, unidadDosis || null, animales) : null
  useEffect(() => {
    if (!valor.manual) onChange({ ...valor, cantidad: sugerido != null ? String(sugerido) : "" })
  }, [sugerido, producto?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!producto) return null
  const stock = producto.stockTotal ?? 0
  const lotes = producto.lotes.filter((l) => (l.saldo ?? 0) > 0)
  const total = valor.cantidad !== "" ? Number(valor.cantidad) * (porAnimal || 1) : 0
  const falta = valor.activo && total > stock
  return (
    <div className="space-y-2 rounded-md border p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={valor.activo} onChange={(e) => onChange({ ...valor, activo: e.target.checked })} />
        Descontar del stock
        <span className="font-normal text-muted-foreground">· hay {stock.toLocaleString("es-AR")} {producto.unidad}</span>
      </label>
      {valor.activo && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="desc-cant" className="text-xs">Cantidad ({producto.unidad}){porAnimal ? " por animal" : ""}</Label>
            <Input id="desc-cant" type="number" min="0.001" step="0.001" inputMode="decimal" value={valor.cantidad}
              onChange={(e) => onChange({ ...valor, cantidad: e.target.value, manual: true })}
              placeholder={sugerido == null ? "Indicá cuánto se usó" : undefined} />
            {porAnimal > 0 && valor.cantidad !== "" && <p className="text-xs text-muted-foreground">Total: {total.toLocaleString("es-AR")} {producto.unidad} para {porAnimal} animales</p>}
            {sugerido == null && <p className="text-xs text-muted-foreground">No se puede calcular desde la dosis: indicá cuánto stock se usó.</p>}
            {falta && <p className="text-xs text-destructive">No alcanza el stock: registrá una entrada o desmarcá el descuento.</p>}
          </div>
          {lotes.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="desc-lote" className="text-xs">Lote</Label>
              <select id="desc-lote" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={valor.loteProductoId} onChange={(e) => onChange({ ...valor, loteProductoId: e.target.value })}>
                <option value="">Automático (el que vence antes)</option>
                {lotes.map((l) => <option key={l.id} value={l.id}>{l.nroLote} · {(l.saldo ?? 0).toLocaleString("es-AR")}{l.vencido ? " (vencido)" : ""}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Campos del pedido a /api/sanidad según el bloque de descuento. */
export function camposDescuento(v: EstadoDescuento, aceptarVencido = false) {
  if (!v.activo || !v.cantidad) return {}
  return { descontarStock: v.cantidad, ...(v.loteProductoId ? { loteProductoId: v.loteProductoId } : {}), ...(aceptarVencido ? { aceptarVencido: true } : {}) }
}

/**
 * Registra una aplicación sanitaria. Si el lote del producto está vencido, pide
 * confirmación y reintenta aceptándolo.
 */
export async function postSanidad(payload: Record<string, unknown>, url = "/api/sanidad") {
  const enviar = (extra: Record<string, unknown> = {}) =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, ...extra }) })
  let res = await enviar()
  let json = await res.json().catch(() => ({}))
  if (res.status === 409 && json.codigo === "lote_vencido") {
    if (!window.confirm(`${json.error}\n\n¿Registrar la aplicación igual?`)) throw new Error("Aplicación cancelada: el lote está vencido")
    res = await enviar({ aceptarVencido: true })
    json = await res.json().catch(() => ({}))
  }
  if (!res.ok) throw new Error(json.error || "Error al registrar")
  return json
}

/** " · se descontaron 5 ml del stock" (o nada si no se descontó). */
export function textoStock(stock?: { descontado: number; unidad: string } | null) {
  return stock && stock.descontado ? ` · se descontaron ${stock.descontado.toLocaleString("es-AR")} ${stock.unidad} del stock` : ""
}
