"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Scale } from "lucide-react"
import { AnimalPicker } from "@/components/ganado/animal-picker"

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



export function QuickWeighForm({ onSubmit, isSubmitting }: QuickWeighFormProps) {
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

  const handleFormSubmit = async (data: QuickWeighData) => {
    try { await onSubmit(data) } catch { return }
    reset({
      animalId: "",
      peso: undefined,
      notas: "",
      fecha: new Date().toISOString().split('T')[0],
    })

  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="space-y-4">
        <AnimalPicker value={selectedAnimalId || ""} onChange={id => setValue("animalId", id, { shouldValidate: !!id })} disabled={isSubmitting} error={errors.animalId?.message} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Peso */}
          <div className="space-y-2">
            <Label htmlFor="peso">
              Peso (kg) * <span className="text-xs text-muted-foreground">(1-2000 kg)</span>
            </Label>
            <Input
              id="peso"
              type="number"
              step="0.1"
              {...register("peso", { valueAsNumber: true })}
              value={Number.isFinite(watch("peso")) ? watch("peso") : ""}
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
            Notas <span className="text-xs text-muted-foreground">(Opcional)</span>
          </Label>
          <Input
            id="notas"
            {...register("notas")}
            placeholder="Ej: Pesada de rutina, pre-venta, etc."
          />
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-4 border-t-2 border-border">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1"
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

      <p className="text-xs text-muted-foreground text-center">
        El peso se agregará al historial del animal y se actualizará su peso actual
      </p>
    </form>
  )
}
