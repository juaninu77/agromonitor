"use client"

import { useState, useCallback } from "react"
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

interface ActionPanelProps {
  sessionId: string
  accionesHabilitadas: string[]
  currentEid: string
  currentAnimal: any | null
  onItemSaved: () => void
  productoSanidadId?: string
}

const CC_OPTIONS = ["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5"]

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
}: ActionPanelProps) {
  const [peso, setPeso] = useState("")
  const [cc, setCc] = useState("")
  const [sanidadAplicar, setSanidadAplicar] = useState(false)
  const [tactoResultado, setTactoResultado] = useState("")
  const [tactoMesesGest, setTactoMesesGest] = useState("")
  const [denticion, setDenticion] = useState("")
  const [apartadoDestino, setApartadoDestino] = useState("")
  const [regCaravanaVisual, setRegCaravanaVisual] = useState("")
  const [regSexo, setRegSexo] = useState("")
  const [regCategoria, setRegCategoria] = useState("")
  const [saving, setSaving] = useState(false)

  const isAnimalNew = !currentAnimal
  const showRegistro = accionesHabilitadas.includes("registro") && isAnimalNew

  const resetForm = useCallback(() => {
    setPeso("")
    setCc("")
    setSanidadAplicar(false)
    setTactoResultado("")
    setTactoMesesGest("")
    setDenticion("")
    setApartadoDestino("")
    setRegCaravanaVisual("")
    setRegSexo("")
    setRegCategoria("")
  }, [])

  async function handleConfirmar() {
    if (!currentEid) {
      toast.error("No hay animal seleccionado")
      return
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
      <Card className="border-2 border-dashed border-gray-300">
        <CardContent className="p-8 text-center text-muted-foreground">
          <Scale className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Escaneá o ingresá un EID para comenzar</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-gray-200">
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
              <Scale className="h-4 w-4 text-blue-600" />
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
              {CC_OPTIONS.map((val) => (
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
                    <span className="text-muted-foreground ml-1">(producto de sesión)</span>
                  )}
                </span>
              </label>
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
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <UserPlus className="h-4 w-4 text-yellow-600" />
                Registro de animal nuevo
              </Label>
              <div className="grid gap-3">
                <Input
                  placeholder="Caravana visual"
                  value={regCaravanaVisual}
                  onChange={(e) => setRegCaravanaVisual(e.target.value)}
                  className="h-11"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={regSexo} onValueChange={setRegSexo}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Sexo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Macho</SelectItem>
                      <SelectItem value="F">Hembra</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={regCategoria} onValueChange={setRegCategoria}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ternero">Ternero/a</SelectItem>
                      <SelectItem value="novillito">Novillito</SelectItem>
                      <SelectItem value="novillo">Novillo</SelectItem>
                      <SelectItem value="vaquillona">Vaquillona</SelectItem>
                      <SelectItem value="vaca">Vaca</SelectItem>
                      <SelectItem value="toro">Toro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
