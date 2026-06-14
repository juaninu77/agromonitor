"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, MapPin, Settings, Loader2 } from "lucide-react"
import { EstablecimientoForm } from "@/components/configuracion/establecimiento-form"
import { useTenant } from "@/lib/context/tenant-context"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Establecimiento {
  id: string
  nombre: string
  hectareas: number | null
  renspa?: string | null
  provincia?: string | null
  localidad?: string | null
}

export default function EstablecimientosPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizacionActiva, establecimientos, fetchEstablecimientos } = useTenant()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingEstablecimiento, setEditingEstablecimiento] = useState<Establecimiento | null>(null)

  useEffect(() => {
    if (organizacionActiva) {
      loadEstablecimientos()
    }
  }, [organizacionActiva])

  useEffect(() => {
    if (searchParams.get("crear") === "true") {
      setShowForm(true)
    }
  }, [searchParams])

  const loadEstablecimientos = async () => {
    if (!organizacionActiva) return
    
    setLoading(true)
    try {
      await fetchEstablecimientos(organizacionActiva.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar establecimientos")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (data: any) => {
    if (!organizacionActiva) return

    setError(null)
    try {
      const response = await fetch(
        `/api/organizaciones/${organizacionActiva.id}/establecimientos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Error al crear establecimiento")
      }

      await loadEstablecimientos()
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear establecimiento")
      throw err
    }
  }

  const handleEdit = (establecimiento: Establecimiento) => {
    setEditingEstablecimiento(establecimiento)
    setShowForm(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Establecimientos</h1>
          <p className="text-muted-foreground">
            Gestiona los establecimientos de tu organización
          </p>
        </div>
        <Button onClick={() => {
          setEditingEstablecimiento(null)
          setShowForm(true)
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Establecimiento
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {establecimientos.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No hay establecimientos</CardTitle>
            <CardDescription>
              Crea tu primer establecimiento para comenzar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Establecimiento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {establecimientos.map((establecimiento) => (
            <Card key={establecimiento.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{establecimiento.nombre}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(establecimiento)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {establecimiento.hectareas && (
                    <p><strong>Hectáreas:</strong> {establecimiento.hectareas}</p>
                  )}
                  {establecimiento.provincia && (
                    <p><strong>Ubicación:</strong> {establecimiento.provincia}
                      {establecimiento.localidad && `, ${establecimiento.localidad}`}
                    </p>
                  )}
                  {establecimiento.renspa && (
                    <p><strong>RENSPA:</strong> {establecimiento.renspa}</p>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/configuracion/establecimientos/${establecimiento.id}/lotes`)}
                    className="flex-1"
                  >
                    Ver Lotes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {organizacionActiva && (
        <EstablecimientoForm
          open={showForm}
          onOpenChange={setShowForm}
          onSubmit={handleCreate}
          initialData={
            editingEstablecimiento
              ? {
                  nombre: editingEstablecimiento.nombre,
                  hectareas: editingEstablecimiento.hectareas,
                  renspa: editingEstablecimiento.renspa ?? "",
                  provincia: editingEstablecimiento.provincia ?? "",
                  localidad: editingEstablecimiento.localidad ?? "",
                }
              : undefined
          }
          organizacionId={organizacionActiva.id}
        />
      )}

      <div className="mt-8 border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Otras configuraciones</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => router.push("/configuracion/catalogo")}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Catálogo</CardTitle>
              <CardDescription>Razas, categorías y especies</CardDescription>
            </CardHeader>
          </Card>
          <Card
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => router.push("/configuracion/auditoria")}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Auditoría</CardTitle>
              <CardDescription>Registro de actividad del sistema</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}

