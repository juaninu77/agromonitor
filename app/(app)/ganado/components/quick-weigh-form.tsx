"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Scale } from "lucide-react"
import { useEffect, useState } from "react"

// Schema para registro rápido de pesada
const quickWeighSchema = z.object({
  animalId: z.string().min(1, "Debes seleccionar un animal"),
  peso: z.number().min(1, "El peso debe ser mayor a 0").max(2000, "Peso máximo 2000 kg"),
  fecha: z.string().min(1, "La fecha es requerida"),
  notas: z.string().optional(),
})

type QuickWeighData = z.infer<typeof quickWeighSchema>

interface QuickWeighFormProps {
  onSubmit: (data: QuickWeighData) => Promise<void>
  isSubmitting: boolean
}

interface Animal {
  id: string
  caravanaVisual: string
  nombre?: string
}

export function QuickWeighForm({ onSubmit, isSubmitting }: QuickWeighFormProps) {
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
  } = useForm<QuickWeighData>({
    resolver: zodResolver(quickWeighSchema),
    defaultValues: {
      fecha: new Date().toISOString().split('T')[0],
    },
  })

  const selectedAnimalId = watch("animalId")

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

  const handleFormSubmit = async (data: QuickWeighData) => {
    await onSubmit(data)
    reset({
      fecha: new Date().toISOString().split('T')[0],
    })
    setSearchTerm("") // Limpiar búsqueda
  }

  // Filtrar animales por término de búsqueda
  const filteredAnimales = animales.filter(animal =>
    animal.caravanaVisual.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (animal.nombre && animal.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-green-600" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-green-800">
          <Scale className="inline h-4 w-4 mr-1" />
          <strong>Pesada Rápida:</strong> Registra el peso actual del animal de forma rápida.
          Se creará automáticamente un registro de peso en el historial.
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
          {/* Peso */}
          <div className="space-y-2">
            <Label htmlFor="peso">
              Peso (kg) * <span className="text-xs text-gray-500">(1-2000 kg)</span>
            </Label>
            <Input
              id="peso"
              type="number"
              step="0.1"
              {...register("peso", { valueAsNumber: true })}
              placeholder="350.5"
              autoFocus={!!selectedAnimalId}
              className={errors.peso ? "border-red-500" : ""}
            />
            {errors.peso && (
              <p className="text-sm text-red-600">{errors.peso.message}</p>
            )}
          </div>

          {/* Fecha */}
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha de Pesada *</Label>
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

        {/* Notas opcionales */}
        <div className="space-y-2">
          <Label htmlFor="notas">
            Notas <span className="text-xs text-gray-500">(Opcional)</span>
          </Label>
          <Input
            id="notas"
            {...register("notas")}
            placeholder="Ej: Pesada de rutina, pre-venta, etc."
          />
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Registrando...
            </>
          ) : (
            <>
              <Scale className="h-4 w-4 mr-2" />
              Registrar Pesada
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-gray-500 text-center">
        El peso se agregará al historial del animal y se actualizará su peso actual
      </p>
    </form>
  )
}
