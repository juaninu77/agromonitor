"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Syringe } from "lucide-react"
import { useEffect, useState } from "react"

// Schema para registro rápido de evento sanitario
const quickHealthSchema = z.object({
  animalId: z.string().min(1, "Debes seleccionar un animal"),
  tipoEvento: z.enum(["vacunacion", "desparasitacion", "tratamiento", "curacion", "otro"], {
    required_error: "El tipo de evento es requerido",
  }),
  descripcion: z.string().min(1, "La descripción es requerida"),
  fecha: z.string().min(1, "La fecha es requerida"),
  producto: z.string().optional(),
  dosis: z.string().optional(),
  veterinario: z.string().optional(),
})

type QuickHealthData = z.infer<typeof quickHealthSchema>

interface QuickHealthFormProps {
  onSubmit: (data: QuickHealthData) => Promise<void>
  isSubmitting: boolean
}

interface Animal {
  id: string
  caravanaVisual: string
  nombre?: string
}

const TIPO_EVENTO_LABELS: Record<string, string> = {
  vacunacion: "Vacunación",
  desparasitacion: "Desparasitación",
  tratamiento: "Tratamiento",
  curacion: "Curación",
  otro: "Otro"
}

export function QuickHealthForm({ onSubmit, isSubmitting }: QuickHealthFormProps) {
  const [animales, setAnimales] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
    watch,
  } = useForm<QuickHealthData>({
    resolver: zodResolver(quickHealthSchema),
    defaultValues: {
      fecha: new Date().toISOString().split('T')[0],
      tipoEvento: "vacunacion",
    },
  })

  const selectedAnimalId = watch("animalId")
  const tipoEvento = watch("tipoEvento")

  useEffect(() => {
    fetch('/api/ganado/bovinos?limit=1000')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setAnimales(data.data)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleFormSubmit = async (data: QuickHealthData) => {
    await onSubmit(data)
    reset({
      fecha: new Date().toISOString().split('T')[0],
      tipoEvento: "vacunacion",
    })
    setSearchTerm("")
  }

  // Filtrar animales por término de búsqueda
  const filteredAnimales = animales.filter(animal =>
    animal.caravanaVisual.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (animal.nombre && animal.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-purple-800">
          <Syringe className="inline h-4 w-4 mr-1" />
          <strong>Evento Sanitario Rápido:</strong> Registra vacunaciones, tratamientos o curaciones
          de forma rápida. Se creará un registro en el historial sanitario del animal.
        </p>
      </div>

      <div className="space-y-4">
        {/* Selección de Animal */}
        <div className="space-y-2">
          <Label htmlFor="animalId">
            Animal * <span className="text-xs text-gray-500">(Busca por caravana o nombre)</span>
          </Label>
          <Input
            type="text"
            placeholder="Buscar animal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-2"
          />
          <Select onValueChange={(value) => setValue("animalId", value)}>
            <SelectTrigger className={errors.animalId ? "border-red-500" : ""}>
              <SelectValue placeholder="Seleccionar animal" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {filteredAnimales.length === 0 ? (
                <div className="px-2 py-4 text-center text-sm text-gray-500">
                  No se encontraron animales
                </div>
              ) : (
                filteredAnimales.map((animal) => (
                  <SelectItem key={animal.id} value={animal.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{animal.caravanaVisual}</span>
                      {animal.nombre && (
                        <span className="text-gray-500">- {animal.nombre}</span>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {errors.animalId && (
            <p className="text-sm text-red-600">{errors.animalId.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tipo de Evento */}
          <div className="space-y-2">
            <Label htmlFor="tipoEvento">Tipo de Evento *</Label>
            <Select
              onValueChange={(value: any) => setValue("tipoEvento", value)}
              defaultValue="vacunacion"
            >
              <SelectTrigger className={errors.tipoEvento ? "border-red-500" : ""}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_EVENTO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tipoEvento && (
              <p className="text-sm text-red-600">{errors.tipoEvento.message}</p>
            )}
          </div>

          {/* Fecha */}
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha del Evento *</Label>
            <Input
              id="fecha"
              type="date"
              {...register("fecha")}
              className={errors.fecha ? "border-red-500" : ""}
            />
            {errors.fecha && (
              <p className="text-sm text-red-600">{errors.fecha.message}</p>
            )}
          </div>
        </div>

        {/* Descripción */}
        <div className="space-y-2">
          <Label htmlFor="descripcion">
            Descripción *
            <span className="text-xs text-gray-500 ml-1">
              (Nombre de la vacuna, tratamiento aplicado, etc.)
            </span>
          </Label>
          <Input
            id="descripcion"
            {...register("descripcion")}
            placeholder="Ej: Vacuna antiaftosa, Tratamiento antibiótico, etc."
            className={errors.descripcion ? "border-red-500" : ""}
            autoFocus={!!selectedAnimalId}
          />
          {errors.descripcion && (
            <p className="text-sm text-red-600">{errors.descripcion.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Producto */}
          <div className="space-y-2">
            <Label htmlFor="producto">
              Producto/Medicamento <span className="text-xs text-gray-500">(Opcional)</span>
            </Label>
            <Input
              id="producto"
              {...register("producto")}
              placeholder="Ej: Nombre comercial del producto"
            />
          </div>

          {/* Dosis */}
          <div className="space-y-2">
            <Label htmlFor="dosis">
              Dosis <span className="text-xs text-gray-500">(Opcional)</span>
            </Label>
            <Input
              id="dosis"
              {...register("dosis")}
              placeholder="Ej: 5ml, 10mg/kg, etc."
            />
          </div>
        </div>

        {/* Veterinario */}
        <div className="space-y-2">
          <Label htmlFor="veterinario">
            Veterinario <span className="text-xs text-gray-500">(Opcional)</span>
          </Label>
          <Input
            id="veterinario"
            {...register("veterinario")}
            placeholder="Nombre del veterinario que realizó el procedimiento"
          />
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-purple-600 hover:bg-purple-700"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Registrando...
            </>
          ) : (
            <>
              <Syringe className="h-4 w-4 mr-2" />
              Registrar Evento
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-gray-500 text-center">
        El evento se agregará al historial sanitario del animal
      </p>
    </form>
  )
}
