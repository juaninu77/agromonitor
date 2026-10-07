"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { z } from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { transferenciaSchema } from "@/lib/finanzas/validation"
import { api, claves, hoyLocal, type Cuenta } from "./api"
import { selectClass } from "./movimiento-dialog"

const formSchema = transferenciaSchema
type Entrada = z.input<typeof formSchema>
type Salida = z.output<typeof formSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  campo: string
  cuentas: Cuenta[]
}

export function TransferenciaDialog({ open, onOpenChange, campo, cuentas }: Props) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Entrada, unknown, Salida>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      establecimientoId: campo,
      cuentaOrigenId: cuentas[0]?.id ?? "",
      cuentaDestinoId: cuentas[1]?.id ?? "",
      fecha: hoyLocal(),
      importe: "",
      importeDestino: "",
      descripcion: "",
      notas: "",
    },
  })
  const origen = cuentas.find((c) => c.id === watch("cuentaOrigenId"))
  const destino = cuentas.find((c) => c.id === watch("cuentaDestinoId"))
  const monedasDistintas = !!origen && !!destino && origen.moneda !== destino.moneda

  const guardar = useMutation({
    mutationFn: (datos: Salida) =>
      api("/api/finanzas/transferencias", {
        method: "POST",
        body: JSON.stringify({ ...datos, importeDestino: monedasDistintas ? datos.importeDestino : null }),
      }),
    onSuccess: () => {
      toast.success("Transferencia registrada")
      queryClient.invalidateQueries({ queryKey: claves.todo })
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const error = (campo: keyof Entrada) =>
    errors[campo]?.message ? (
      <p className="text-sm text-destructive" role="alert">
        {String(errors[campo]?.message)}
      </p>
    ) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transferir entre cuentas</DialogTitle>
          <DialogDescription>
            Mueve dinero entre dos cuentas del campo (por ejemplo, depositar efectivo en el banco). No cuenta como ingreso ni
            gasto.
          </DialogDescription>
        </DialogHeader>
        <form id="transferencia-form" onSubmit={handleSubmit((d) => guardar.mutate(d))} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tr-origen">Desde</Label>
              <select id="tr-origen" className={selectClass} {...register("cuentaOrigenId")}>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda})
                  </option>
                ))}
              </select>
              {error("cuentaOrigenId")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-destino">Hacia</Label>
              <select id="tr-destino" className={selectClass} {...register("cuentaDestinoId")}>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda})
                  </option>
                ))}
              </select>
              {error("cuentaDestinoId")}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tr-importe">Importe que sale ({origen?.moneda ?? "ARS"})</Label>
              <Input id="tr-importe" inputMode="decimal" placeholder="0,00" {...register("importe")} />
              {error("importe")}
            </div>
            {monedasDistintas ? (
              <div className="space-y-1.5">
                <Label htmlFor="tr-importe-destino">Importe que entra ({destino?.moneda})</Label>
                <Input id="tr-importe-destino" inputMode="decimal" placeholder="0,00" {...register("importeDestino")} />
                {error("importeDestino")}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="tr-fecha">Fecha</Label>
                <Input id="tr-fecha" type="date" {...register("fecha")} />
                {error("fecha")}
              </div>
            )}
          </div>
          {monedasDistintas && (
            <div className="space-y-1.5">
              <Label htmlFor="tr-fecha-2">Fecha</Label>
              <Input id="tr-fecha-2" type="date" {...register("fecha")} />
              {error("fecha")}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="tr-descripcion">Descripción (opcional)</Label>
            <Input id="tr-descripcion" placeholder="Ej.: Depósito de la venta de terneros" {...register("descripcion")} />
            {error("descripcion")}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="transferencia-form" disabled={guardar.isPending}>
            {guardar.isPending ? "Guardando…" : "Transferir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
