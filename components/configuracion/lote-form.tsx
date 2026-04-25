"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface LoteFormData {
  nombre: string
  tipo: "recria" | "engorde" | "reproductivo" | "mixto" | "descarte"
  objetivo: string
  especieId: string
}

interface Especie {
  id: string
  nombre: string
}

interface LoteFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: LoteFormData) => Promise<void>
  initialData?: Partial<LoteFormData>
  establecimientoId: string
}

export function LoteForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  establecimientoId,
}: LoteFormProps) {
  const [formData, setFormData] = useState<LoteFormData>({
    nombre: initialData?.nombre || "",
    tipo: initialData?.tipo || "reproductivo",
    objetivo: initialData?.objetivo || "",
    especieId: initialData?.especieId || "",
  })
  const [especies, setEspecies] = useState<Especie[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingEspecies, setLoadingEspecies] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cargar especies
  useEffect(() => {
    const fetchEspecies = async () => {
      try {
        const response = await fetch("/api/especies")
        if (response.ok) {
          const data = await response.json()
          setEspecies(data)
          // Si no hay especie seleccionada, seleccionar la primera
          if (!formData.especieId && data.length > 0) {
            setFormData((prev) => ({ ...prev, especieId: data[0].id }))
          }
        }
      } catch (err) {
        console.error("Error al cargar especies:", err)
      } finally {
        setLoadingEspecies(false)
      }
    }

    if (open) {
      fetchEspecies()
    }
  }, [open])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
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

    if (!formData.especieId) {
      setError("La especie es requerida")
      setLoading(false)
      return
    }

    try {
      await onSubmit(formData)
      // Resetear formulario
      setFormData({
        nombre: "",
        tipo: "reproductivo",
        objetivo: "",
        especieId: especies[0]?.id || "",
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar lote")
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Editar Lote" : "Nuevo Lote"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Modifica la información del lote"
              : "Crea un nuevo lote para organizar tu ganado"}
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
                Nombre del Lote <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nombre"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                placeholder="Ej: Lote Reproductivo"
                required
                className="text-gray-900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">
                Tipo de Lote <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) =>
                  handleSelectChange("tipo", value as LoteFormData["tipo"])
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
            <Label htmlFor="especie">
              Especie <span className="text-red-500">*</span>
            </Label>
            {loadingEspecies ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Cargando especies...
                </span>
              </div>
            ) : (
              <Select
                value={formData.especieId}
                onValueChange={(value) => handleSelectChange("especieId", value)}
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
            <Label htmlFor="objetivo">Objetivo</Label>
            <Textarea
              id="objetivo"
              name="objetivo"
              value={formData.objetivo}
              onChange={handleChange}
              placeholder="Describe el objetivo de este lote..."
              rows={3}
              className="text-gray-900"
            />
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
            <Button type="submit" disabled={loading || loadingEspecies}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData ? "Guardar Cambios" : "Crear Lote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

