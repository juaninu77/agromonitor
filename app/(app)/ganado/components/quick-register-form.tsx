"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Loader2, 
  Tag, 
  Dna, 
  Baby, 
  Scale, 
  Calendar, 
  Zap,
  CheckCircle2,
  Circle
} from "lucide-react"
import { useEffect, useState } from "react"
import { VisualIdGuide } from "./visual-id-guide"
import { cn } from "@/lib/utils"

// Schema simplificado - solo campos esenciales
const quickRegisterSchema = z.object({
  caravanaVisual: z.string().min(1, "La caravana es requerida"),
  razaId: z.string().min(1, "La raza es requerida"),
  categoriaId: z.string().min(1, "La categoría es requerida"),
  sexo: z.enum(["M", "F"]),
  pesoInicial: z.number().optional(),
  fechaNacimiento: z.string().optional(),
})

type QuickRegisterData = z.infer<typeof quickRegisterSchema>

interface QuickRegisterFormProps {
  onSubmit: (data: QuickRegisterData) => Promise<void>
  isSubmitting: boolean
}

interface Raza {
  id: string
  nombre: string
}

interface Categoria {
  id: string
  nombre: string
}

export function QuickRegisterForm({ onSubmit, isSubmitting }: QuickRegisterFormProps) {
  const [razas, setRazas] = useState<Raza[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<QuickRegisterData>({
    resolver: zodResolver(quickRegisterSchema),
    defaultValues: {
      sexo: "M",
    },
  })

  const selectedSexo = watch("sexo")

  useEffect(() => {
    Promise.all([
      fetch("/api/razas?especie=bovino").then((r) => r.json()),
      fetch("/api/categorias?especie=bovino").then((r) => r.json()),
    ]).then(([razasData, categoriasData]) => {
      if (razasData.success)
        setRazas((razasData.data || []).map((r: { id: string; nombre: string }) => ({ id: r.id, nombre: r.nombre })))
      if (categoriasData.success)
        setCategorias((categoriasData.data || []).map((c: { id: string; nombre: string }) => ({ id: c.id, nombre: c.nombre })))
    }).finally(() => setLoading(false))
  }, [])

  const handleFormSubmit = async (data: QuickRegisterData) => {
    await onSubmit(data)
    reset() // Limpiar formulario para siguiente registro
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-sm text-slate-500">Cargando opciones...</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <Zap className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-900">Registro Ultrarrápido</p>
          <p className="text-xs text-blue-700">
            Ideal para trabajos en manga. Solo los datos críticos para no detener el flujo.
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Formulario Principal */}
        <div className="flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Caravana Visual */}
            <div className="space-y-2">
              <Label htmlFor="caravanaVisual" className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-slate-500" />
                Caravana Visual *
              </Label>
              <div className="relative">
                <Input
                  id="caravanaVisual"
                  {...register("caravanaVisual")}
                  placeholder="Ej: 001"
                  autoFocus
                  className={cn(
                    "pl-9 h-11 border-2 transition-all focus:ring-blue-500 focus:border-blue-500",
                    errors.caravanaVisual ? "border-red-500 bg-red-50" : "border-slate-200"
                  )}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">#</span>
              </div>
              {errors.caravanaVisual && (
                <p className="text-xs text-red-600 font-medium">{errors.caravanaVisual.message}</p>
              )}
            </div>

            {/* Sexo - Card Selector */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Dna className="h-4 w-4 text-slate-500" />
                Sexo *
              </Label>
              <div className="grid grid-cols-2 gap-3 h-11">
                <button
                  type="button"
                  onClick={() => setValue("sexo", "M")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border-2 transition-all",
                    selectedSexo === "M" 
                      ? "border-blue-600 bg-blue-50 text-blue-700" 
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  )}
                >
                  {selectedSexo === "M" ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4 opacity-20" />}
                  <span className="text-sm font-semibold">Macho</span>
                </button>
                <button
                  type="button"
                  onClick={() => setValue("sexo", "F")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border-2 transition-all",
                    selectedSexo === "F" 
                      ? "border-pink-600 bg-pink-50 text-pink-700" 
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  )}
                >
                  {selectedSexo === "F" ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4 opacity-20" />}
                  <span className="text-sm font-semibold">Hembra</span>
                </button>
              </div>
            </div>

            {/* Raza */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-slate-500" />
                Raza *
              </Label>
              <Select onValueChange={(value) => setValue("razaId", value)}>
                <SelectTrigger className={cn("h-11 border-2", errors.razaId ? "border-red-500" : "border-slate-200")}>
                  <SelectValue placeholder="Seleccionar raza" />
                </SelectTrigger>
                <SelectContent>
                  {razas.map((raza) => (
                    <SelectItem key={raza.id} value={raza.id}>
                      {raza.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.razaId && (
                <p className="text-xs text-red-600 font-medium">{errors.razaId.message}</p>
              )}
            </div>

            {/* Categoría */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Baby className="h-4 w-4 text-slate-500" />
                Categoría *
              </Label>
              <Select onValueChange={(value) => setValue("categoriaId", value)}>
                <SelectTrigger className={cn("h-11 border-2", errors.categoriaId ? "border-red-500" : "border-slate-200")}>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      {categoria.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoriaId && (
                <p className="text-xs text-red-600 font-medium">{errors.categoriaId.message}</p>
              )}
            </div>

            {/* Peso Inicial */}
            <div className="space-y-2">
              <Label htmlFor="pesoInicial" className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-slate-500" />
                Peso Inicial (kg)
              </Label>
              <div className="relative">
                <Input
                  id="pesoInicial"
                  type="number"
                  step="0.1"
                  {...register("pesoInicial", { valueAsNumber: true })}
                  placeholder="250.0"
                  className="pl-9 h-11 border-2 border-slate-200"
                />
                <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Fecha Nacimiento */}
            <div className="space-y-2">
              <Label htmlFor="fechaNacimiento" className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                Fecha Nacimiento
              </Label>
              <div className="relative">
                <Input
                  id="fechaNacimiento"
                  type="date"
                  {...register("fechaNacimiento")}
                  className="pl-9 h-11 border-2 border-slate-200"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Guía Visual Lateral */}
        <div className="w-full lg:w-[240px] shrink-0">
          <VisualIdGuide />
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex gap-4 pt-6 border-t border-slate-100">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Registrando...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Registrar y Siguiente
            </>
          )}
        </Button>
      </div>

      <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold">
        Agromonitor Field Ready v1.0
      </p>
    </form>
  )
}
