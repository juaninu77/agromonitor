"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Plus, RefreshCw, Upload } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  COLUMNAS_PLANTILLA,
  descargarPlantilla,
  filasDesdeMatriz,
  leerArchivoPlanilla,
  type FilaImportada,
  type MapeoColumnas,
} from "@/lib/ganado/importacion"
import { LIMITE_FILAS_ALTA_MASIVA } from "@/lib/validations/animal-schema"
import { useCatalogosAlta } from "./alta-masiva/use-catalogos-alta"
import { enviarAltaMasiva, ResultadoFilas, ResumenChips, type RespuestaAltaMasiva } from "./alta-masiva/resultado-filas"

interface ImportAnimalesFormProps {
  onClose: () => void
  onSuccess: () => void
  onBusyChange: (busy: boolean) => void
  onDirtyChange?: (dirty: boolean) => void
}

const EXTENSIONES = ".xlsx,.xls,.csv"

export function ImportAnimalesForm({ onClose, onSuccess, onBusyChange, onDirtyChange }: ImportAnimalesFormProps) {
  const cat = useCatalogosAlta()
  const inputRef = useRef<HTMLInputElement>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [filas, setFilas] = useState<FilaImportada[]>([])
  const [mapeo, setMapeo] = useState<MapeoColumnas | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [respuesta, setRespuesta] = useState<RespuestaAltaMasiva | null>(null)
  const [registrado, setRegistrado] = useState(false)

  useEffect(() => {
    onDirtyChange?.(filas.length > 0 && !registrado)
  }, [filas.length, registrado, onDirtyChange])

  const procesarArchivo = async (f: File) => {
    setLeyendo(true)
    setRespuesta(null)
    setRegistrado(false)
    try {
      const matriz = await leerArchivoPlanilla(f)
      const { filas: nuevas, mapeo: m } = filasDesdeMatriz(matriz)
      setArchivo(f)
      setFilas(nuevas)
      setMapeo(m)
      if (!nuevas.length) toast.error("La planilla no tiene filas con datos")
      else if (nuevas.length > LIMITE_FILAS_ALTA_MASIVA) toast.error(`La planilla tiene ${nuevas.length} filas; el máximo por importación es ${LIMITE_FILAS_ALTA_MASIVA}`)
      else {
        // Validación automática apenas se carga el archivo
        await validar(nuevas, true)
      }
    } catch (e) {
      console.error(e)
      toast.error("No se pudo leer el archivo. Usá la plantilla .xlsx o un .csv.")
    } finally {
      setLeyendo(false)
    }
  }

  const validar = async (lista: FilaImportada[] = filas, silencioso = false) => {
    if (!lista.length || !cat.establecimientoId) return
    setEnviando(true)
    onBusyChange(true)
    try {
      const r = await enviarAltaMasiva(conEspecieDefault(lista), { establecimientoId: cat.establecimientoId, dryRun: true })
      setRespuesta(r)
      if (!silencioso) toast[r.success ? "success" : "error"](r.success ? "Todas las filas son válidas" : (r.error ?? "Hay filas con errores"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo validar la planilla")
    } finally {
      setEnviando(false)
      onBusyChange(false)
    }
  }

  const conEspecieDefault = (lista: FilaImportada[]) => {
    const def = cat.especieDefault()
    return lista.map((f) => (f.especie || f.especieId || !def ? f : { ...f, especieId: def.id }))
  }

  const confirmar = async () => {
    if (!filas.length || !cat.establecimientoId || enviando) return
    setEnviando(true)
    onBusyChange(true)
    try {
      const r = await enviarAltaMasiva(conEspecieDefault(filas), { establecimientoId: cat.establecimientoId, dryRun: false })
      setRespuesta(r)
      if (r.success) {
        setRegistrado(true)
        onSuccess()
        toast.success(`${r.resumen.validas} animal${r.resumen.validas === 1 ? "" : "es"} importado${r.resumen.validas === 1 ? "" : "s"}`)
      } else {
        toast.error(r.error ?? "Hay filas con errores; no se importó ningún animal")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo importar")
    } finally {
      setEnviando(false)
      onBusyChange(false)
    }
  }

  const limpiar = () => {
    setArchivo(null)
    setFilas([])
    setMapeo(null)
    setRespuesta(null)
    setRegistrado(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  const plantilla = () => {
    const esp = cat.especieDefault()
    descargarPlantilla({
      razas: esp ? cat.razasDe(esp.id).map((r) => r.nombre) : [],
      categorias: esp ? cat.categoriasDe(esp.id).map((c) => c.nombre) : [],
      lotes: esp ? cat.lotesDe(esp.id).map((l) => l.nombre) : [],
      potreros: cat.sectores.map((s) => s.nombre),
    })
  }

  if (cat.cargando) {
    return (
      <div className="flex items-center justify-center py-16" role="status">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }
  if (cat.error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center" role="alert">
        <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
        <p className="mt-2 font-medium">{cat.error}</p>
        <Button variant="outline" className="mt-4" onClick={cat.reintentar}>
          <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
        </Button>
      </div>
    )
  }

  const faltantes = mapeo ? COLUMNAS_PLANTILLA.filter((c) => c.obligatorio && !mapeo.reconocidos.includes(c.campo)) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-emerald-100 p-2 dark:bg-emerald-950/40">
          <FileSpreadsheet className="h-6 w-6 text-emerald-700" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Importar desde Excel</h2>
          <p className="text-sm text-muted-foreground">Subí una planilla, revisá la vista previa y confirmá. Se importan todas las filas o ninguna.</p>
        </div>
      </div>

      <Card className="border-2">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">1. Bajá la plantilla</p>
              <p className="text-sm text-muted-foreground">Trae las razas, categorías, lotes y potreros de este campo en la hoja “Instrucciones”.</p>
            </div>
            <Button variant="outline" onClick={plantilla}>
              <Download className="mr-2 h-4 w-4" /> Plantilla .xlsx
            </Button>
          </div>

          <div>
            <p className="font-semibold">2. Subí tu planilla</p>
            <div
              role="button"
              tabIndex={0}
              aria-label="Elegir archivo de planilla"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault()
                setArrastrando(false)
                const f = e.dataTransfer.files?.[0]
                if (f) void procesarArchivo(f)
              }}
              className={cn(
                "mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
                arrastrando ? "border-primary bg-primary/5" : "border-border hover:border-slate-300",
              )}
            >
              {leyendo ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
              {archivo ? (
                <p className="text-sm">
                  <strong>{archivo.name}</strong> · {filas.length} fila{filas.length === 1 ? "" : "s"} con datos
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Arrastrá el archivo acá o tocá para elegirlo (.xlsx, .xls o .csv)</p>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={EXTENSIONES}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void procesarArchivo(f)
                }}
              />
            </div>
          </div>

          {mapeo && (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Columnas reconocidas</p>
              <div className="flex flex-wrap gap-1">
                {mapeo.reconocidos.map((c) => (
                  <Badge key={c} variant="secondary">{COLUMNAS_PLANTILLA.find((p) => p.campo === c)?.encabezado ?? c}</Badge>
                ))}
              </div>
              {mapeo.ignorados.length > 0 && (
                <p className="text-muted-foreground">
                  Ignoradas: {mapeo.ignorados.join(", ")}
                </p>
              )}
              {faltantes.length > 0 && (
                <p className="flex items-start gap-1 text-amber-700" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  Faltan columnas obligatorias: {faltantes.map((f) => f.encabezado).join(", ")}. Revisá los encabezados de la planilla.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {respuesta && (
        <Card className={cn("border-2", respuesta.success ? "border-emerald-200" : "border-red-200")}>
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">3. Vista previa</p>
              <ResumenChips resumen={respuesta.resumen} dryRun={!registrado} />
            </div>
            {registrado ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/20" role="status">
                <CheckCircle2 className="h-4 w-4" /> Importación completada. Los animales ya están en la lista.
              </div>
            ) : respuesta.success ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/20" role="status">
                <CheckCircle2 className="h-4 w-4" /> Todas las filas son válidas. Confirmá para registrarlas.
              </div>
            ) : (
              <p className="text-sm text-red-700" role="alert">
                Corregí las filas marcadas en tu planilla y volvé a subirla. No se importa nada hasta que todas sean válidas.
              </p>
            )}
            <ResultadoFilas filas={respuesta.filas} soloErrores={!respuesta.success} maxFilas={respuesta.success ? 30 : 200} />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button variant="outline" onClick={limpiar} disabled={enviando || (!archivo && !respuesta)}>
          {registrado ? <><Plus className="mr-1 h-4 w-4" /> Importar otra planilla</> : "Limpiar"}
        </Button>
        <div className="flex flex-wrap gap-2">
          {registrado ? (
            <Button onClick={onClose}>Listo</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => validar()} disabled={!filas.length || enviando || filas.length > LIMITE_FILAS_ALTA_MASIVA}>
                Volver a validar
              </Button>
              <Button onClick={confirmar} disabled={!respuesta?.success || enviando} className="bg-emerald-600 hover:bg-emerald-700">
                {enviando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando…</> : <><CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar importación</>}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
