"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface EstablecimientoFormData {
  nombre: string
  hectareas: number | null
  renspa: string
  provincia: string
  localidad: string
  ubicacion: string
}

interface EstablecimientoFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: EstablecimientoFormData) => Promise<void>
  initialData?: Partial<EstablecimientoFormData>
  organizacionId: string
}

export function EstablecimientoForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  organizacionId,
}: EstablecimientoFormProps) {
  const [formData, setFormData] = useState<EstablecimientoFormData>({
    nombre: initialData?.nombre || "",
    hectareas: initialData?.hectareas || null,
    renspa: initialData?.renspa || "",
    provincia: initialData?.provincia || "",
    localidad: initialData?.localidad || "",
    ubicacion: initialData?.ubicacion || "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === "hectareas" ? (value ? parseFloat(value) : null) : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!formData.nombre.trim()) {
      setError("El nombre es requerido")
      setLoading(false)
      return
    }

    try {
      await onSubmit(formData)
      // Resetear formulario
      setFormData({
        nombre: "",
        hectareas: null,
        renspa: "",
        provincia: "",
        localidad: "",
        ubicacion: "",
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar establecimiento")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Editar Establecimiento" : "Nuevo Establecimiento"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Modifica la información del establecimiento"
              : "Completa los datos de tu establecimiento"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">
                Nombre del Establecimiento <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nombre"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
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
                value={formData.hectareas || ""}
                onChange={handleChange}
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
              value={formData.renspa}
              onChange={handleChange}
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
                value={formData.provincia}
                onChange={handleChange}
                placeholder="Ej: Buenos Aires"
                className="text-gray-900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="localidad">Localidad</Label>
              <Input
                id="localidad"
                name="localidad"
                value={formData.localidad}
                onChange={handleChange}
                placeholder="Ej: Tandil"
                className="text-gray-900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ubicacion">Ubicación</Label>
              <Input
                id="ubicacion"
                name="ubicacion"
                value={formData.ubicacion}
                onChange={handleChange}
                placeholder="Dirección o coordenadas"
                className="text-gray-900"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData ? "Guardar Cambios" : "Crear Establecimiento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

