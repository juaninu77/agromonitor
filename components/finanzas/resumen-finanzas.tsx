"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ArrowDownRight, ArrowUpRight, FileClock, Scale, Wallet } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { etiquetaFinanzas, formatearImporte } from "@/lib/finanzas/constantes"
import { api, claves, etiquetaMes, PERIODOS, rangoDePeriodo, type Periodo, type Resumen } from "./api"
import { selectClass } from "./movimiento-dialog"

// Azul / ámbar: par distinguible con daltonismo (validado), a diferencia de verde / rojo.
const chartConfig = {
  ingresos: { label: "Ingresos", color: "hsl(var(--chart-1))" },
  egresos: { label: "Gastos", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig

const compacto = (n: number, moneda: string) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: moneda, notation: "compact", maximumFractionDigits: 1 }).format(n)

export function ResumenFinanzas({ campo }: { campo: string }) {
  const [periodo, setPeriodo] = useState<Periodo>("anio")
  const { desde, hasta } = rangoDePeriodo(periodo)
  const query = useQuery({
    queryKey: claves.resumen(campo, desde, hasta),
    queryFn: () =>
      api<{ data: Resumen }>(`/api/finanzas/resumen?establecimientoId=${campo}&desde=${desde}&hasta=${hasta}`).then((r) => r.data),
  })
  const [monedaElegida, setMoneda] = useState<string | null>(null)

  const r = query.data
  const monedas = r ? Object.keys(r.totales).sort() : ["ARS"]
  const moneda = monedaElegida && monedas.includes(monedaElegida) ? monedaElegida : monedas[0]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="res-periodo" className="text-sm font-medium">
            Período
          </label>
          <select
            id="res-periodo"
            className={cn(selectClass, "w-48")}
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
          >
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </div>
        {monedas.length > 1 && (
          <div className="space-y-1.5">
            <label htmlFor="res-moneda" className="text-sm font-medium">
              Moneda
            </label>
            <select id="res-moneda" className={cn(selectClass, "w-32")} value={moneda} onChange={(e) => setMoneda(e.target.value)}>
              {monedas.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {query.isLoading || !r ? (
        query.isError ? (
          <Card>
            <CardContent className="py-10 text-center text-destructive">{(query.error as Error).message}</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        )
      ) : (
        <Contenido r={r} moneda={moneda} />
      )}
    </div>
  )
}

function Contenido({ r, moneda }: { r: Resumen; moneda: string }) {
  const t = r.totales[moneda] ?? { ingresos: 0, egresos: 0, resultado: 0 }
  const saldo = r.cuentas.filter((c) => c.moneda === moneda).reduce((s, c) => s + c.saldo, 0)
  const mensual = r.mensual.filter((m) => m.moneda === moneda).map((m) => ({ ...m, etiqueta: etiquetaMes(m.mes) }))
  const gastos = r.porCategoria.filter((c) => c.moneda === moneda && c.tipo === "egreso")
  const ingresos = r.porCategoria.filter((c) => c.moneda === moneda && c.tipo === "ingreso")
  const impuestos = r.impuestos.filter((i) => i.moneda === moneda)
  const pendientes = r.pendientes.filter((p) => p.moneda === moneda)
  const porCobrar = pendientes.find((p) => p.sentido === "ingreso")
  const porPagar = pendientes.find((p) => p.sentido === "egreso")
  const hayMovimientos = t.ingresos > 0 || t.egresos > 0

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Ingresos" valor={formatearImporte(t.ingresos, moneda)} icono={ArrowUpRight} nota="del período" />
        <Kpi titulo="Gastos" valor={formatearImporte(t.egresos, moneda)} icono={ArrowDownRight} nota="del período, con impuestos" />
        <Kpi
          titulo="Resultado"
          valor={formatearImporte(t.resultado, moneda)}
          icono={Scale}
          nota={t.resultado >= 0 ? "ganancia del período" : "pérdida del período"}
          negativo={t.resultado < 0}
        />
        <Kpi titulo="Saldo en cuentas" valor={formatearImporte(saldo, moneda)} icono={Wallet} nota="hoy, cuentas activas" negativo={saldo < 0} />
      </div>

      {(porCobrar || porPagar) && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4 text-sm">
            <FileClock className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">Comprobantes pendientes en Administración:</span>
            {porCobrar && (
              <span>
                por cobrar <strong className="tabular-nums">{formatearImporte(porCobrar.total, moneda)}</strong> ({porCobrar.cantidad})
              </span>
            )}
            {porPagar && (
              <span>
                por pagar <strong className="tabular-nums">{formatearImporte(porPagar.total, moneda)}</strong> ({porPagar.cantidad})
              </span>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingresos y gastos por mes</CardTitle>
          <CardDescription>Las transferencias entre cuentas no se cuentan.</CardDescription>
        </CardHeader>
        <CardContent>
          {hayMovimientos ? (
            <ChartContainer config={chartConfig} className="h-72 w-full">
              <BarChart data={mensual} barGap={2} margin={{ left: 4, right: 4 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.4} />
                <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} width={64} fontSize={12} tickFormatter={(v) => compacto(v, moneda)} />
                <ChartTooltip
                  cursor={{ fillOpacity: 0.06 }}
                  content={
                    <ChartTooltipContent
                      formatter={(valor, nombre) => (
                        <div className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">{chartConfig[nombre as keyof typeof chartConfig]?.label}</span>
                          <span className="font-mono font-medium tabular-nums">{formatearImporte(Number(valor), moneda)}</span>
                        </div>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="egresos" fill="var(--color-egresos)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin ingresos ni gastos en el período.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Desglose titulo="Gastos por categoría" filas={gastos} total={t.egresos} moneda={moneda} color="bg-[hsl(var(--chart-3))]" />
        <Desglose titulo="Ingresos por categoría" filas={ingresos} total={t.ingresos} moneda={moneda} color="bg-[hsl(var(--chart-1))]" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impuestos pagados</CardTitle>
          <CardDescription>Gastos cargados con la categoría «Impuestos y tasas».</CardDescription>
        </CardHeader>
        <CardContent>
          {impuestos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay impuestos registrados en el período.</p>
          ) : (
            <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {impuestos.map((i) => (
                <div key={i.subcategoria} className="flex justify-between border-b py-1.5 text-sm last:border-0">
                  <dt>{etiquetaFinanzas(i.subcategoria)}</dt>
                  <dd className="font-medium tabular-nums">{formatearImporte(i.total, moneda)}</dd>
                </div>
              ))}
              <div className="flex justify-between py-1.5 text-sm font-semibold">
                <dt>Total impuestos</dt>
                <dd className="tabular-nums">{formatearImporte(impuestos.reduce((s, i) => s + i.total, 0), moneda)}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function Kpi({
  titulo,
  valor,
  icono: Icono,
  nota,
  negativo,
}: {
  titulo: string
  valor: string
  icono: typeof Wallet
  nota: string
  negativo?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
        <Icono className="h-4 w-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <div className={cn("text-xl font-bold tabular-nums lg:text-2xl", negativo && "text-destructive")}>{valor}</div>
        <p className="text-xs text-muted-foreground">{nota}</p>
      </CardContent>
    </Card>
  )
}

function Desglose({
  titulo,
  filas,
  total,
  moneda,
  color,
}: {
  titulo: string
  filas: Array<{ categoria: string; total: number }>
  total: number
  moneda: string
  color: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos en el período.</p>
        ) : (
          <ul className="space-y-3">
            {filas.map((f) => {
              const pct = total > 0 ? (f.total / total) * 100 : 0
              return (
                <li key={f.categoria} className="space-y-1">
                  <div className="flex justify-between gap-3 text-sm">
                    <span>{etiquetaFinanzas(f.categoria)}</span>
                    <span className="whitespace-nowrap tabular-nums">
                      {formatearImporte(f.total, moneda)} <span className="text-muted-foreground">· {pct.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted" aria-hidden>
                    <div className={cn("h-2 rounded-full", color)} style={{ width: `${Math.max(pct, 1)}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
