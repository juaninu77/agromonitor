"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Banknote, CreditCard, Landmark, Pencil, Plus, Smartphone, Trash2, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { etiquetaFinanzas, formatearImporte } from "@/lib/finanzas/constantes"
import { api, claves, type Cuenta } from "./api"
import { CuentaDialog } from "./cuenta-dialog"

const ICONOS: Record<string, typeof Wallet> = {
  caja: Banknote,
  banco: Landmark,
  billetera: Smartphone,
  tarjeta: CreditCard,
  otro: Wallet,
}

export function CuentasFinanzas({ campo, cuentas, cargando }: { campo: string; cuentas: Cuenta[]; cargando: boolean }) {
  const queryClient = useQueryClient()
  const [editar, setEditar] = useState<Cuenta | "nueva" | null>(null)

  const eliminar = useMutation({
    mutationFn: (id: string) => api(`/api/finanzas/cuentas/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Cuenta eliminada")
      queryClient.invalidateQueries({ queryKey: claves.todo })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const totales = cuentas
    .filter((c) => c.activa)
    .reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.moneda]: (acc[c.moneda] ?? 0) + c.saldo }), {})

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {Object.entries(totales).map(([moneda, total]) => (
            <p key={moneda}>
              <span className="text-muted-foreground">Total disponible {moneda}: </span>
              <span className={cn("font-semibold tabular-nums", total < 0 && "text-destructive")}>{formatearImporte(total, moneda)}</span>
            </p>
          ))}
        </div>
        <Button onClick={() => setEditar("nueva")}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Nueva cuenta
        </Button>
      </div>

      {cargando ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : cuentas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Todavía no hay cuentas. Creá la caja del campo o tu cuenta bancaria para empezar a registrar movimientos.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cuentas.map((c) => {
            const Icono = ICONOS[c.tipo] ?? Wallet
            return (
              <Card key={c.id} className={cn(!c.activa && "opacity-60")}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icono className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate">{c.nombre}</span>
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {etiquetaFinanzas(c.tipo)}
                      {c.banco ? ` · ${c.banco}` : ""}
                      {c.numero ? ` · ${c.numero}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {!c.activa && <Badge variant="secondary">Inactiva</Badge>}
                    <Badge variant="outline">{c.moneda}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className={cn("text-2xl font-bold tabular-nums", c.saldo < 0 && "text-destructive")}>
                    {formatearImporte(c.saldo, c.moneda)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.cantidadMovimientos} {c.cantidadMovimientos === 1 ? "movimiento" : "movimientos"} · saldo inicial{" "}
                    {formatearImporte(c.saldoInicial, c.moneda)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditar(c)} aria-label={`Editar ${c.nombre}`}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Editar
                    </Button>
                    {c.cantidadMovimientos === 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={eliminar.isPending}
                        onClick={() => {
                          if (window.confirm(`¿Eliminar la cuenta «${c.nombre}»?`)) eliminar.mutate(c.id)
                        }}
                        aria-label={`Eliminar ${c.nombre}`}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        Eliminar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {editar && (
        <CuentaDialog
          open
          onOpenChange={(o) => !o && setEditar(null)}
          campo={campo}
          cuenta={editar === "nueva" ? undefined : editar}
        />
      )}
    </div>
  )
}
