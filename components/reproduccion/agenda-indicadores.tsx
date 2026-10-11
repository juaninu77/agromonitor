"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CalendarClock, ClipboardList, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatoDia } from "@/lib/inventario/fechas"
import { TERMINOS_GRUPO, type TipoGrupo } from "@/lib/reproduccion/validation"
import type { Pendiente, TipoPendiente } from "@/lib/reproduccion/agenda"

export type PendienteAgenda = Pendiente & { tarea: { id: string; estado: string; asignadoA: { nombre: string; apellido: string } | null } | null }

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error ?? "No se pudo cargar")
  return b.data as T
}

const ETIQUETA_PENDIENTE: Record<TipoPendiente, string> = { tacto: "Tacto", parto: "Partos", senalada: "Señalada", destete: "Destete" }
const ACCION_PENDIENTE: Record<TipoPendiente, string> = { tacto: "Cargar tacto", parto: "Registrar parto", senalada: "Registrar señalada", destete: "Destetar" }

export function useAgenda(estId: string) {
  return useQuery({ queryKey: ["repro", "agenda", estId], queryFn: () => getJson<PendienteAgenda[]>(`/api/reproduccion/agenda?establecimientoId=${estId}`), enabled: !!estId, staleTime: 60_000 })
}

/** Agenda reproductiva (spec 03 §3.10): lo que hay que hacer, derivado de lo registrado. */
export function AgendaTab({ estId, puede, onAccion }: { estId: string; puede: (t: TipoPendiente) => boolean; onAccion: (p: PendienteAgenda) => void }) {
  const agenda = useAgenda(estId)
  const items = agenda.data ?? []
  const vencidas = items.filter((i) => i.vencida)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-5 w-5" aria-hidden />Agenda reproductiva</CardTitle>
        <CardDescription>
          Tactos, partos previstos, señaladas y destetes que vienen (60 días) o están atrasados, según lo registrado. Los que vencen en 30 días también están en Tareas
          y se completan solos al registrar el evento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {agenda.isPending ? <Loader2 className="h-6 w-6 animate-spin" aria-label="Cargando" />
          : agenda.isError ? <p role="alert" className="erp-error">{agenda.error.message}</p>
          : !items.length ? <p className="py-6 text-center text-muted-foreground">No hay tareas reproductivas pendientes.</p>
          : (
            <>
              {vencidas.length > 0 && <p className="mb-3 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300"><AlertTriangle className="h-4 w-4" aria-hidden />{vencidas.length} atrasadas</p>}
              <ul className="divide-y">
                {items.map((p) => (
                  <li key={p.clave} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span className="min-w-0">
                      <span className={`mr-2 tabular-nums ${p.vencida ? "font-medium text-amber-800 dark:text-amber-300" : "text-muted-foreground"}`}>{formatoDia(p.fecha)}</span>
                      <Badge variant="outline" className="mr-2">{ETIQUETA_PENDIENTE[p.tipo]}</Badge>
                      <strong>{p.titulo}</strong>{p.vencida && <Badge variant="outline" className="ml-2 border-amber-300 text-amber-800">Atrasado</Badge>}
                      <span className="block text-xs text-muted-foreground">
                        {p.detalle}{p.tarea ? ` · en Tareas${p.tarea.asignadoA ? ` (${p.tarea.asignadoA.nombre} ${p.tarea.asignadoA.apellido})` : ""}` : ""}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      {p.tarea && <Button size="sm" variant="ghost" asChild><Link href="/tareas"><ClipboardList className="mr-1 h-4 w-4" />Tarea</Link></Button>}
                      {puede(p.tipo) && <Button size="sm" variant="outline" onClick={() => onAccion(p)}>{ACCION_PENDIENTE[p.tipo]}</Button>}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
      </CardContent>
    </Card>
  )
}

interface IndicadorTorada {
  id: string; nombre: string; tipo: string; tipoGrupo: TipoGrupo; lote: string; especie: string; fechaInicio: string; fechaFin: string | null
  entoradas: number; servidas: number; tactadas: number; prenadas: number; paridas: number; abortos: number; nacidosVivos: number; nacidosMuertos: number; destetados: number; senalados: number
  porcentaje: { prenez: number | null; paricion: number | null; destete: number | null; senalada: number | null; mellizos: number | null }
  perdidas: { tactoParto: number | null; partoDestete: number | null; preSenalada: number | null }
  distribucion: { cabeza: number | null; cuerpo: number | null; cola: number | null; partos: number } | null
  kgDestetadosPorHembra: number | null
}
export interface Indicadores { toradas: IndicadorTorada[]; intervaloEntrePartos: { dias: number; casos: number } | null }

const p = (v: number | null) => (v == null ? <span className="text-muted-foreground">—</span> : `${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`)
const TRAMOS = [["cabeza", "Cabeza", "hsl(var(--chart-1))"], ["cuerpo", "Cuerpo", "hsl(var(--chart-2))"], ["cola", "Cola", "hsl(var(--chart-3))"]] as const

/** Barra apilada de cabeza/cuerpo/cola de parición, con los valores en texto. */
function Distribucion({ d }: { d: NonNullable<IndicadorTorada["distribucion"]> }) {
  const texto = TRAMOS.map(([k, l]) => `${l} ${d[k] ?? 0} %`).join(" · ")
  return (
    <div className="min-w-[140px]" title={`${texto} (${d.partos} partos)`}>
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded" role="img" aria-label={texto}>
        {TRAMOS.map(([k, , color]) => (d[k] ? <span key={k} style={{ width: `${d[k]}%`, background: color }} className="first:rounded-l last:rounded-r" /> : null))}
      </div>
      <span className="mt-1 block text-[11px] text-muted-foreground tabular-nums">{TRAMOS.map(([k]) => d[k] ?? 0).join(" / ")}</span>
    </div>
  )
}

/** Indicadores reproductivos por torada/encarnerada (spec 03 §3.5). */
export function IndicadoresTab({ estId, informes }: { estId: string; informes?: React.ReactNode }) {
  const q = useQuery({ queryKey: ["repro", "indicadores", estId], queryFn: () => getJson<Indicadores>(`/api/reproduccion/indicadores?establecimientoId=${estId}`), enabled: !!estId, staleTime: 60_000 })
  const d = q.data
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-1"><CardDescription>Intervalo entre partos (3 años)</CardDescription>
          <CardTitle className="text-2xl">{d ? (d.intervaloEntrePartos ? `${d.intervaloEntrePartos.dias} días` : "—") : "…"}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">{d?.intervaloEntrePartos ? `${d.intervaloEntrePartos.casos} intervalos medidos · ideal en bovinos: 365 días` : "Necesita dos partos de la misma madre"}</CardContent></Card>
        <Card className="sm:col-span-2"><CardHeader className="pb-1"><CardDescription>Cómo se calcula</CardDescription></CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Los porcentajes son sobre las hembras entoradas (las cargadas en la torada o las servidas en ella). Preñez según el último tacto; parición, partos en la ventana de
            la gestación; cabeza/cuerpo/cola: partos en los primeros 21 días, los 21 siguientes y el resto desde inicio + gestación. Señalada (ovinos): referencia patagónica 75–85 %.
          </CardContent></Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div><CardTitle className="text-base">Por torada y encarnerada</CardTitle><CardDescription>Cada torada es una campaña: de arriba hacia abajo, de la más nueva a la más vieja.</CardDescription></div>
          {informes}
        </CardHeader>
        <CardContent>
          {q.isPending ? <Loader2 className="h-6 w-6 animate-spin" aria-label="Cargando" />
            : q.isError ? <p role="alert" className="erp-error">{q.error.message}</p>
            : !d?.toradas.length ? <p className="py-6 text-center text-muted-foreground">No hay toradas registradas.</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-2 py-2 font-medium">Torada</th><th className="px-2 py-2 text-right font-medium">Entoradas</th>
                      <th className="px-2 py-2 text-right font-medium">% Preñez</th><th className="px-2 py-2 text-right font-medium">% Parición</th>
                      <th className="px-2 py-2 text-right font-medium">% Destete / señalada</th><th className="px-2 py-2 text-right font-medium">Pérdida tacto→parto</th>
                      <th className="px-2 py-2 text-right font-medium">Pérdida parto→destete</th><th className="px-2 py-2 text-right font-medium">Mellizos</th>
                      <th className="px-2 py-2 font-medium">Cabeza / cuerpo / cola</th><th className="px-2 py-2 text-right font-medium">Kg destetados por hembra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.toradas.map((t) => {
                      const ovino = t.tipoGrupo === "encarnerada"
                      return (
                        <tr key={t.id} className="border-b last:border-0 align-top">
                          <td className="px-2 py-2">
                            <span className="font-medium">{t.nombre}</span>
                            <span className="block text-xs text-muted-foreground">{TERMINOS_GRUPO[t.tipoGrupo]?.grupo ?? "Torada"} · {t.lote} · desde {formatoDia(t.fechaInicio)}</span>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">{t.entoradas}</td>
                          <td className="px-2 py-2 text-right tabular-nums" title={`${t.prenadas} preñadas de ${t.tactadas} tactadas`}>{p(t.porcentaje.prenez)}</td>
                          <td className="px-2 py-2 text-right tabular-nums" title={`${t.paridas} paridas${t.abortos ? ` · ${t.abortos} abortos` : ""}`}>{p(t.porcentaje.paricion)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{ovino ? <span title={`${t.senalados} corderos señalados`}>{p(t.porcentaje.senalada)} <span className="text-xs text-muted-foreground">señal.</span></span> : <span title={`${t.destetados} destetados`}>{p(t.porcentaje.destete)}</span>}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{p(t.perdidas.tactoParto)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{p(t.perdidas.partoDestete)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{p(t.porcentaje.mellizos)}</td>
                          <td className="px-2 py-2">{t.distribucion ? <Distribucion d={t.distribucion} /> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{t.kgDestetadosPorHembra != null ? `${t.kgDestetadosPorHembra.toLocaleString("es-AR")} kg` : <span className="text-muted-foreground">—</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Referencias">
                  {TRAMOS.map(([k, l, color]) => <span key={k} className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />{l}</span>)}
                  <span>«—»: todavía sin datos para calcularlo</span>
                </p>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  )
}
