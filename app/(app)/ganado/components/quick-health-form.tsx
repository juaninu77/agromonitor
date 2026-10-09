"use client"

import { useQuery } from "@tanstack/react-query"
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
import { useTenant } from "@/lib/context/tenant-context"
import { hoyArgentina } from "@/lib/inventario/fechas"
import { esSanitario } from "@/lib/inventario/validation"

// Schema para registro rápido de evento sanitario
const quickHealthSchema = z.object({
  animalId: z.string().min(1, "Debes seleccionar un animal"),
  tipoEvento: z.enum(["vacunacion", "desparasitacion", "tratamiento", "curacion", "otro"], {
    required_error: "El tipo de evento es requerido",
  }),
  descripcion: z.string().optional(),
  fecha: z.string().min(1, "La fecha es requerida"),
  productoId: z.string().min(1, "Elegí el producto aplicado"),
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
  const { organizacionActiva } = useTenant()
  // Insumos sanitarios activos del inventario de la organización
  const { data: productos = [] } = useQuery({
    queryKey: ["inventario", "sanitarios", "lista"],
    queryFn: async () => {
      const res = await fetch("/api/inventario?limit=500")
      const json = await res.json().catch(() => ({}))
      return (json.data ?? []) as { id: string; nombre: string; tipo: string; activo: boolean; organizacionId: string | null }[]
    },
    staleTime: 60_000,
  })
  const sanitarios = productos.filter((p) => esSanitario(p.tipo) && p.activo && (!organizacionActiva || p.organizacionId === organizacionActiva.id))
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
      fecha: hoyArgentina(),
      tipoEvento: "vacunacion",
    },
  })

  const selectedAnimalId = watch("animalId")
  const tipoEvento = watch("tipoEvento")
  const productoId = watch("productoId")

  const handleFormSubmit = async (data: QuickHealthData) => {
    try { await onSubmit(data) } catch { return }
    reset({
      animalId: "", descripcion: "", productoId: "", dosis: "", veterinario: "",
      fecha: hoyArgentina(),
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
            Observaciones <span className="text-xs text-muted-foreground">(Opcional)</span>
          </Label>
          <Input
            id="descripcion"
            {...register("descripcion")}
            placeholder="Ej: refuerzo, herida en mano derecha…"
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
            <Label htmlFor="productoId">Producto aplicado *</Label>
            <Select value={productoId || ""} onValueChange={(v) => setValue("productoId", v, { shouldValidate: true })}>
              <SelectTrigger id="productoId" className={errors.productoId ? "border-red-500" : ""}>
                <SelectValue placeholder={sanitarios.length ? "Elegir del inventario" : "Sin insumos sanitarios"} />
              </SelectTrigger>
              <SelectContent>
                {sanitarios.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.productoId && <p className="text-sm text-red-600">{errors.productoId.message}</p>}
            {!sanitarios.length && <p className="text-xs text-muted-foreground">Cargá el producto en Inventario para poder registrarlo.</p>}
          </div>

          {/* Dosis */}
          <div className="space-y-2">
            <Label htmlFor="dosis">
              Dosis en ml <span className="text-xs text-muted-foreground">(Opcional)</span>
            </Label>
            <Input
              id="dosis"
              {...register("dosis")}
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              placeholder="Ej: 5"
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
