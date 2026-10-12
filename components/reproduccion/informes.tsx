"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import type { Indicadores } from "./agenda-indicadores"
import type { GrupoOpcion } from "./grupos-dialogos"
import { formatoDia, hoyArgentina } from "@/lib/inventario/fechas"
import { exportToExcel } from "@/lib/utils/export-excel"
import { exportarTablaPDF } from "@/lib/utils/export-pdf"
import { ETIQUETA_RESULTADO_TACTO, ETIQUETA_TIPO_SERVICIO, TERMINOS_GRUPO, type ResultadoTacto } from "@/lib/reproduccion/validation"

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error ?? "No se pudo cargar")
  return b.data as T
}
const nombreArchivo = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_").slice(0, 60)
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const textoMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10} %` : "—")

interface Hoja {
  torada: { nombre: string; tipoGrupo: string; fechaInicio: string; fechaFin: string | null; lote: { nombre: string } }
  filas: {
    hembra: string; categoria: string | null; servicios: number; ultimoServicio: string; tipo: string; macho: string | null
    tacto: { fecha: string; resultado: string; mesesGest: number | null; fechaProbableParto: string | null } | null
    parto: { fecha: string; resultado: string; crias: number } | null
  }[]
}

/** Hoja de servicio de una torada (spec 03 §3.11) en Excel o PDF. */
export async function exportarHojaDeServicio(toradaId: string, formato: "excel" | "pdf") {
  try {
    const h = await getJson<Hoja>(`/api/reproduccion/toradas/${toradaId}/hoja`)
    if (!h.filas.length) return toast.info("La torada todavía no tiene servicios cargados")
    const filas = h.filas.map((f) => [
      f.hembra, f.categoria ?? "", formatoDia(f.ultimoServicio) + (f.servicios > 1 ? ` (${f.servicios})` : ""), ETIQUETA_TIPO_SERVICIO[f.tipo as keyof typeof ETIQUETA_TIPO_SERVICIO] ?? f.tipo, f.macho ?? "",
      f.tacto ? ETIQUETA_RESULTADO_TACTO[f.tacto.resultado as ResultadoTacto] ?? f.tacto.resultado : "", f.tacto ? formatoDia(f.tacto.fecha) : "",
      f.tacto?.fechaProbableParto ? formatoDia(f.tacto.fechaProbableParto) : "", f.parto ? `${formatoDia(f.parto.fecha)} · ${f.parto.resultado}` : "",
    ])
    const columnas = ["Hembra", "Categoría", "Servicio", "Tipo", "Toro / carnero", "Tacto", "Fecha tacto", "Parto probable", "Parto"]
    const prenadas = h.filas.filter((f) => f.tacto?.resultado === "preñada").length, tactadas = h.filas.filter((f) => f.tacto).length
    const titulo = `Hoja de servicio · ${h.torada.nombre}`
    const subtitulo = `${TERMINOS_GRUPO[h.torada.tipoGrupo as keyof typeof TERMINOS_GRUPO]?.grupo ?? "Torada"} · ${h.torada.lote.nombre} · desde ${formatoDia(h.torada.fechaInicio)}${h.torada.fechaFin ? ` al ${formatoDia(h.torada.fechaFin)}` : ""} · ${h.filas.length} servidas · preñez parcial ${pct(prenadas, tactadas)} (${prenadas}/${tactadas})`
    const archivo = `hoja_servicio_${nombreArchivo(h.torada.nombre)}`
    if (formato === "pdf") exportarTablaPDF({ titulo, subtitulo, columnas, filas, archivo: `${archivo}.pdf`, horizontal: true })
    else exportToExcel({ filename: `${archivo}.xlsx`, sheetName: "Hoja de servicio", columns: columnas.map((c, i) => ({ header: c, key: String(i) })), data: filas.map((f) => Object.fromEntries(f.map((v, i) => [String(i), v]))) })
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "No se pudo exportar")
  }
}

export function MenuHoja({ toradaId }: { toradaId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button size="sm" variant="outline">Hoja de servicio</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void exportarHojaDeServicio(toradaId, "excel")}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void exportarHojaDeServicio(toradaId, "pdf")}><FileText className="mr-2 h-4 w-4" />PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Pronóstico de parición por mes (preñadas sin parir según su fecha probable). */
export function PronosticoCard({ estId }: { estId: string }) {
  const q = useQuery({ queryKey: ["repro", "pronostico", estId], queryFn: () => getJson<{ porMes: { mes: string; total: number; grupos: { grupo: string; cantidad: number }[] }[] }>(`/api/reproduccion/pronostico?establecimientoId=${estId}`), enabled: !!estId })
  const meses = q.data?.porMes ?? []
  const hoy = hoyArgentina().slice(0, 7)
  const exportar = () => exportToExcel({
    filename: `pronostico_partos_${hoyArgentina()}.xlsx`, sheetName: "Pronóstico",
    columns: [{ header: "Mes", key: "mes" }, { header: "Grupo", key: "grupo" }, { header: "Partos previstos", key: "cantidad" }],
    data: meses.flatMap((m) => m.grupos.map((g) => ({ mes: textoMes(m.mes), grupo: g.grupo, cantidad: g.cantidad }))),
  })
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div><CardTitle className="text-base">Pronóstico de parición</CardTitle><CardDescription>Preñadas sin parir, por mes de la fecha probable de parto.</CardDescription></div>
        {meses.length > 0 && <Button size="sm" variant="outline" onClick={exportar}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>}
      </CardHeader>
      <CardContent>
        {q.isPending ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Cargando" /> : !meses.length ? <p className="text-sm text-muted-foreground">No hay preñadas con fecha probable de parto.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left"><th className="py-1 font-medium">Mes</th><th className="py-1 font-medium">Grupos</th><th className="py-1 text-right font-medium">Partos</th></tr></thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes} className="border-b last:border-0">
                  <td className={`py-1.5 capitalize ${m.mes < hoy ? "text-amber-800 dark:text-amber-300" : ""}`}>{textoMes(m.mes)}{m.mes < hoy ? " (atrasado)" : ""}</td>
                  <td className="py-1.5 text-muted-foreground">{m.grupos.map((g) => `${g.grupo}: ${g.cantidad}`).join(" · ")}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{m.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}

/** Resumen de zafra interanual: las toradas sumadas por año de inicio. */
export function ZafraCard({ indicadores }: { indicadores: Indicadores | undefined }) {
  const porAnio = new Map<string, { entoradas: number; prenadas: number; paridas: number; destetados: number; senalados: number; nacidos: number }>()
  for (const t of indicadores?.toradas ?? []) {
    const a = t.fechaInicio.slice(0, 4)
    const g = porAnio.get(a) ?? { entoradas: 0, prenadas: 0, paridas: 0, destetados: 0, senalados: 0, nacidos: 0 }
    porAnio.set(a, { entoradas: g.entoradas + t.entoradas, prenadas: g.prenadas + t.prenadas, paridas: g.paridas + t.paridas, destetados: g.destetados + t.destetados, senalados: g.senalados + t.senalados, nacidos: g.nacidos + t.nacidosVivos })
  }
  const anios = [...porAnio.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  const columnas = ["Año", "Entoradas", "Preñadas", "% Preñez", "Paridas", "% Parición", "Nacidos vivos", "Destetados", "% Destete", "Señalados"]
  const filas = anios.map(([a, g]) => [a, g.entoradas, g.prenadas, pct(g.prenadas, g.entoradas), g.paridas, pct(g.paridas, g.entoradas), g.nacidos, g.destetados, pct(g.destetados, g.entoradas), g.senalados])
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div><CardTitle className="text-base">Resumen de zafra por año</CardTitle><CardDescription>Todas las toradas y encarneradas de cada año (por fecha de inicio), para comparar campañas.</CardDescription></div>
        {anios.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exportToExcel({ filename: `zafra_${hoyArgentina()}.xlsx`, sheetName: "Zafra", columns: columnas.map((c, i) => ({ header: c, key: String(i) })), data: filas.map((f) => Object.fromEntries(f.map((v, i) => [String(i), v]))) })}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
            <Button size="sm" variant="outline" onClick={() => exportarTablaPDF({ titulo: "Resumen de zafra", columnas, filas, archivo: `zafra_${hoyArgentina()}.pdf`, horizontal: true })}><FileText className="mr-2 h-4 w-4" />PDF</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!indicadores ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Cargando" /> : !anios.length ? <p className="text-sm text-muted-foreground">Sin toradas.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b">{columnas.map((c, i) => <th key={c} className={`px-2 py-1 font-medium ${i ? "text-right" : "text-left"}`}>{c}</th>)}</tr></thead>
              <tbody>{filas.map((f) => <tr key={f[0]} className="border-b last:border-0">{f.map((v, i) => <td key={i} className={`px-2 py-1.5 tabular-nums ${i ? "text-right" : "font-medium"}`}>{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Apartar las vacías de una torada a otro grupo (descarte o revisión). No las da de baja. */
export function ApartarVaciasDialog({ toradaId, lotes, onOpenChange, onHecho }: { toradaId: string | null; lotes: GrupoOpcion[]; onOpenChange: (o: boolean) => void; onHecho: () => void }) {
  const [destino, setDestino] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => { if (toradaId) { setDestino(""); setError("") } }, [toradaId])
  const q = useQuery({
    queryKey: ["repro", "vacias", toradaId],
    queryFn: () => getJson<{ torada: { nombre: string; loteId: string; especieId: string }; vacias: { id: string; caravana: string }[] }>(`/api/reproduccion/toradas/${toradaId}/vacias`),
    enabled: !!toradaId,
  })
  async function apartar() {
    if (!destino) return setError("Elegí el grupo")
    setEnviando(true); setError("")
    try {
      const r = await fetch(`/api/reproduccion/toradas/${toradaId}/vacias`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loteDestinoId: destino }) })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error ?? "No se pudo apartar")
      toast.success(`${b.data.movidas} vacías pasaron a ${b.data.grupo}`)
      onOpenChange(false); onHecho()
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo apartar") } finally { setEnviando(false) }
  }
  const vacias = q.data?.vacias ?? []
  return (
    <Dialog open={!!toradaId} onOpenChange={(o) => !enviando && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Apartar vacías</DialogTitle><DialogDescription>Pasa a otro grupo las hembras de «{q.data?.torada.nombre ?? "…"}» que figuran vacías (por ejemplo, para descarte o revisión). No se dan de baja.</DialogDescription></DialogHeader>
        {q.isPending ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Cargando" /> : !vacias.length ? <p className="text-sm text-muted-foreground">No hay hembras vacías en esta torada.</p> : (
          <div className="space-y-3">
            <p className="text-sm"><strong>{vacias.length}</strong> vacías: {vacias.slice(0, 12).map((v) => v.caravana).join(", ")}{vacias.length > 12 ? "…" : ""}</p>
            <div className="space-y-1.5"><Label htmlFor="av-destino">Grupo de destino</Label>
              <select id="av-destino" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={destino} onChange={(e) => setDestino(e.target.value)}>
                <option value="">Elegir</option>{lotes.filter((l) => l.id !== q.data?.torada.loteId && (!l.especieId || l.especieId === q.data?.torada.especieId)).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select></div>
          </div>
        )}
        {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={apartar} disabled={enviando || !vacias.length}>{enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Apartar {vacias.length}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ToroDesempeno {
  clave: string; nombre: string; origen: "rodeo" | "pajuela" | "torada" | "texto"; tipo: string
  servicios: number; servidas: number; tactadas: number; prenadas: number; porcentajePrenez: number | null
  partos: number; nacidosVivos: number; abortos: number; distribucion: { cabeza: number | null; cuerpo: number | null; cola: number | null } | null
  dificultadParto: number | null; destetados: number; pesoDestete: number | null
}
const ORIGEN_TORO: Record<ToroDesempeno["origen"], string> = { rodeo: "Toro del rodeo", pajuela: "Pajuela", torada: "Torada", texto: "Semen (texto)" }

/** Desempeño por toro o semen (E4): ranking del año por % preñez, partos y peso al destete de las crías. */
export function TorosCard({ estId }: { estId: string }) {
  const actual = Number(hoyArgentina().slice(0, 4))
  const [anio, setAnio] = useState(actual)
  const q = useQuery({
    queryKey: ["repro", "toros", estId, anio],
    queryFn: () => getJson<{ anio: number; toros: ToroDesempeno[] }>(`/api/reproduccion/toros?establecimientoId=${estId}&anio=${anio}`),
    enabled: !!estId,
  })
  const toros = q.data?.toros ?? []
  const n = (v: number | null, suf = "") => (v == null ? "—" : `${v.toLocaleString("es-AR")}${suf}`)
  const exportar = () => exportToExcel({
    filename: `toros_${anio}.xlsx`, sheetName: `Toros ${anio}`,
    columns: [
      { header: "Toro / semen", key: "nombre", width: 28 }, { header: "Origen", key: "origen" }, { header: "Hembras servidas", key: "servidas" }, { header: "Tactadas", key: "tactadas" },
      { header: "Preñadas", key: "prenadas" }, { header: "% Preñez", key: "porcentajePrenez" }, { header: "Partos", key: "partos" }, { header: "Nacidos vivos", key: "nacidosVivos" },
      { header: "% Cabeza", key: "cabeza" }, { header: "% Cuerpo", key: "cuerpo" }, { header: "% Cola", key: "cola" }, { header: "Dificultad de parto (1-5)", key: "dificultadParto" },
      { header: "Destetados", key: "destetados" }, { header: "Peso al destete (kg)", key: "pesoDestete" },
    ],
    data: toros.map((t) => ({ ...t, origen: ORIGEN_TORO[t.origen], cabeza: t.distribucion?.cabeza ?? null, cuerpo: t.distribucion?.cuerpo ?? null, cola: t.distribucion?.cola ?? null })),
  })
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">Desempeño por toro</CardTitle>
          <CardDescription>Servicios del año por toro del rodeo o semen: preñez, partos y peso al destete de las crías.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="toros-anio" className="sr-only">Año</Label>
          <select id="toros-anio" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {[0, 1, 2, 3, 4].map((i) => <option key={i} value={actual - i}>{actual - i}</option>)}
          </select>
          {toros.length > 0 && <Button size="sm" variant="outline" onClick={exportar}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>}
        </div>
      </CardHeader>
      <CardContent>
        {q.isPending ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Cargando" /> : q.isError ? <p role="alert" className="text-sm text-destructive">{q.error.message}</p> : !toros.length ? (
          <p className="text-sm text-muted-foreground">No hay servicios en {anio}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1 font-medium">Toro / semen</th><th className="py-1 text-right font-medium">Servidas</th><th className="py-1 text-right font-medium">% Preñez</th>
                  <th className="py-1 text-right font-medium">Partos</th><th className="py-1 text-right font-medium">Cabeza / cuerpo / cola</th>
                  <th className="py-1 text-right font-medium">Dificultad</th><th className="py-1 text-right font-medium">Peso destete</th>
                </tr>
              </thead>
              <tbody>
                {toros.map((t) => (
                  <tr key={t.clave} className="border-b last:border-0">
                    <td className="py-1.5"><span className="font-medium">{t.nombre}</span><span className="ml-2 text-xs text-muted-foreground">{ORIGEN_TORO[t.origen]}</span></td>
                    <td className="py-1.5 text-right tabular-nums">{t.servidas}</td>
                    <td className="py-1.5 text-right tabular-nums" title={`${t.prenadas} preñadas de ${t.tactadas} tactadas`}>{n(t.porcentajePrenez, " %")}</td>
                    <td className="py-1.5 text-right tabular-nums">{t.partos}{t.abortos ? <span className="text-xs text-muted-foreground"> · {t.abortos} abortos</span> : null}</td>
                    <td className="py-1.5 text-right tabular-nums">{t.distribucion ? `${n(t.distribucion.cabeza)} / ${n(t.distribucion.cuerpo)} / ${n(t.distribucion.cola)} %` : "—"}</td>
                    <td className="py-1.5 text-right tabular-nums">{n(t.dificultadParto)}</td>
                    <td className="py-1.5 text-right tabular-nums">{t.pesoDestete != null ? `${n(t.pesoDestete)} kg` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">En monta natural con varios toros en la torada, si el servicio no indica el toro, se cuenta para la torada. Cada parto se atribuye al último servicio compatible con la gestación.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
