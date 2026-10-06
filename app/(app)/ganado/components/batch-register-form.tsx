"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  Crown,
  Heart,
  Info,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Tag,
  Trash2,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { isValidEID, normalizeEID } from "@/lib/hardware/eid"
import { useCatalogosAlta } from "./alta-masiva/use-catalogos-alta"
import { enviarAltaMasiva, ResultadoFilas, ResumenChips, type RespuestaAltaMasiva } from "./alta-masiva/resultado-filas"

interface Entrada {
  id: string
  caravanaVisual: string
  caravanaRfid: string
  pesoInicial: string
}

interface BatchRegisterFormProps {
  onClose: () => void
  onSuccess: () => void
  onBusyChange: (busy: boolean) => void
  /** Avisa si hay datos cargados sin guardar (para confirmar antes de cerrar). */
  onDirtyChange?: (dirty: boolean) => void
}

const nuevoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
const entradaVacia = (): Entrada => ({ id: nuevoId(), caravanaVisual: "", caravanaRfid: "", pesoInicial: "" })

const ORIGENES = [
  { value: "cria_propia", label: "Cría propia" },
  { value: "compra", label: "Compra" },
  { value: "otro", label: "Otro" },
] as const

function BotonOpcion({ activo, onClick, children, tono = "primary", className }: { activo: boolean; onClick: () => void; children: React.ReactNode; tono?: "primary" | "pink"; className?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-all",
        activo
          ? tono === "pink"
            ? "border-pink-600 bg-pink-50 text-pink-700"
            : "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-slate-300",
        className,
      )}
    >
      {children}
    </button>
  )
}

export function BatchRegisterForm({ onClose, onBusyChange, onSuccess, onDirtyChange }: BatchRegisterFormProps) {
  const cat = useCatalogosAlta()
  const [paso, setPaso] = useState<"config" | "entradas" | "resultado">("config")

  // Configuración común
  const [especieId, setEspecieId] = useState("")
  const [sexo, setSexo] = useState<"M" | "F">("M")
  const [razaId, setRazaId] = useState("")
  const [categoriaId, setCategoriaId] = useState("")
  const [origen, setOrigen] = useState<(typeof ORIGENES)[number]["value"]>("cria_propia")
  const [loteId, setLoteId] = useState("")
  const [sectorId, setSectorId] = useState("")

  // Entradas
  const [entradas, setEntradas] = useState<Entrada[]>([entradaVacia()])
  const [mostrarGenerador, setMostrarGenerador] = useState(false)
  const [mostrarPegar, setMostrarPegar] = useState(false)
  const [gen, setGen] = useState({ prefijo: "", desde: "1", hasta: "10", digitos: "3" })
  const [pegado, setPegado] = useState("")

  // Validación / guardado
  const [enviando, setEnviando] = useState(false)
  const [respuesta, setRespuesta] = useState<RespuestaAltaMasiva | null>(null)
  const ultimoInputRef = useRef<HTMLInputElement>(null)

  // Especie por defecto cuando llega el catálogo
  useEffect(() => {
    if (!especieId && cat.especies.length) setEspecieId(cat.especieDefault()?.id ?? "")
  }, [cat.especies, especieId, cat])

  const razas = especieId ? cat.razasDe(especieId) : []
  const categorias = especieId ? cat.categoriasDe(especieId, sexo) : []
  const lotes = especieId ? cat.lotesDe(especieId) : []

  const entradasConDatos = entradas.filter((e) => e.caravanaVisual.trim() || e.caravanaRfid.trim())
  const configValida = Boolean(especieId && razaId && categoriaId && cat.establecimientoId)

  useEffect(() => {
    onDirtyChange?.(paso !== "resultado" && entradasConDatos.length > 0)
  }, [entradasConDatos.length, paso, onDirtyChange])

  // Duplicados locales (sin distinguir mayúsculas ni espacios)
  const duplicados = useMemo(() => {
    const vistos = new Map<string, number>()
    const dup = new Set<string>()
    entradas.forEach((e) => {
      for (const v of [e.caravanaVisual.trim().toUpperCase(), normalizeEID(e.caravanaRfid) ?? ""]) {
        if (!v) continue
        if (vistos.has(v)) dup.add(e.id)
        else vistos.set(v, 1)
      }
    })
    return dup
  }, [entradas])
  const rfidInvalidos = useMemo(() => new Set(entradas.filter((e) => e.caravanaRfid.trim() && !isValidEID(e.caravanaRfid)).map((e) => e.id)), [entradas])
  const pesosInvalidos = useMemo(
    () => new Set(entradas.filter((e) => e.pesoInicial.trim() && !(Number(e.pesoInicial.replace(",", ".")) > 0)).map((e) => e.id)),
    [entradas],
  )
  const hayErroresLocales = duplicados.size > 0 || rfidInvalidos.size > 0 || pesosInvalidos.size > 0

  const actualizar = (id: string, campo: keyof Omit<Entrada, "id">, valor: string) => {
    setRespuesta(null)
    setEntradas((prev) => prev.map((e) => (e.id === id ? { ...e, [campo]: valor } : e)))
  }
  const agregar = (cantidad = 1) => {
    setEntradas((prev) => [...prev, ...Array.from({ length: cantidad }, entradaVacia)])
    setTimeout(() => ultimoInputRef.current?.focus(), 50)
  }
  const quitar = (id: string) => setEntradas((prev) => (prev.length > 1 ? prev.filter((e) => e.id !== id) : [entradaVacia()]))
  const quitarVacias = () => setEntradas((prev) => (entradasConDatos.length ? prev.filter((e) => e.caravanaVisual.trim() || e.caravanaRfid.trim()) : prev))

  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    if (index === entradas.length - 1) agregar()
    else {
      const siguiente = e.currentTarget.closest("li")?.nextElementSibling?.querySelector<HTMLInputElement>("input")
      siguiente?.focus()
    }
  }

  const generarSerie = () => {
    const desde = parseInt(gen.desde, 10)
    const hasta = parseInt(gen.hasta, 10)
    const digitos = Math.max(0, Math.min(8, parseInt(gen.digitos, 10) || 0))
    if (Number.isNaN(desde) || Number.isNaN(hasta) || hasta < desde) {
      toast.error("Revisá el rango: 'hasta' debe ser mayor o igual que 'desde'")
      return
    }
    if (hasta - desde + 1 > 1000) {
      toast.error("Máximo 1000 caravanas por tanda")
      return
    }
    const nuevas: Entrada[] = []
    for (let n = desde; n <= hasta; n++) {
      nuevas.push({ ...entradaVacia(), caravanaVisual: `${gen.prefijo}${String(n).padStart(digitos, "0")}` })
    }
    setEntradas((prev) => [...prev.filter((e) => e.caravanaVisual.trim() || e.caravanaRfid.trim()), ...nuevas])
    setMostrarGenerador(false)
    setRespuesta(null)
    toast.success(`${nuevas.length} caravanas generadas`)
  }

  const pegarLista = () => {
    const tokens = pegado
      .split(/[\n,;\t]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    if (!tokens.length) return
    const nuevas: Entrada[] = tokens.map((t) => (isValidEID(t) && t.replace(/\D/g, "").length >= 15 ? { ...entradaVacia(), caravanaRfid: t } : { ...entradaVacia(), caravanaVisual: t }))
    setEntradas((prev) => [...prev.filter((e) => e.caravanaVisual.trim() || e.caravanaRfid.trim()), ...nuevas])
    setPegado("")
    setMostrarPegar(false)
    setRespuesta(null)
    toast.success(`${nuevas.length} animales agregados a la lista`)
  }

  const filasParaEnviar = () =>
    entradasConDatos.map((e, i) => ({
      fila: i + 1,
      especieId,
      razaId,
      categoriaId,
      sexo,
      origen,
      loteId: loteId || undefined,
      sectorId: sectorId || undefined,
      caravanaVisual: e.caravanaVisual.trim() || undefined,
      caravanaRfid: e.caravanaRfid.trim() || undefined,
      pesoInicial: e.pesoInicial.trim() || undefined,
    }))

  const enviar = async (dryRun: boolean) => {
    if (!configValida || !entradasConDatos.length || enviando) return
    setEnviando(true)
    onBusyChange(true)
    try {
      const r = await enviarAltaMasiva(filasParaEnviar(), { establecimientoId: cat.establecimientoId, dryRun })
      setRespuesta(r)
      if (r.success && !dryRun) {
        setPaso("resultado")
        onSuccess()
        toast.success(`${r.resumen.validas} animal${r.resumen.validas === 1 ? "" : "es"} registrado${r.resumen.validas === 1 ? "" : "s"}`)
      } else if (r.success && dryRun) {
        toast.success("Todo listo: ninguna fila tiene errores")
      } else {
        toast.error(r.error ?? "Hay filas con errores; no se registró ningún animal")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo conectar con el servidor")
    } finally {
      setEnviando(false)
      onBusyChange(false)
    }
  }

  const reiniciar = () => {
    setEntradas([entradaVacia()])
    setRespuesta(null)
    setPaso("entradas")
  }

  // ---------- Render ----------
  if (cat.cargando) {
    return (
      <div className="flex items-center justify-center py-16" role="status">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-3 text-muted-foreground">Cargando catálogos del campo…</p>
        </div>
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

  if (!cat.especies.length) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center dark:bg-amber-950/20" role="alert">
        <Info className="mx-auto h-8 w-8 text-amber-600" />
        <p className="mt-2 font-semibold">No hay especies en el catálogo</p>
        <p className="mt-1 text-sm text-muted-foreground">Para registrar animales primero hay que dar de alta al menos una especie con sus razas y categorías.</p>
        <Button asChild className="mt-4">
          <a href="/configuracion/catalogo">Ir a Configuración → Catálogo</a>
        </Button>
      </div>
    )
  }

  const nombreRaza = razas.find((r) => r.id === razaId)?.nombre
  const nombreCategoria = categorias.find((c) => c.id === categoriaId)?.nombre

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-purple-100 p-2 dark:bg-purple-950/40">
          <Layers className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Registro masivo</h2>
          <p className="text-sm text-muted-foreground">Varios animales con la misma raza y categoría. Se guardan todos juntos o ninguno.</p>
        </div>
      </div>

      {/* ---------------- Paso 1: configuración ---------------- */}
      {paso === "config" && (
        <Card className="border-2">
          <CardHeader className="border-b bg-muted/40">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-5 w-5 text-muted-foreground" /> Configuración común para todos los animales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <Label htmlFor="masivo-especie">
                Especie <span className="text-destructive">*</span>
              </Label>
              <Select
                value={especieId}
                onValueChange={(id) => {
                  setEspecieId(id)
                  setRazaId("")
                  setCategoriaId("")
                  setLoteId("")
                }}
                disabled={cat.especies.length === 1}
              >
                <SelectTrigger id="masivo-especie" aria-label="Especie">
                  <SelectValue placeholder="Seleccionar especie" />
                </SelectTrigger>
                <SelectContent>
                  {cat.especies.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nombre.charAt(0).toUpperCase() + e.nombre.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-bold">
                Sexo <span className="text-destructive">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Sexo">
                <BotonOpcion activo={sexo === "M"} onClick={() => { setSexo("M"); setCategoriaId("") }} className="p-4">
                  <Crown className="h-5 w-5" aria-hidden /> <span className="font-bold">MACHO</span>
                </BotonOpcion>
                <BotonOpcion activo={sexo === "F"} tono="pink" onClick={() => { setSexo("F"); setCategoriaId("") }} className="p-4">
                  <Heart className="h-5 w-5" aria-hidden /> <span className="font-bold">HEMBRA</span>
                </BotonOpcion>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-bold">
                Raza <span className="text-destructive">*</span>
              </legend>
              {razas.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" role="radiogroup" aria-label="Raza">
                  {razas.map((r) => (
                    <BotonOpcion key={r.id} activo={razaId === r.id} onClick={() => setRazaId(r.id)}>
                      <span className="truncate">{r.nombre}</span>
                    </BotonOpcion>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay razas para esta especie.{" "}
                  <a className="underline" href="/configuracion/catalogo">Agregalas en Configuración → Catálogo</a>.
                </p>
              )}
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-bold">
                Categoría <span className="text-destructive">*</span>
                <span className="ml-2 font-normal text-muted-foreground">({sexo === "M" ? "machos" : "hembras"})</span>
              </legend>
              {categorias.length ? (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3" role="radiogroup" aria-label="Categoría">
                  {categorias.map((c) => (
                    <BotonOpcion key={c.id} activo={categoriaId === c.id} onClick={() => setCategoriaId(c.id)}>
                      <span className="truncate capitalize">{c.nombre}</span>
                    </BotonOpcion>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay categorías para este sexo.{" "}
                  <a className="underline" href="/configuracion/catalogo">Agregalas en Configuración → Catálogo</a>.
                </p>
              )}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="masivo-lote">Lote <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                <Select value={loteId || "none"} onValueChange={(v) => setLoteId(v === "none" ? "" : v)}>
                  <SelectTrigger id="masivo-lote"><SelectValue placeholder="Sin lote" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin lote</SelectItem>
                    {lotes.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="masivo-sector">Potrero / corral <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                <Select value={sectorId || "none"} onValueChange={(v) => setSectorId(v === "none" ? "" : v)}>
                  <SelectTrigger id="masivo-sector"><SelectValue placeholder="Sin ubicación" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin ubicación</SelectItem>
                    {cat.sectores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nombre} <span className="text-muted-foreground">· {s.tipo}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-bold">Origen</legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Origen">
                {ORIGENES.map((o) => (
                  <BotonOpcion key={o.value} activo={origen === o.value} onClick={() => setOrigen(o.value)}>
                    {o.label}
                  </BotonOpcion>
                ))}
              </div>
            </fieldset>

            {!configValida && (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Falta elegir: {[!especieId && "especie", !razaId && "raza", !categoriaId && "categoría"].filter(Boolean).join(", ")}.
              </p>
            )}
            <Button onClick={() => setPaso("entradas")} disabled={!configValida} className="w-full">
              Continuar a cargar caravanas <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ---------------- Paso 2: caravanas ---------------- */}
      {paso === "entradas" && (
        <>
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{sexo === "M" ? "Machos" : "Hembras"}</Badge>
                <span>
                  <strong>{nombreRaza}</strong> · <span className="capitalize">{nombreCategoria}</span>
                </span>
                {loteId && <Badge variant="outline">Lote: {lotes.find((l) => l.id === loteId)?.nombre}</Badge>}
                {sectorId && <Badge variant="outline">{cat.sectores.find((s) => s.id === sectorId)?.nombre}</Badge>}
              </div>
              <Button variant="ghost" size="sm" disabled={enviando} onClick={() => setPaso("config")}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Cambiar
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="border-b bg-muted/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tag className="h-5 w-5 text-muted-foreground" /> Caravanas
                  <Badge variant="outline">{entradasConDatos.length}</Badge>
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => { setMostrarGenerador((v) => !v); setMostrarPegar(false) }} aria-expanded={mostrarGenerador}>
                    <Wand2 className="mr-1 h-4 w-4" /> Generar serie
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setMostrarPegar((v) => !v); setMostrarGenerador(false) }} aria-expanded={mostrarPegar}>
                    <ClipboardPaste className="mr-1 h-4 w-4" /> Pegar lista
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {mostrarGenerador && (
                <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-5">
                  <div className="space-y-1">
                    <Label htmlFor="gen-prefijo" className="text-xs">Prefijo</Label>
                    <Input id="gen-prefijo" value={gen.prefijo} onChange={(e) => setGen({ ...gen, prefijo: e.target.value })} placeholder="Ej: A-" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="gen-desde" className="text-xs">Desde</Label>
                    <Input id="gen-desde" type="number" inputMode="numeric" value={gen.desde} onChange={(e) => setGen({ ...gen, desde: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="gen-hasta" className="text-xs">Hasta</Label>
                    <Input id="gen-hasta" type="number" inputMode="numeric" value={gen.hasta} onChange={(e) => setGen({ ...gen, hasta: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="gen-digitos" className="text-xs">Dígitos</Label>
                    <Input id="gen-digitos" type="number" inputMode="numeric" min={0} max={8} value={gen.digitos} onChange={(e) => setGen({ ...gen, digitos: e.target.value })} />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={generarSerie} className="w-full">Generar</Button>
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-5">
                    Ejemplo: prefijo “A-”, desde 1 hasta 10, 3 dígitos → A-001 … A-010.
                  </p>
                </div>
              )}
              {mostrarPegar && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <Label htmlFor="pegar-lista" className="text-xs">Una caravana por línea (o separadas por coma). Los números de 15 o 16 dígitos se toman como RFID.</Label>
                  <Textarea id="pegar-lista" rows={5} value={pegado} onChange={(e) => setPegado(e.target.value)} placeholder={"A-001\nA-002\n982000000000123"} />
                  <Button type="button" onClick={pegarLista} disabled={!pegado.trim()}>Agregar a la lista</Button>
                </div>
              )}

              <ul className="space-y-2" aria-label="Lista de animales a registrar">
                {entradas.map((e, index) => {
                  const esDup = duplicados.has(e.id)
                  const rfidMal = rfidInvalidos.has(e.id)
                  const pesoMal = pesosInvalidos.has(e.id)
                  const conError = esDup || rfidMal || pesoMal
                  return (
                    <li
                      key={e.id}
                      className={cn("flex flex-wrap items-start gap-2 rounded-lg border-2 p-2 sm:flex-nowrap", conError ? "border-red-300 bg-red-50/60 dark:bg-red-950/20" : "border-border")}
                    >
                      <span className="mt-2 w-7 shrink-0 font-mono text-xs text-muted-foreground" aria-hidden>
                        {index + 1}
                      </span>
                      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_6rem]">
                        <Input
                          ref={index === entradas.length - 1 ? ultimoInputRef : null}
                          aria-label={`Caravana visual, animal ${index + 1}`}
                          aria-invalid={esDup}
                          value={e.caravanaVisual}
                          onChange={(ev) => actualizar(e.id, "caravanaVisual", ev.target.value)}
                          onKeyDown={(ev) => onEnter(ev, index)}
                          placeholder="Caravana"
                          disabled={enviando}
                          className="h-10 uppercase"
                          autoComplete="off"
                        />
                        <Input
                          aria-label={`RFID, animal ${index + 1}`}
                          aria-invalid={rfidMal}
                          value={e.caravanaRfid}
                          onChange={(ev) => actualizar(e.id, "caravanaRfid", ev.target.value)}
                          onKeyDown={(ev) => onEnter(ev, index)}
                          placeholder="RFID (opcional)"
                          inputMode="numeric"
                          disabled={enviando}
                          className="h-10"
                          autoComplete="off"
                        />
                        <Input
                          aria-label={`Peso en kg, animal ${index + 1}`}
                          aria-invalid={pesoMal}
                          type="number"
                          step="0.1"
                          min={0.1}
                          inputMode="decimal"
                          value={e.pesoInicial}
                          onChange={(ev) => actualizar(e.id, "pesoInicial", ev.target.value)}
                          onKeyDown={(ev) => onEnter(ev, index)}
                          placeholder="Peso"
                          disabled={enviando}
                          className="h-10"
                        />
                        {conError && (
                          <p className="text-xs text-red-700 sm:col-span-3" role="alert">
                            {esDup && "Repetida en la lista. "}
                            {rfidMal && "El RFID debe tener 15 o 16 dígitos. "}
                            {pesoMal && "El peso debe ser mayor a 0."}
                          </p>
                        )}
                      </div>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Quitar animal ${index + 1}`} onClick={() => quitar(e.id)} disabled={enviando} className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  )
                })}
              </ul>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={enviando} onClick={() => agregar()} className="flex-1 border-dashed">
                  <Plus className="mr-2 h-4 w-4" /> Agregar otro
                </Button>
                <Button type="button" variant="outline" disabled={enviando} onClick={() => agregar(5)} className="border-dashed">
                  +5
                </Button>
                {entradas.length > entradasConDatos.length && entradasConDatos.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={quitarVacias}>Quitar vacías</Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Enter pasa a la siguiente fila (y agrega una al final). Las caravanas se guardan en mayúsculas.</p>

              {respuesta && !respuesta.success && (
                <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/60 p-3 dark:bg-red-950/20" role="alert">
                  <ResumenChips resumen={respuesta.resumen} dryRun />
                  <ResultadoFilas filas={respuesta.filas} soloErrores />
                </div>
              )}
              {respuesta?.success && respuesta.dryRun && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/20" role="status">
                  <CheckCircle2 className="h-4 w-4" /> Todas las filas son válidas. Podés confirmar el registro.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <Button variant="outline" disabled={enviando} onClick={() => setPaso("config")}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Volver
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {entradasConDatos.length} animal{entradasConDatos.length === 1 ? "" : "es"}
              </span>
              <Button variant="outline" onClick={() => enviar(true)} disabled={!entradasConDatos.length || enviando || hayErroresLocales}>
                Validar
              </Button>
              <Button onClick={() => enviar(false)} disabled={!entradasConDatos.length || enviando || hayErroresLocales} className="bg-emerald-600 hover:bg-emerald-700">
                {enviando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Registrar {entradasConDatos.length || ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ---------------- Paso 3: resultado ---------------- */}
      {paso === "resultado" && respuesta && (
        <Card className="border-2 border-emerald-200">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="text-lg font-semibold">Animales registrados</p>
                <ResumenChips resumen={respuesta.resumen} dryRun={false} />
              </div>
            </div>
            <ResultadoFilas filas={respuesta.filas} maxFilas={50} />
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={reiniciar}>
                <Plus className="mr-1 h-4 w-4" /> Cargar otra tanda
              </Button>
              <Button onClick={onClose}>Listo</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
