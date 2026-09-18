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
import { AnimalPicker } from "@/components/ganado/animal-picker"

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



const TIPO_EVENTO_LABELS: Record<string, string> = {
  vacunacion: "Vacunación",
  desparasitacion: "Desparasitación",
  tratamiento: "Tratamiento",
  curacion: "Curación",
  otro: "Otro"
}

export function QuickHealthForm({ onSubmit, isSubmitting }: QuickHealthFormProps) {
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

  const handleFormSubmit = async (data: QuickHealthData) => {
    try { await onSubmit(data) } catch { return }
    reset({
      animalId: "", descripcion: "", producto: "", dosis: "", veterinario: "",
      fecha: new Date().toISOString().split('T')[0],
      tipoEvento: "vacunacion",
    })

  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="space-y-4">
        <AnimalPicker value={selectedAnimalId || ""} onChange={id => setValue("animalId", id, { shouldValidate: !!id })} disabled={isSubmitting} error={errors.animalId?.message} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tipo de Evento */}
          <div className="space-y-2">
            <Label htmlFor="tipoEvento">Tipo de Evento *</Label>
            <Select
              onValueChange={(value: any) => setValue("tipoEvento", value)}
              value={tipoEvento}
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
            <span className="text-xs text-muted-foreground ml-1">
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
              Producto/Medicamento <span className="text-xs text-muted-foreground">(Opcional)</span>
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
              Dosis <span className="text-xs text-muted-foreground">(Opcional)</span>
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
            Veterinario <span className="text-xs text-muted-foreground">(Opcional)</span>
          </Label>
          <Input
            id="veterinario"
            {...register("veterinario")}
            placeholder="Nombre del veterinario que realizó el procedimiento"
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
              <Syringe className="h-4 w-4 mr-2" />
              Registrar Evento
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        El evento se agregará al historial sanitario del animal
      </p>
    </form>
  )
}
