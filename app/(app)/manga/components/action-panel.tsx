"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Scale,
  Syringe,
  Stethoscope,
  Bone,
  ArrowRightLeft,
  UserPlus,
  CheckCircle2,
  Loader2,
  Star,
} from "lucide-react"
import { toast } from "sonner"
import { cargarCatalogoManga, categoriasPara, especiePorDefecto, type CatalogoManga } from "@/lib/hardware/catalogo-cache"
import { ESCALA_CC, faltaParaAlta, textoTratamiento } from "@/lib/hardware/manga-config"
import { ETIQUETA_VIA, type VIAS_SANIDAD } from "@/lib/sanidad/validation"

interface ActionPanelProps {
  sessionId: string
  accionesHabilitadas: string[]
  currentEid: string
  currentAnimal: any | null
  onItemSaved: () => void
  productoSanidadId?: string
  /** Datos de la sesión para la sanidad y el alta de animales nuevos */
  establecimientoId?: string
  tipoSesion?: string
  productoSanidadNombre?: string | null
  dosisSanidad?: number | null
  unidadSanidad?: string | null
  viaSanidad?: string | null
  especieLoteOrigen?: string | null
  /** Especie de la mayoría de los animales del campo (alta sin lote de origen) */
  especieCampo?: string | null
  /** «Registrar» desde la tarjeta del EID: muestra el alta aunque la sesión no tenga «Registro nuevo» */
  registroForzado?: boolean
}

const TACTO_RESULTADOS = [
  { value: "preñada", label: "Preñada" },
  { value: "vacia", label: "Vacía" },
  { value: "dudosa", label: "Dudosa" },
  { value: "absorcion", label: "Absorción" },
]

const DENTICION_OPTIONS = [
  { value: "diente_leche", label: "Diente de leche" },
  { value: "2_dientes", label: "2 dientes" },
  { value: "4_dientes", label: "4 dientes" },
  { value: "6_dientes", label: "6 dientes" },
  { value: "boca_llena", label: "Boca llena" },
  { value: "medio_diente", label: "Medio diente" },
]

export function ActionPanel({
  sessionId,
  accionesHabilitadas,
  currentEid,
  currentAnimal,
  onItemSaved,
  productoSanidadId,
  establecimientoId,
  tipoSesion,
  productoSanidadNombre,
  dosisSanidad,
  unidadSanidad,
  viaSanidad,
  especieLoteOrigen,
  especieCampo,
  registroForzado = false,
}: ActionPanelProps) {
  // En una sesión de vacunación con producto, el tratamiento viene marcado para cada animal
  const sanidadPorDefecto = tipoSesion === "vacunacion" && !!productoSanidadId
  const [peso, setPeso] = useState("")
  const [cc, setCc] = useState("")
  const [sanidadAplicar, setSanidadAplicar] = useState(sanidadPorDefecto)
  const [tactoResultado, setTactoResultado] = useState("")
  const [tactoMesesGest, setTactoMesesGest] = useState("")
  const [denticion, setDenticion] = useState("")
  const [apartadoDestino, setApartadoDestino] = useState("")
  const [regCaravanaVisual, setRegCaravanaVisual] = useState("")
  const [regSexo, setRegSexo] = useState("")
  const [regCategoria, setRegCategoria] = useState("")
  const [regEspecie, setRegEspecie] = useState("")
  const [regRaza, setRegRaza] = useState("")
  const [catalogo, setCatalogo] = useState<CatalogoManga | null>(null)
  const [saving, setSaving] = useState(false)

  const isAnimalNew = !currentAnimal
  const altaDisponible = accionesHabilitadas.includes("registro") || registroForzado
  const showRegistro = altaDisponible && isAnimalNew

  // Catálogo para las altas (queda guardado en el dispositivo para usarlo sin señal)
  useEffect(() => {
    if (!altaDisponible || !establecimientoId) return
    cargarCatalogoManga(establecimientoId).then((c) => {
      setCatalogo(c)
      // Especie del lote de origen, si no la del campo (no «bovino» a ciegas)
      setRegEspecie((e) => e || especiePorDefecto(c, especieLoteOrigen, especieCampo))
    })
  }, [altaDisponible, establecimientoId, especieLoteOrigen, especieCampo])
  const razas = catalogo?.razas.filter((r) => r.especieId === regEspecie) ?? []
  const categorias = catalogo ? categoriasPara(catalogo, regEspecie, regSexo) : []
  const especieElegida = catalogo?.especies.find((e) => e.id === regEspecie)?.nombre ?? null

  const resetForm = useCallback(() => {
    setPeso("")
    setCc("")
    setSanidadAplicar(sanidadPorDefecto)
    setTactoResultado("")
    setTactoMesesGest("")
    setDenticion("")
    setApartadoDestino("")
    setRegCaravanaVisual("")
    setRegSexo("")
    setRegCategoria("")
    setRegRaza("")
  }, [sanidadPorDefecto])

  async function handleConfirmar() {
    if (!currentEid) {
      toast.error("No hay animal seleccionado")
      return
    }
    const falta = showRegistro ? faltaParaAlta({ sexo: regSexo, razaId: regRaza, categoriaId: regCategoria }) : null
    if (falta) {
      toast.error(falta)
      document.getElementById("manga-registro")?.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }
    if (isAnimalNew && !showRegistro && (peso || tactoResultado || sanidadAplicar)) {
      toast.warning("Este EID no está en el rodeo", { description: "Lo cargado queda en la sesión pero no se registra en ningún animal. Tocá «Registrar» en la tarjeta amarilla para darlo de alta." })
    }

    setSaving(true)
    try {
      const payload: Record<string, any> = {
        eidLeido: currentEid,
        animalId: currentAnimal?.id || null,
        esNuevoRegistro: isAnimalNew,
      }

      if (accionesHabilitadas.includes("peso") && peso) {
        payload.pesoKg = parseFloat(peso)
      }
      if (accionesHabilitadas.includes("cc") && cc) {
        payload.cc = parseFloat(cc)
      }
      if (accionesHabilitadas.includes("sanidad")) {
        payload.accionSanidad = sanidadAplicar
      }
      if (accionesHabilitadas.includes("tacto") && tactoResultado) {
        payload.resultadoTacto = tactoResultado
        if (tactoMesesGest) payload.mesesGestacion = parseFloat(tactoMesesGest)
      }
      if (accionesHabilitadas.includes("denticion") && denticion) {
        payload.denticion = denticion
      }
      if (accionesHabilitadas.includes("apartado") && apartadoDestino) {
        payload.apartadoA = apartadoDestino
      }

      if (showRegistro) {
        if (regCaravanaVisual) payload.caravanaVisual = regCaravanaVisual
        payload.sexo = regSexo
        payload.especieId = regEspecie || null
        payload.razaId = regRaza
        payload.categoriaId = regCategoria
        payload.categoria = categorias.find((c) => c.id === regCategoria)?.nombre ?? null
      } else {
        // Un EID desconocido sin alta queda como lectura de la sesión
        payload.esNuevoRegistro = false
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const { addPendingItem } = await import("@/lib/hardware/offline-queue")
        await addPendingItem({
          sessionId,
          eidLeido: payload.eidLeido,
          pesoKg: payload.pesoKg,
          cc: payload.cc,
          denticion: payload.denticion,
          resultadoTacto: payload.resultadoTacto,
          mesesGestacion: payload.mesesGestacion,
          accionSanidad: payload.accionSanidad,
          apartadoA: payload.apartadoA,
          animalId: payload.animalId,
          esNuevoRegistro: payload.esNuevoRegistro,
          caravanaVisual: payload.caravanaVisual,
          sexo: payload.sexo,
          categoria: payload.categoria,
          especieId: payload.especieId,
          razaId: payload.razaId,
          categoriaId: payload.categoriaId,
          createdAt: new Date().toISOString(),
        })
        toast.info("Sin conexión — guardado localmente", {
          description: "Se sincronizará cuando vuelva el internet",
        })
        resetForm()
        onItemSaved()
        return
      }

      const res = await fetch(`/api/manga/${sessionId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al guardar")
      }

      toast.success("Registrado", {
        description: peso ? `${currentEid} — ${peso} kg` : `${currentEid} procesado`,
      })
      resetForm()
      onItemSaved()
    } catch (err: any) {
      toast.error("Error al guardar", { description: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (!currentEid) {
    return (
      <Card className="border-2 border-dashed border-input">
        <CardContent className="p-8 text-center text-muted-foreground">
          <Scale className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Escaneá o ingresá un EID para comenzar</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Datos del animal
          <Badge variant="outline" className="font-mono text-xs">
            {currentEid}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {accionesHabilitadas.includes("peso") && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <Scale className="h-4 w-4 text-primary" />
              Peso (kg)
            </Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder="0"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              className="h-14 text-2xl font-bold text-center border-2"
            />
          </div>
        )}

        {accionesHabilitadas.includes("cc") && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <Star className="h-4 w-4 text-amber-600" />
              Condición Corporal
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {ESCALA_CC.map((val) => (
                <Button
                  key={val}
                  type="button"
                  variant={cc === val ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCc(cc === val ? "" : val)}
                  className="h-10 w-12 text-sm font-semibold"
                >
                  {val}
                </Button>
              ))}
            </div>
          </div>
        )}

        {accionesHabilitadas.includes("sanidad") && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Syringe className="h-4 w-4 text-purple-600" />
                Sanidad
              </Label>
              <label className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors hover:bg-muted/50 has-[:checked]:border-purple-400 has-[:checked]:bg-purple-50">
                <Checkbox
                  checked={sanidadAplicar}
                  onCheckedChange={(checked) => setSanidadAplicar(checked === true)}
                />
                <span className="text-sm font-medium select-none">
                  Aplicar tratamiento
                  {productoSanidadId && (
                    <span className="text-muted-foreground ml-1">
                      ({textoTratamiento({ producto: productoSanidadNombre, dosis: dosisSanidad, unidad: unidadSanidad, via: viaSanidad }, (v) => ETIQUETA_VIA[v as (typeof VIAS_SANIDAD)[number]] ?? v)})
                    </span>
                  )}
                </span>
              </label>
              {!productoSanidadId && (
                <p className="text-xs text-amber-700">Esta sesión no tiene producto: el tratamiento no se registrará en Sanidad.</p>
              )}
            </div>
          </>
        )}

        {accionesHabilitadas.includes("tacto") && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Stethoscope className="h-4 w-4 text-green-600" />
                Tacto
              </Label>
              <Select value={tactoResultado} onValueChange={setTactoResultado}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Resultado del tacto" />
                </SelectTrigger>
                <SelectContent>
                  {TACTO_RESULTADOS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tactoResultado === "preñada" && (
                <div className="grid gap-2">
                  <Label htmlFor="tacto-meses" className="text-xs">
                    Meses de gestación
                  </Label>
                  <Input
                    id="tacto-meses"
                    type="number"
                    min="1"
                    max="9"
                    placeholder="Meses"
                    value={tactoMesesGest}
                    onChange={(e) => setTactoMesesGest(e.target.value)}
                    className="h-11"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {accionesHabilitadas.includes("denticion") && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Bone className="h-4 w-4 text-orange-600" />
                Dentición
              </Label>
              <Select value={denticion} onValueChange={setDenticion}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Seleccionar dentición" />
                </SelectTrigger>
                <SelectContent>
                  {DENTICION_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {accionesHabilitadas.includes("apartado") && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
                Apartado
              </Label>
              <Input
                placeholder="Corral o lote destino"
                value={apartadoDestino}
                onChange={(e) => setApartadoDestino(e.target.value)}
                className="h-11"
              />
            </div>
          </>
        )}

        {showRegistro && (
          <>
            <Separator />
            <div className="space-y-3 scroll-mt-24" id="manga-registro">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <UserPlus className="h-4 w-4 text-yellow-600" />
                Registro de animal nuevo
              </Label>
              <div className="grid gap-3">
                <Input
                  placeholder="Caravana visual"
                  aria-label="Caravana visual"
                  value={regCaravanaVisual}
                  onChange={(e) => setRegCaravanaVisual(e.target.value)}
                  className="h-11"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={regSexo} onValueChange={(v) => { setRegSexo(v); setRegCategoria("") }}>
                    <SelectTrigger className="h-11" aria-label="Sexo">
                      <SelectValue placeholder="Sexo *" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Macho</SelectItem>
                      <SelectItem value="F">Hembra</SelectItem>
                    </SelectContent>
                  </Select>
                  {(catalogo?.especies.length ?? 0) > 1 ? (
                    <Select value={regEspecie} onValueChange={(v) => { setRegEspecie(v); setRegRaza(""); setRegCategoria("") }}>
                      <SelectTrigger className="h-11" aria-label="Especie"><SelectValue placeholder="Especie" /></SelectTrigger>
                      <SelectContent>{catalogo!.especies.map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <div />}
                  <Select value={regRaza} onValueChange={setRegRaza}>
                    <SelectTrigger className="h-11" aria-label="Raza">
                      <SelectValue placeholder={catalogo ? (razas.length ? "Raza *" : "Sin razas en el catálogo") : "Cargando…"} />
                    </SelectTrigger>
                    <SelectContent>{razas.map((r) => <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={regCategoria} onValueChange={setRegCategoria}>
                    <SelectTrigger className="h-11" aria-label="Categoría">
                      <SelectValue placeholder={regSexo ? "Categoría *" : "Elegí el sexo primero"} />
                    </SelectTrigger>
                    <SelectContent>{categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se da de alta en Ganado{especieElegida ? ` como ${especieElegida.toLowerCase()}` : ""} con este EID, la categoría elegida{especieLoteOrigen && especieLoteOrigen === regEspecie ? " y entra al lote de origen de la sesión" : ""}.
                </p>
              </div>
            </div>
          </>
        )}

        <Separator />

        <Button
          onClick={handleConfirmar}
          disabled={saving || !currentEid}
          className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-5 w-5 mr-2" />
          )}
          Confirmar y Siguiente
        </Button>
      </CardContent>
    </Card>
  )
}
