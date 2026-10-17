"use client"

import { useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { AlertTriangle, Bot, CircleDollarSign, MessageCircle, RefreshCw, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { PageHeading } from "@/components/ui/page-heading"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { CostosAnthropic, CostosMeta } from "@/lib/whatsapp/costos"
import type { MetricasWhatsapp } from "@/lib/whatsapp/metricas"

interface Datos {
  metricas: MetricasWhatsapp
  anthropic: CostosAnthropic
  meta: CostosMeta
  configuracion: { whatsapp: boolean; asistente: boolean; modelo: string; numero: string | null }
}

const PERIODOS = [7, 30, 90] as const

// Qué consulta cada herramienta del asistente, en palabras de la app
const HERRAMIENTA: Record<string, string> = {
  resumen_rodeo: "Rodeo (cabezas por categoría)",
  buscar_animal: "Buscar un animal",
  stock_insumos: "Stock de insumos",
  sanidad_resumen: "Sanidad del mes",
  animales_en_retiro: "Animales en retiro",
  plan_sanitario: "Plan sanitario",
  reproduccion_resumen: "Reproducción",
  agenda_reproductiva: "Agenda reproductiva",
  potreros: "Potreros y carga",
  tareas_pendientes: "Tareas pendientes",
  finanzas_resumen: "Finanzas",
}

const chartConsultas = { recibidos: { label: "Mensajes recibidos", color: "hsl(var(--chart-1))" } } satisfies ChartConfig
const chartCosto = { costoIaUsd: { label: "Costo estimado de Claude", color: "hsl(var(--chart-3))" } } satisfies ChartConfig

const entero = (n: number) => new Intl.NumberFormat("es-AR").format(Math.round(n))
const porcentaje = (n: number) => new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 0 }).format(n)
const segundos = (ms: number | null) => (ms == null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(ms / 1000)} s`)

/** Montos chicos (centavos de dólar por consulta) necesitan más decimales para no verse como 0. */
function dinero(valor: number, moneda = "USD") {
  const decimales = valor !== 0 && Math.abs(valor) < 1 ? 3 : 2
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: moneda, minimumFractionDigits: 2, maximumFractionDigits: decimales }).format(valor)
}

/** Eje en dólares: dos decimales, sin el prefijo «US$» que no entra al costado del gráfico. */
const ejeDolares = (v: number) => `$${new Intl.NumberFormat("es-AR", { minimumFractionDigits: v ? 2 : 0, maximumFractionDigits: 2 }).format(v)}`

const diaCorto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
const diaLargo = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })

async function cargar(dias: number): Promise<Datos> {
  const r = await fetch(`/api/whatsapp/metricas?dias=${dias}`)
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error ?? "No se pudo cargar el uso del asistente")
  return b.data as Datos
}

/** Uso y gasto del asistente de WhatsApp (solo administradores de la plataforma). */
export function UsoAsistente() {
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30)
  const q = useQuery({ queryKey: ["whatsapp-metricas", dias], queryFn: () => cargar(dias), staleTime: 60_000 })

  return (
    <div className="space-y-6">
      <PageHeading
        title="Asistente de WhatsApp"
        icon={MessageCircle}
        context="Configuración"
        description="Cuánto se usa el bot, qué le preguntan y cuánto cuesta en Claude y en WhatsApp."
        actions={
          <>
            <div role="group" aria-label="Período" className="inline-flex rounded-md border bg-muted/40 p-0.5">
              {PERIODOS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={dias === p}
                  onClick={() => setDias(p)}
                  className={cn(
                    "rounded px-3 py-1.5 text-sm transition-colors",
                    dias === p ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p} días
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={() => q.refetch()} disabled={q.isFetching} aria-label="Actualizar">
              <RefreshCw className={cn("h-4 w-4", q.isFetching && "animate-spin")} />
            </Button>
          </>
        }
      />

      {q.isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">{q.error.message}</CardContent>
        </Card>
      ) : !q.data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
          <Skeleton className="h-72 sm:col-span-2 xl:col-span-4" />
        </div>
      ) : (
        <Contenido d={q.data} />
      )}
    </div>
  )
}

function Contenido({ d }: { d: Datos }) {
  const { metricas: m, anthropic, meta } = d
  const t = m.totales
  const claudeReal = anthropic.estado === "ok"
  const hayMensajes = t.recibidos > 0

  return (
    <>
      {!d.configuracion.whatsapp || !d.configuracion.asistente ? (
        <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <p>
              {!d.configuracion.whatsapp ? "Faltan variables de WhatsApp en Vercel: el bot no recibe mensajes." : "Falta ANTHROPIC_API_KEY en Vercel: el bot no puede responder consultas."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Consultas respondidas" valor={entero(t.consultasIa)} icono={MessageCircle} nota={`de ${entero(t.recibidos)} mensajes recibidos`} />
        <Kpi titulo="Personas que lo usaron" valor={entero(t.usuariosActivos)} icono={Users} nota={`${entero(t.vinculados)} ${t.vinculados === 1 ? "número vinculado" : "números vinculados"} en total`} />
        <Kpi
          titulo="Gasto en Claude"
          valor={dinero(claudeReal ? anthropic.totalUsd : t.costoIaUsd)}
          icono={Bot}
          nota={claudeReal ? "real, según Anthropic (toda la cuenta)" : "estimado por AgroMonitor"}
        />
        <Kpi
          titulo="Gasto en WhatsApp"
          valor={meta.estado === "ok" ? dinero(meta.total, meta.moneda) : "—"}
          icono={CircleDollarSign}
          nota={meta.estado === "ok" ? `${entero(meta.mensajes)} mensajes, ${entero(meta.mensajesGratis)} sin cargo` : meta.estado === "error" ? "no se pudo consultar a Meta" : "falta conectar con Meta"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mensajes recibidos por día</CardTitle>
            <CardDescription>
              {entero(t.recibidos)} en el período · {t.errores > 0 ? `${entero(t.errores)} con error` : "sin errores"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hayMensajes ? (
              <GraficoDiario datos={m.porDia} clave="recibidos" config={chartConsultas} formato={(v) => entero(v)} eje={(v) => entero(v)} />
            ) : (
              <Vacio texto="Todavía no llegaron mensajes en este período." />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Costo estimado de Claude por día</CardTitle>
            <CardDescription>
              {dinero(t.costoIaUsd)} en el período · {t.consultasIa > 0 ? `${dinero(t.costoIaUsd / t.consultasIa)} por consulta` : "sin consultas"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {t.costoIaUsd > 0 ? (
              <GraficoDiario datos={m.porDia} clave="costoIaUsd" config={chartCosto} formato={(v) => dinero(v)} eje={ejeDolares} />
            ) : (
              <Vacio texto="Sin consultas a Claude registradas en este período." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quién lo usa</CardTitle>
            <CardDescription>Las 10 personas con más consultas</CardDescription>
          </CardHeader>
          <CardContent>
            {m.porUsuario.length === 0 ? (
              <Vacio texto="Nadie lo usó en este período." />
            ) : (
              <ul className="divide-y text-sm">
                {m.porUsuario.map((u) => (
                  <li key={u.usuarioId} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium capitalize">{u.nombre}</p>
                      <p className="text-xs text-muted-foreground">último uso {fechaHora(u.ultimo)}</p>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <p>{entero(u.consultas)} {u.consultas === 1 ? "mensaje" : "mensajes"}</p>
                      <p className="text-xs text-muted-foreground">{dinero(u.costoIaUsd)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Qué le preguntan</CardTitle>
            <CardDescription>Datos que consultó el asistente para responder</CardDescription>
          </CardHeader>
          <CardContent>
            {m.herramientas.length === 0 ? (
              <Vacio texto="Todavía no hay consultas con datos del campo." />
            ) : (
              <Barras filas={m.herramientas.map((h) => ({ clave: h.nombre, etiqueta: HERRAMIENTA[h.nombre] ?? h.nombre, valor: h.usos, texto: entero(h.usos) }))} color="bg-[hsl(var(--chart-1))]" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por campo</CardTitle>
            <CardDescription>Costo estimado de Claude según el campo activo</CardDescription>
          </CardHeader>
          <CardContent>
            {m.porCampo.length === 0 ? (
              <Vacio texto="Sin consultas por campo en este período." />
            ) : (
              <Barras
                filas={m.porCampo.map((c) => ({ clave: c.establecimientoId, etiqueta: c.campo, detalle: c.organizacion, valor: c.costoIaUsd, texto: `${dinero(c.costoIaUsd)} · ${entero(c.consultas)}` }))}
                color="bg-[hsl(var(--chart-3))]"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Proveedor
          titulo="Anthropic (Claude)"
          estado={anthropic.estado}
          mensaje={anthropic.mensaje}
          total={anthropic.estado === "ok" ? dinero(anthropic.totalUsd) : null}
          notaTotal="facturado en el período, toda la cuenta de Anthropic"
          sinConfigurar={
            <>
              Para ver el gasto <strong>real</strong>, creá una clave de administrador en console.anthropic.com → Settings → Admin keys y cargala en Vercel como{" "}
              <code className="rounded bg-muted px-1">ANTHROPIC_ADMIN_KEY</code>. Mientras tanto se muestra el estimado de AgroMonitor: {dinero(t.costoIaUsd)}.
            </>
          }
          filas={anthropic.porTipo.map((p) => ({ clave: p.tipo, etiqueta: p.tipo, valor: p.usd, texto: dinero(p.usd) }))}
          color="bg-[hsl(var(--chart-3))]"
          pie={anthropic.estado === "ok" && anthropic.porModelo.length > 0 ? `Por modelo: ${anthropic.porModelo.map((p) => `${p.modelo} ${dinero(p.usd)}`).join(" · ")}` : undefined}
        />
        <Proveedor
          titulo="Meta (WhatsApp)"
          estado={meta.estado}
          mensaje={meta.mensaje}
          total={meta.estado === "ok" ? dinero(meta.total, meta.moneda) : null}
          notaTotal={`${entero(meta.mensajes)} mensajes del bot, ${entero(meta.mensajesGratis)} sin cargo`}
          sinConfigurar={
            <>
              Cargá en Vercel <code className="rounded bg-muted px-1">WHATSAPP_WABA_ID</code> con el «Identificador de la cuenta de WhatsApp Business» (Meta → WhatsApp → Configuración de la API). Usa el mismo token del bot.
            </>
          }
          filas={meta.porCategoria.map((c) => ({ clave: c.categoria, etiqueta: c.categoria, valor: c.mensajes, texto: `${entero(c.mensajes)} · ${dinero(c.costo, meta.moneda)}` }))}
          color="bg-[hsl(var(--chart-1))]"
          pie="Las respuestas dentro de las 24 h de que la persona escribe son de categoría «Servicio»."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rendimiento</CardTitle>
            <CardDescription>Modelo {d.configuracion.modelo}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Dato titulo="Tiempo de respuesta" valor={segundos(t.latenciaMedianaMs)} nota={`9 de cada 10 en menos de ${segundos(t.latenciaP90Ms)}`} />
              <Dato titulo="Entrada leída de caché" valor={t.aciertoCache == null ? "—" : porcentaje(t.aciertoCache)} nota="más alto, más barato" />
              <Dato titulo="Tokens de entrada" valor={entero(t.tokensEntrada + t.tokensCacheLeidos + t.tokensCacheEscritos)} nota={`${entero(t.tokensCacheLeidos)} desde caché`} />
              <Dato titulo="Tokens de salida" valor={entero(t.tokensSalida)} nota={t.consultasIa ? `${entero(t.tokensSalida / t.consultasIa)} por consulta` : "—"} />
            </dl>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Errores recientes</CardTitle>
              <CardDescription>Mensajes que el bot no pudo procesar o responder</CardDescription>
            </div>
            {m.errores.length > 0 && <Badge variant="outline">{entero(t.errores)}</Badge>}
          </CardHeader>
          <CardContent>
            {m.errores.length === 0 ? (
              <Vacio texto="Sin errores en el período. 👍" />
            ) : (
              <ul className="divide-y text-sm">
                {m.errores.map((e, i) => (
                  <li key={`${e.fecha}-${i}`} className="grid grid-cols-[auto_1fr] gap-x-4 py-2">
                    <span className="tabular-nums text-muted-foreground">{fechaHora(e.fecha)}</span>
                    <span className="break-words">{e.error || "Error sin detalle"}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        El costo estimado sale de los tokens de cada consulta y los precios de Claude; el real lo informa Anthropic con unos minutos de demora y
        cubre toda la cuenta. Los días son de Argentina en lo propio y UTC en lo que informan Anthropic y Meta.
      </p>
    </>
  )
}

function Kpi({ titulo, valor, icono: Icono, nota }: { titulo: string; valor: string; icono: typeof Bot; nota: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
        <Icono className="h-4 w-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold tabular-nums lg:text-2xl">{valor}</div>
        <p className="text-xs text-muted-foreground">{nota}</p>
      </CardContent>
    </Card>
  )
}

function GraficoDiario({
  datos,
  clave,
  config,
  formato,
  eje,
}: {
  datos: MetricasWhatsapp["porDia"]
  clave: "recibidos" | "costoIaUsd"
  config: ChartConfig
  /** Valor exacto, para el tooltip */
  formato: (v: number) => string
  /** Valor corto, para el eje */
  eje: (v: number) => string
}) {
  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart data={datos} margin={{ left: 4, right: 4 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.4} />
        <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={12} tickFormatter={diaCorto} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} width={48} fontSize={12} allowDecimals={clave === "costoIaUsd"} tickCount={4} tickFormatter={(v) => eje(Number(v))} />
        <ChartTooltip
          cursor={{ fillOpacity: 0.06 }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => diaLargo(String(p?.[0]?.payload?.dia ?? ""))}
              formatter={(valor, nombre) => (
                <div className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">{config[String(nombre)]?.label}</span>
                  <span className="font-mono font-medium tabular-nums">{formato(Number(valor))}</span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey={clave} fill={`var(--color-${clave})`} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  )
}

interface FilaBarra { clave: string; etiqueta: string; detalle?: string; valor: number; texto: string }

/** Barras horizontales simples: una magnitud, un solo color, el valor escrito al lado. */
function Barras({ filas, color }: { filas: FilaBarra[]; color: string }) {
  const max = Math.max(...filas.map((f) => f.valor), 0)
  return (
    <ul className="space-y-3 text-sm">
      {filas.map((f) => (
        <li key={f.clave} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">
              {f.etiqueta}
              {f.detalle && <span className="text-xs text-muted-foreground"> · {f.detalle}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{f.texto}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted" aria-hidden>
            <div className={cn("h-full rounded-full", color)} style={{ width: `${max ? Math.max((f.valor / max) * 100, 2) : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Proveedor({
  titulo,
  estado,
  mensaje,
  total,
  notaTotal,
  sinConfigurar,
  filas,
  color,
  pie,
}: {
  titulo: string
  estado: "ok" | "sin_configurar" | "error"
  mensaje?: string
  total: string | null
  notaTotal: string
  sinConfigurar: ReactNode
  filas: FilaBarra[]
  color: string
  pie?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{titulo}</CardTitle>
          <CardDescription>{estado === "ok" ? notaTotal : "Gasto informado por el proveedor"}</CardDescription>
        </div>
        <Badge variant={estado === "ok" ? "secondary" : "outline"}>{estado === "ok" ? "Conectado" : estado === "error" ? "Con error" : "Sin conectar"}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {estado === "ok" ? (
          <>
            <p className="text-2xl font-bold tabular-nums">{total}</p>
            {filas.length > 0 ? <Barras filas={filas} color={color} /> : <Vacio texto="Sin gastos en el período." />}
            {pie && <p className="text-xs text-muted-foreground">{pie}</p>}
          </>
        ) : estado === "error" ? (
          <p className="text-sm text-destructive">No se pudo consultar: {mensaje}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{sinConfigurar}</p>
        )}
      </CardContent>
    </Card>
  )
}

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{titulo}</dt>
      <dd className="text-lg font-semibold tabular-nums">{valor}</dd>
      <dd className="text-xs text-muted-foreground">{nota}</dd>
    </div>
  )
}

function Vacio({ texto }: { texto: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{texto}</p>
}
