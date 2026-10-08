"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import type { z } from "zod"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatoDia, hoyArgentina } from "@/lib/inventario/fechas"
import { movimientoStockSchema } from "@/lib/inventario/validation"

type Entrada = z.input<typeof movimientoStockSchema>
type Salida = z.output<typeof movimientoStockSchema>

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  productos: { id: string; nombre: string; tipo: string; stockTotal: number; unidad: string; lotes: { id: string; nroLote: string; saldo: number; vencido: boolean; vencimiento: string | null }[] }[]
  onGuardado: () => void
}

/** Registrar entrada, salida o ajuste (con sentido) de un insumo. */
export function MovimientoStockDialog({ open, onOpenChange, productos, onGuardado }: Props) {
  const [errorServidor, setErrorServidor] = useState("")
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Entrada, unknown, Salida>({ resolver: zodResolver(movimientoStockSchema) })

  // Cada apertura es una operación nueva: clave nueva para que un doble envío no duplique
  useEffect(() => {
    if (!open) return
    setErrorServidor("")
    reset({ productoId: "", tipo: "entrada", sentido: null, cantidad: "" as unknown as number, motivo: "", fecha: hoyArgentina(), loteProductoId: null, clave: crypto.randomUUID() })
  }, [open, reset])

  const tipo = watch("tipo"), productoId = watch("productoId"), sentido = watch("sentido")
  useEffect(() => { if (tipo !== "ajuste") setValue("sentido", null) }, [tipo, setValue])
  const producto = productos.find((p) => p.id === productoId)
  const resta = tipo === "salida" || (tipo === "ajuste" && sentido === "restar")
  const lotesElegibles = (producto?.lotes ?? []).filter((l) => !resta || l.saldo > 0)
  useEffect(() => { setValue("loteProductoId", null) }, [productoId, setValue])

  async function guardar(datos: Salida) {
    setErrorServidor("")
    try {
      const res = await fetch("/api/inventario/movimientos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "No se pudo registrar el movimiento")
      toast.success("Movimiento registrado")
      onOpenChange(false)
      onGuardado()
    } catch (e) {
      const msg = e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sin conexión: no se registró el movimiento"
      setErrorServidor(msg)
      toast.error(msg)
    }
  }

  const error = (campo: keyof Entrada) =>
    errors[campo]?.message ? <p className="text-sm text-destructive" role="alert">{String(errors[campo]?.message)}</p> : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar movimiento de stock</DialogTitle>
          <DialogDescription>Las salidas y los ajustes que restan no pueden dejar el stock por debajo de cero.</DialogDescription>
        </DialogHeader>
        <form id="movimiento-stock-form" onSubmit={handleSubmit(guardar)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="mov-producto">Producto</Label>
            <select id="mov-producto" className={selectClass} {...register("productoId")}>
              <option value="">Seleccionar producto</option>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>)}
            </select>
            {producto && <p className="text-xs text-muted-foreground">Stock actual: {producto.stockTotal.toLocaleString("es-AR")} {producto.unidad}</p>}
            {error("productoId")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mov-tipo">Tipo de movimiento</Label>
              <select id="mov-tipo" className={selectClass} {...register("tipo")}>
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
                <option value="ajuste">Ajuste de inventario</option>
              </select>
              {error("tipo")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mov-fecha">Fecha</Label>
              <Input id="mov-fecha" type="date" max={hoyArgentina()} {...register("fecha")} />
              {error("fecha")}
            </div>
          </div>
          {tipo === "ajuste" && (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">El ajuste…</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="radio" value="sumar" {...register("sentido")} /> Suma (sobrante en el recuento)</label>
                <label className="flex items-center gap-2"><input type="radio" value="restar" {...register("sentido")} /> Resta (faltante, rotura, vencido)</label>
              </div>
              {error("sentido")}
            </fieldset>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="mov-cantidad">Cantidad</Label>
            <Input id="mov-cantidad" type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="Ej: 50" {...register("cantidad")} />
            {resta && producto && <p className="text-xs text-muted-foreground">Disponible: {producto.stockTotal.toLocaleString("es-AR")} {producto.unidad}</p>}
            {error("cantidad")}
          </div>
          {lotesElegibles.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="mov-lote">Lote (opcional)</Label>
              <select id="mov-lote" className={selectClass} {...register("loteProductoId", { setValueAs: (v) => v || null })}>
                <option value="">{resta ? "Automático: primero el que vence antes" : "Sin lote"}</option>
                {lotesElegibles.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nroLote} · saldo {l.saldo.toLocaleString("es-AR")}{l.vencimiento ? ` · vence ${formatoDia(l.vencimiento)}` : ""}{l.vencido ? " (vencido)" : ""}
                  </option>
                ))}
              </select>
              {error("loteProductoId")}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="mov-motivo">Motivo{tipo === "ajuste" ? "" : " (opcional)"}</Label>
            <Input id="mov-motivo" placeholder={tipo === "ajuste" ? "Ej: recuento del 30/09, frasco roto…" : "Ej: compra a proveedor, uso en sanidad…"} {...register("motivo")} />
            {error("motivo")}
          </div>
          {errorServidor && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive" role="alert">{errorServidor}</p>}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" form="movimiento-stock-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
