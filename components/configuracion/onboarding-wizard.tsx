"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CheckCircle2, MapPin, List, Check, Loader2 } from "lucide-react"
import { useTenant } from "@/lib/context/tenant-context"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface EstablecimientoData {
  nombre: string
  hectareas: number | null
  renspa: string
  provincia: string
  localidad: string
  ubicacion: string
}

interface LoteData {
  nombre: string
  tipo: "recria" | "engorde" | "reproductivo" | "mixto" | "descarte"
  objetivo: string
  especieId: string
}

interface Especie {
  id: string
  nombre: string
}

export function OnboardingWizard() {
  const router = useRouter()
  const { organizacionActiva, establecimientos, fetchEstablecimientos, isLoading, error: tenantError } = useTenant()
  const [step, setStep] = useState(1)
  const [establecimientoData, setEstablecimientoData] = useState<EstablecimientoData>({
    nombre: "",
    hectareas: null,
    renspa: "",
    provincia: "",
    localidad: "",
    ubicacion: "",
  })
  const [loteData, setLoteData] = useState<LoteData>({
    nombre: "",
    tipo: "reproductivo",
    objetivo: "",
    especieId: "",
  })
  const [especies, setEspecies] = useState<Especie[]>([])
  const [lotes, setLotes] = useState<LoteData[]>([])
  const [establecimientoId, setEstablecimientoId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingEspecies, setLoadingEspecies] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalSteps = 3

  // Cargar establecimientos existentes
  useEffect(() => {
    if (organizacionActiva) {
      fetchEstablecimientos(organizacionActiva.id)
    }
  }, [organizacionActiva])

  // Cargar especies
  useEffect(() => {
    if (step === 2) {
      loadEspecies()
    }
  }, [step])

  // Si ya hay un establecimiento, usarlo
  useEffect(() => {
    if (establecimientos.length > 0 && !establecimientoId) {
      setEstablecimientoId(establecimientos[0].id)
      setStep(2) // Saltar al paso de lotes
    }
  }, [establecimientos])

  const loadEspecies = async () => {
    setLoadingEspecies(true)
    try {
      const response = await fetch("/api/especies")
      if (response.ok) {
        const data = await response.json()
        setEspecies(data)
        if (data.length > 0 && !loteData.especieId) {
          setLoteData((prev) => ({ ...prev, especieId: data[0].id }))
        }
      }
    } catch (err) {
      console.error("Error al cargar especies:", err)
    } finally {
      setLoadingEspecies(false)
    }
  }

  const handleEstablecimientoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setEstablecimientoData((prev) => ({
      ...prev,
      [name]: name === "hectareas" ? (value ? parseFloat(value) : null) : value,
    }))
  }

  const handleEstablecimientoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizacionActiva) {
      setError("No hay organización activa")
      return
    }

    if (!establecimientoData.nombre.trim()) {
      setError("El nombre del establecimiento es requerido")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/organizaciones/${organizacionActiva.id}/establecimientos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(establecimientoData),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Error al crear establecimiento")
      }

      const nuevoEstablecimiento = await response.json()
      setEstablecimientoId(nuevoEstablecimiento.id)
      
      // Recargar establecimientos
      await fetchEstablecimientos(organizacionActiva.id)
      
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear establecimiento")
    } finally {
      setLoading(false)
    }
  }

  const handleLoteChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setLoteData((prev) => ({ ...prev, [name]: value }))
  }

  const handleLoteSelectChange = (name: string, value: string) => {
    setLoteData((prev) => ({ ...prev, [name]: value }))
  }

  const handleLoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!establecimientoId) {
      setError("No hay establecimiento seleccionado")
      return
    }

    if (!loteData.nombre.trim()) {
      setError("El nombre del lote es requerido")
      return
    }

    if (!loteData.especieId) {
      setError("La especie es requerida")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/establecimientos/${establecimientoId}/lotes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loteData),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Error al crear lote")
      }

      setLotes((prev) => [...prev, { ...loteData }])
      setLoteData({
        nombre: "",
        tipo: "reproductivo",
        objetivo: "",
        especieId: especies[0]?.id || "",
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear lote")
    } finally {
      setLoading(false)
    }
  }

  const handleFinalizar = async () => {
    // Redirigir al dashboard, que mostrará el estado vacío con acciones rápidas
    router.push("/")
  }

  const progress = (step / totalSteps) * 100

  // Mostrar loading mientras se cargan las organizaciones
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
        <Card className="w-full max-w-3xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Cargando configuración...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Mostrar error si hay un problema cargando las organizaciones
  if (tenantError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
        <Card className="w-full max-w-3xl">
          <CardContent className="py-12">
            <Alert variant="destructive">
              <AlertDescription>
                Error al cargar las organizaciones: {tenantError}
                <br />
                <span className="text-sm mt-2 block">
                  Por favor, recarga la página o contacta al soporte si el problema persiste.
                </span>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-2xl">Configuración Inicial</CardTitle>
          <CardDescription>
            Completa la configuración de tu establecimiento para comenzar
          </CardDescription>
          <Progress value={progress} className="mt-4" />
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Paso 1: Información del Establecimiento */}
          {step === 1 && (
            <form onSubmit={handleEstablecimientoSubmit} className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Paso 1: Información del Establecimiento</h3>
              </div>
              <p className="text-muted-foreground">
                Configura los datos básicos de tu establecimiento
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">
                    Nombre del Establecimiento <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nombre"
                    name="nombre"
                    value={establecimientoData.nombre}
                    onChange={handleEstablecimientoChange}
                    placeholder="Ej: Establecimiento Principal"
                    required
                    className="text-gray-900"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hectareas">Hectáreas</Label>
                  <Input
                    id="hectareas"
                    name="hectareas"
                    type="number"
                    step="0.01"
                    min="0"
                    value={establecimientoData.hectareas || ""}
                    onChange={handleEstablecimientoChange}
                    placeholder="Ej: 100"
                    className="text-gray-900"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="renspa">RENSPA (SENASA)</Label>
                <Input
                  id="renspa"
                  name="renspa"
                  value={establecimientoData.renspa}
                  onChange={handleEstablecimientoChange}
                  placeholder="Ej: 06.123.0.12345/00"
                  className="text-gray-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="provincia">Provincia</Label>
                  <Input
                    id="provincia"
                    name="provincia"
                    value={establecimientoData.provincia}
                    onChange={handleEstablecimientoChange}
                    placeholder="Ej: Buenos Aires"
                    className="text-gray-900"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="localidad">Localidad</Label>
                  <Input
                    id="localidad"
                    name="localidad"
                    value={establecimientoData.localidad}
                    onChange={handleEstablecimientoChange}
                    placeholder="Ej: Tandil"
                    className="text-gray-900"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ubicacion">Ubicación</Label>
                  <Input
                    id="ubicacion"
                    name="ubicacion"
                    value={establecimientoData.ubicacion}
                    onChange={handleEstablecimientoChange}
                    placeholder="Dirección o coordenadas"
                    className="text-gray-900"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={loading || !organizacionActiva}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continuar
                </Button>
              </div>
              {!organizacionActiva && (
                <p className="text-sm text-muted-foreground text-right">
                  Esperando a que se cargue la organización...
                </p>
              )}
            </form>
          )}

          {/* Paso 2: Configuración de Lotes */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <List className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Paso 2: Configuración de Lotes</h3>
              </div>
              <p className="text-muted-foreground">
                Crea los lotes iniciales para organizar tu ganado. Puedes agregar más después.
              </p>

              {establecimientoId && (
                <form onSubmit={handleLoteSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lote-nombre">
                        Nombre del Lote <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="lote-nombre"
                        name="nombre"
                        value={loteData.nombre}
                        onChange={handleLoteChange}
                        placeholder="Ej: Lote Reproductivo"
                        required
                        className="text-gray-900"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lote-tipo">
                        Tipo de Lote <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={loteData.tipo}
                        onValueChange={(value) =>
                          handleLoteSelectChange("tipo", value as LoteData["tipo"])
                        }
                      >
                        <SelectTrigger className="text-gray-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reproductivo">Reproductivo</SelectItem>
                          <SelectItem value="recria">Recría</SelectItem>
                          <SelectItem value="engorde">Engorde</SelectItem>
                          <SelectItem value="mixto">Mixto</SelectItem>
                          <SelectItem value="descarte">Descarte</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lote-especie">
                      Especie <span className="text-red-500">*</span>
                    </Label>
                    {loadingEspecies ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Cargando especies...</span>
                      </div>
                    ) : (
                      <Select
                        value={loteData.especieId}
                        onValueChange={(value) => handleLoteSelectChange("especieId", value)}
                      >
                        <SelectTrigger className="text-gray-900">
                          <SelectValue placeholder="Seleccionar especie" />
                        </SelectTrigger>
                        <SelectContent>
                          {especies.map((especie) => (
                            <SelectItem key={especie.id} value={especie.id}>
                              {especie.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lote-objetivo">Objetivo</Label>
                    <Textarea
                      id="lote-objetivo"
                      name="objetivo"
                      value={loteData.objetivo}
                      onChange={handleLoteChange}
                      placeholder="Describe el objetivo de este lote..."
                      rows={3}
                      className="text-gray-900"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                      Atrás
                    </Button>
                    <Button type="submit" disabled={loading || loadingEspecies}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Agregar Lote
                    </Button>
                  </div>
                </form>
              )}

              {lotes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Lotes creados:</h4>
                  <div className="space-y-2">
                    {lotes.map((lote, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-muted rounded-md"
                      >
                        <Check className="h-4 w-4 text-primary" />
                        <span>{lote.nombre}</span>
                        <span className="text-sm text-muted-foreground">({lote.tipo})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setStep(3)} disabled={!establecimientoId}>
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* Paso 3: Resumen */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Paso 3: Resumen</h3>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-md">
                  <h4 className="font-medium mb-2">Establecimiento</h4>
                  <div className="space-y-1 text-sm">
                    <p><strong>Nombre:</strong> {establecimientoData.nombre}</p>
                    {establecimientoData.hectareas && (
                      <p><strong>Hectáreas:</strong> {establecimientoData.hectareas}</p>
                    )}
                    {establecimientoData.provincia && (
                      <p><strong>Ubicación:</strong> {establecimientoData.provincia}
                        {establecimientoData.localidad && `, ${establecimientoData.localidad}`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-md">
                  <h4 className="font-medium mb-2">Lotes ({lotes.length})</h4>
                  {lotes.length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {lotes.map((lote, index) => (
                        <li key={index}>
                          {lote.nombre} - {lote.tipo}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No se crearon lotes. Puedes crearlos más tarde desde la configuración.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Atrás
                </Button>
                <Button onClick={handleFinalizar}>
                  Finalizar Configuración
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
