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
import { Textarea } from "@/components/ui/textarea"
import { etiquetaFinanzas, MONEDAS, TIPOS_CUENTA } from "@/lib/finanzas/constantes"
import { cuentaSchema } from "@/lib/finanzas/validation"
import { api, claves, type Cuenta } from "./api"
import { selectClass } from "./movimiento-dialog"

type Entrada = z.input<typeof cuentaSchema>
type Salida = z.output<typeof cuentaSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  campo: string
  cuenta?: Cuenta
}

export function CuentaDialog({ open, onOpenChange, campo, cuenta }: Props) {
  const queryClient = useQueryClient()
  const editando = !!cuenta
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Entrada, unknown, Salida>({
    resolver: zodResolver(cuentaSchema),
    defaultValues: {
      establecimientoId: campo,
      nombre: cuenta?.nombre ?? "",
      tipo: (cuenta?.tipo as Entrada["tipo"]) ?? "caja",
      moneda: (cuenta?.moneda as Entrada["moneda"]) ?? "ARS",
      banco: cuenta?.banco ?? "",
      numero: cuenta?.numero ?? "",
      saldoInicial: cuenta ? cuenta.saldoInicial.toFixed(2) : "0",
      activa: cuenta?.activa ?? true,
      notas: cuenta?.notas ?? "",
    },
  })
  const tipo = watch("tipo")
  const monedaBloqueada = editando && cuenta!.cantidadMovimientos > 0

  const guardar = useMutation({
    mutationFn: ({ establecimientoId, ...datos }: Salida) =>
      editando
        ? api(`/api/finanzas/cuentas/${cuenta!.id}`, {
            method: "PATCH",
            // Un select deshabilitado no envía valor: no tocar la moneda bloqueada
            body: JSON.stringify(monedaBloqueada ? { ...datos, moneda: undefined } : datos),
          })
        : api("/api/finanzas/cuentas", { method: "POST", body: JSON.stringify({ establecimientoId, ...datos }) }),
    onSuccess: () => {
      toast.success(editando ? "Cuenta actualizada" : "Cuenta creada")
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar cuenta" : "Nueva cuenta o caja"}</DialogTitle>
          <DialogDescription>El saldo se calcula solo, a partir del saldo inicial y los movimientos.</DialogDescription>
        </DialogHeader>
        <form id="cuenta-form" onSubmit={handleSubmit((d) => guardar.mutate(d))} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="cta-nombre">Nombre</Label>
            <Input id="cta-nombre" placeholder="Ej.: Caja del campo, Banco Nación CC" autoFocus {...register("nombre")} />
            {error("nombre")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cta-tipo">Tipo</Label>
              <select id="cta-tipo" className={selectClass} {...register("tipo")}>
                {TIPOS_CUENTA.map((t) => (
                  <option key={t} value={t}>
                    {etiquetaFinanzas(t)}
                  </option>
                ))}
              </select>
              {error("tipo")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cta-moneda">Moneda</Label>
              <select id="cta-moneda" className={selectClass} disabled={monedaBloqueada} {...register("moneda")}>
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m === "ARS" ? "Pesos (ARS)" : "Dólares (USD)"}
                  </option>
                ))}
              </select>
              {monedaBloqueada && <p className="text-xs text-muted-foreground">No se puede cambiar: la cuenta ya tiene movimientos.</p>}
              {error("moneda")}
            </div>
          </div>
          {(tipo === "banco" || tipo === "billetera" || tipo === "tarjeta") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cta-banco">{tipo === "banco" ? "Banco" : "Entidad"} (opcional)</Label>
                <Input id="cta-banco" {...register("banco")} />
                {error("banco")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cta-numero">{tipo === "banco" ? "CBU / alias / número" : "Número o alias"} (opcional)</Label>
                <Input id="cta-numero" {...register("numero")} />
                {error("numero")}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="cta-saldo">Saldo inicial</Label>
            <Input id="cta-saldo" inputMode="decimal" {...register("saldoInicial")} />
            <p className="text-xs text-muted-foreground">Lo que había en la cuenta antes del primer movimiento que cargues.</p>
            {error("saldoInicial")}
          </div>
          {editando && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" {...register("activa")} />
              Cuenta activa (las desactivadas no aparecen al registrar movimientos)
            </label>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="cta-notas">Notas (opcional)</Label>
            <Textarea id="cta-notas" rows={2} {...register("notas")} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="cuenta-form" disabled={guardar.isPending}>
            {guardar.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
