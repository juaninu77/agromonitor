"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeftRight, BarChart3, Landmark, ListOrdered, Minus, Plus, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTenant } from "@/lib/context/tenant-context"
import { api, ApiError, claves, type Cuenta } from "./api"
import { CuentasFinanzas } from "./cuentas-finanzas"
import { MovimientoDialog } from "./movimiento-dialog"
import { MovimientosFinanzas } from "./movimientos-finanzas"
import { ResumenFinanzas } from "./resumen-finanzas"
import { TransferenciaDialog } from "./transferencia-dialog"

type Pestania = "resumen" | "movimientos" | "cuentas"

export function FinanzasPanel() {
  const { establecimientoActivo, isLoading } = useTenant()
  if (isLoading) return <p className="p-6 text-muted-foreground">Cargando campos…</p>
  if (!establecimientoActivo) {
    return <p className="p-6 text-muted-foreground">Seleccioná o creá un campo en Configuración para comenzar.</p>
  }
  return <Workspace key={establecimientoActivo.id} campo={establecimientoActivo.id} nombreCampo={establecimientoActivo.nombre} />
}

function Workspace({ campo, nombreCampo }: { campo: string; nombreCampo: string }) {
  const [pestania, setPestania] = useState<Pestania>("resumen")
  const [nuevo, setNuevo] = useState<"ingreso" | "egreso" | null>(null)
  const [transferir, setTransferir] = useState(false)

  const cuentasQuery = useQuery({
    queryKey: claves.cuentas(campo),
    queryFn: () => api<{ data: Cuenta[] }>(`/api/finanzas/cuentas?establecimientoId=${campo}`).then((r) => r.data),
    retry: (n, error) => !(error instanceof ApiError && error.status === 403) && n < 2,
  })

  if (cuentasQuery.error instanceof ApiError && cuentasQuery.error.status === 403) {
    return (
      <div className="space-y-6">
        <Encabezado nombreCampo={nombreCampo} />
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Las finanzas de este campo solo las ven el administrador y el encargado de la organización.
          </CardContent>
        </Card>
      </div>
    )
  }

  const cuentas = cuentasQuery.data ?? []
  const cuentasActivas = cuentas.filter((c) => c.activa)
  const sinCuentas = cuentasQuery.isSuccess && cuentasActivas.length === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Encabezado nombreCampo={nombreCampo} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setNuevo("ingreso")} disabled={sinCuentas}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Ingreso
          </Button>
          <Button variant="outline" onClick={() => setNuevo("egreso")} disabled={sinCuentas}>
            <Minus className="mr-2 h-4 w-4" aria-hidden />
            Gasto
          </Button>
          <Button variant="outline" onClick={() => setTransferir(true)} disabled={cuentasActivas.length < 2}>
            <ArrowLeftRight className="mr-2 h-4 w-4" aria-hidden />
            Transferir
          </Button>
        </div>
      </div>

      {sinCuentas && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Empezá creando una caja o cuenta</p>
              <p className="text-sm text-muted-foreground">
                Cada ingreso y gasto se registra en una cuenta: la caja en efectivo, una cuenta bancaria o una billetera virtual.
              </p>
            </div>
            <Button onClick={() => setPestania("cuentas")}>
              <Landmark className="mr-2 h-4 w-4" aria-hidden />
              Crear cuenta
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={pestania} onValueChange={(v) => setPestania(v as Pestania)}>
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="resumen" className="gap-1.5">
            <BarChart3 className="h-4 w-4" aria-hidden />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="movimientos" className="gap-1.5">
            <ListOrdered className="h-4 w-4" aria-hidden />
            Movimientos
          </TabsTrigger>
          <TabsTrigger value="cuentas" className="gap-1.5">
            <Landmark className="h-4 w-4" aria-hidden />
            Cuentas
          </TabsTrigger>
        </TabsList>
        <TabsContent value="resumen" className="mt-4">
          <ResumenFinanzas campo={campo} />
        </TabsContent>
        <TabsContent value="movimientos" className="mt-4">
          <MovimientosFinanzas campo={campo} cuentas={cuentas} />
        </TabsContent>
        <TabsContent value="cuentas" className="mt-4">
          <CuentasFinanzas campo={campo} cuentas={cuentas} cargando={cuentasQuery.isLoading} />
        </TabsContent>
      </Tabs>

      {nuevo && (
        <MovimientoDialog
          open
          onOpenChange={(o) => !o && setNuevo(null)}
          campo={campo}
          cuentas={cuentas}
          tipoInicial={nuevo}
        />
      )}
      {transferir && <TransferenciaDialog open onOpenChange={setTransferir} campo={campo} cuentas={cuentasActivas} />}
    </div>
  )
}

function Encabezado({ nombreCampo }: { nombreCampo: string }) {
  return (
    <div>
      <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight md:text-3xl">
        <Wallet className="h-7 w-7 text-primary md:h-8 md:w-8" aria-hidden />
        Finanzas
      </h1>
      <p className="mt-1 text-muted-foreground">Ingresos, gastos, impuestos y saldos de {nombreCampo}</p>
    </div>
  )
}
