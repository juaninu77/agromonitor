"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { z } from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { CATEGORIAS, etiquetaFinanzas, MEDIOS_PAGO, SUBCATEGORIAS_IMPUESTO } from "@/lib/finanzas/constantes"
import { movimientoUpdateSchema } from "@/lib/finanzas/validation"
import { api, claves, hoyLocal, type Cuenta, type Movimiento } from "./api"

type Entrada = z.input<typeof movimientoUpdateSchema>
type Salida = z.output<typeof movimientoUpdateSchema>

export const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  campo: string
  cuentas: Cuenta[]
  tipoInicial?: "ingreso" | "egreso"
  movimiento?: Movimiento
}

function valoresIniciales(cuentas: Cuenta[], tipo: "ingreso" | "egreso", m?: Movimiento): Entrada {
  if (m) {
    return {
      cuentaId: m.cuentaId,
      tipo: m.tipo,
      categoria: m.categoria,
      subcategoria: m.subcategoria ?? "",
      fecha: m.fecha,
      importe: m.importe.toFixed(2),
      descripcion: m.descripcion,
      contraparte: m.contraparte ?? "",
      cuit: m.cuit ?? "",
      medioPago: m.medioPago ?? "",
      notas: m.notas ?? "",
      comprobanteId: m.comprobanteId ?? "",
    }
  }
  return {
    cuentaId: cuentas.find((c) => c.activa)?.id ?? "",
    tipo,
    categoria: "",
    subcategoria: "",
    fecha: hoyLocal(),
    importe: "",
    descripcion: "",
    contraparte: "",
    cuit: "",
    medioPago: "",
    notas: "",
    comprobanteId: "",
  }
}

export function MovimientoDialog({ open, onOpenChange, campo, cuentas, tipoInicial = "egreso", movimiento }: Props) {
  const queryClient = useQueryClient()
  const editando = !!movimiento
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Entrada, unknown, Salida>({
    resolver: zodResolver(movimientoUpdateSchema),
    defaultValues: valoresIniciales(cuentas, tipoInicial, movimiento),
  })

  const tipo = watch("tipo")
  const categoria = watch("categoria")
  const cuentaId = watch("cuentaId")
  const moneda = cuentas.find((c) => c.id === cuentaId)?.moneda ?? "ARS"
  // Al cambiar de ingreso a egreso la categoría deja de ser válida
  useEffect(() => {
    if (categoria && !CATEGORIAS[tipo as "ingreso" | "egreso"]?.includes(categoria)) setValue("categoria", "")
  }, [tipo, categoria, setValue])
  useEffect(() => {
    if (categoria !== "impuestos") setValue("subcategoria", "")
  }, [categoria, setValue])

  const guardar = useMutation({
    mutationFn: (datos: Salida) =>
      editando
        ? api(`/api/finanzas/movimientos/${movimiento!.id}`, { method: "PATCH", body: JSON.stringify(datos) })
        : api("/api/finanzas/movimientos", { method: "POST", body: JSON.stringify({ ...datos, establecimientoId: campo }) }),
    onSuccess: () => {
      toast.success(editando ? "Movimiento actualizado" : mensajeAlta(tipo))
      queryClient.invalidateQueries({ queryKey: claves.todo })
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Las cuentas desactivadas solo aparecen si ya eran la del movimiento
  const cuentasElegibles = cuentas.filter((c) => c.activa || c.id === movimiento?.cuentaId)
  const error = (campo: keyof Entrada) =>
    errors[campo]?.message ? (
      <p className="text-sm text-destructive" role="alert">
        {String(errors[campo]?.message)}
      </p>
    ) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar movimiento" : tipo === "ingreso" ? "Registrar ingreso" : "Registrar gasto"}</DialogTitle>
          <DialogDescription>
            {movimiento?.bajaId
              ? "Este ingreso se generó desde una venta de hacienda."
              : "Queda registrado en la cuenta elegida y suma al resumen del período."}
          </DialogDescription>
        </DialogHeader>

        <form id="movimiento-form" onSubmit={handleSubmit((d) => guardar.mutate(d))} className="space-y-4" noValidate>
          <fieldset className="grid grid-cols-2 gap-2" aria-label="Tipo de movimiento">
            {(["ingreso", "egreso"] as const).map((t) => (
              <label
                key={t}
                className={cn(
                  "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  tipo === t ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <input type="radio" value={t} {...register("tipo")} className="sr-only" />
                {t === "ingreso" ? "Ingreso" : "Gasto"}
              </label>
            ))}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mov-importe">Importe ({moneda})</Label>
              <Input id="mov-importe" inputMode="decimal" placeholder="0,00" autoFocus {...register("importe")} />
              {error("importe")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mov-fecha">Fecha</Label>
              <Input id="mov-fecha" type="date" {...register("fecha")} />
              {error("fecha")}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mov-descripcion">Descripción</Label>
            <Input
              id="mov-descripcion"
              placeholder={tipo === "ingreso" ? "Ej.: Venta de 20 novillos" : "Ej.: Gasoil para el tractor"}
              {...register("descripcion")}
            />
            {error("descripcion")}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mov-categoria">Categoría</Label>
              <select id="mov-categoria" className={selectClass} {...register("categoria")}>
                <option value="">Elegí una categoría</option>
                {CATEGORIAS[tipo as "ingreso" | "egreso"]?.map((c) => (
                  <option key={c} value={c}>
                    {etiquetaFinanzas(c)}
                  </option>
                ))}
              </select>
              {error("categoria")}
            </div>
            {categoria === "impuestos" && (
              <div className="space-y-1.5">
                <Label htmlFor="mov-subcategoria">Impuesto</Label>
                <select id="mov-subcategoria" className={selectClass} {...register("subcategoria")}>
                  <option value="">Elegí el impuesto</option>
                  {SUBCATEGORIAS_IMPUESTO.map((s) => (
                    <option key={s} value={s}>
                      {etiquetaFinanzas(s)}
                    </option>
                  ))}
                </select>
                {error("subcategoria")}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mov-cuenta">Cuenta</Label>
              <select id="mov-cuenta" className={selectClass} {...register("cuentaId")}>
                {cuentasElegibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda})
                  </option>
                ))}
              </select>
              {error("cuentaId")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mov-medio">Medio de pago (opcional)</Label>
              <select id="mov-medio" className={selectClass} {...register("medioPago")}>
                <option value="">Sin especificar</option>
                {MEDIOS_PAGO.map((m) => (
                  <option key={m} value={m}>
                    {etiquetaFinanzas(m)}
                  </option>
                ))}
              </select>
              {error("medioPago")}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mov-contraparte">{tipo === "ingreso" ? "Cliente / de quién" : "Proveedor / a quién"} (opcional)</Label>
              <Input id="mov-contraparte" {...register("contraparte")} />
              {error("contraparte")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mov-cuit">CUIT (opcional)</Label>
              <Input id="mov-cuit" inputMode="numeric" placeholder="20-12345678-9" {...register("cuit")} />
              {error("cuit")}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mov-notas">Notas (opcional)</Label>
            <Textarea id="mov-notas" rows={2} {...register("notas")} />
            {error("notas")}
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="movimiento-form" disabled={guardar.isPending}>
            {guardar.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function mensajeAlta(tipo: string) {
  return tipo === "ingreso" ? "Ingreso registrado" : "Gasto registrado"
}
