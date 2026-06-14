"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { 
  Loader2, 
  Tag, 
  CheckCircle2,
  Circle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Scale,
  Calendar,
  Beef,
  Baby,
  Crown,
  Heart,
  Info,
  RotateCcw,
  Repeat,
  X,
  ChevronRight,
  Zap,
  Target,
  ClipboardList
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Schema de validación
const registerSchema = z.object({
  especieId: z.string().min(1, "Seleccioná el tipo de animal"),
  caravanaVisual: z.string().min(1, "La caravana es obligatoria"),
  razaId: z.string().min(1, "Selecciona una raza"),
  categoriaId: z.string().min(1, "Selecciona una categoría"),
  sexo: z.enum(["M", "F"]),
  fechaNacimiento: z.string().optional(),
  pesoInicial: z.number().optional(),
  origen: z.enum(["cria_propia", "compra", "otro"]).default("cria_propia"),
  notas: z.string().optional(),
})

type RegisterData = z.infer<typeof registerSchema>

interface EspecieOpt {
  id: string
  nombre: string
}

interface Raza {
  id: string
  nombre: string
}


interface Categoria {
  id: string
  nombre: string
  sexo?: string | null
  edadMinMeses?: number | null
  edadMaxMeses?: number | null
}

interface IntuitiveRegisterWizardProps {
  onSubmit: (data: RegisterData) => Promise<void>
  onClose: () => void
  isSubmitting: boolean
}

// Componente de selección visual para categorías
function CategorySelector({ 
  categorias, 
  selectedSexo, 
  selectedCategoria,
  onSelect,
  fechaNacimiento 
}: { 
  categorias: Categoria[]
  selectedSexo: "M" | "F"
  selectedCategoria: string
  onSelect: (id: string) => void
  fechaNacimiento?: string
}) {
  // Calcular edad en meses si hay fecha de nacimiento
  const edadMeses = fechaNacimiento ? (() => {
    const nacimiento = new Date(fechaNacimiento)
    const hoy = new Date()
    return (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + (hoy.getMonth() - nacimiento.getMonth())
  })() : null

  // Filtrar y ordenar categorías por sexo
  const categoriasFiltradas = categorias.filter(cat => {
    if (cat.sexo === null) return true
    return cat.sexo === selectedSexo
  })

  // Sugerir categoría basada en edad
  const categoriaSugerida = edadMeses !== null ? categoriasFiltradas.find(cat => {
    const min = cat.edadMinMeses
    const max = cat.edadMaxMeses
    if (min != null && edadMeses < min) return false
    if (max != null && edadMeses > max) return false
    return true
  }) : null

  const getCategoryIcon = (nombre: string) => {
    const lower = nombre.toLowerCase()
    if (lower.includes("ternero") || lower.includes("ternera")) return Baby
    if (lower.includes("toro")) return Crown
    if (lower.includes("vaca")) return Heart
    if (lower.includes("novillo") || lower.includes("vaquillona")) return Target
    if (lower.includes("cordero") || lower.includes("cordera") || lower.includes("oveja") || lower.includes("carnero") || lower.includes("borrego")) return Heart
    if (lower.includes("potrill") || lower.includes("potranc") || lower.includes("caballo") || lower.includes("yegua") || lower.includes("semiental") || lower.includes("semental")) return Zap
    return Beef
  }

  const getCategoryColor = (nombre: string, isSelected: boolean, isSuggested: boolean) => {
    if (isSelected) return "border-blue-600 bg-blue-50 text-blue-700 shadow-lg shadow-blue-100"
    if (isSuggested) return "border-emerald-400 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200"
    return "border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50"
  }

  return (
    <div className="space-y-3">
      {edadMeses !== null && categoriaSugerida && (
        <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <span className="text-sm text-emerald-700">
            Sugerencia: <strong>{categoriaSugerida.nombre}</strong> basada en la edad ({edadMeses} meses)
          </span>
        </div>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {categoriasFiltradas.map((cat) => {
          const Icon = getCategoryIcon(cat.nombre)
          const isSelected = selectedCategoria === cat.id
          const isSuggested = categoriaSugerida?.id === cat.id && !isSelected

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                getCategoryColor(cat.nombre, isSelected, isSuggested)
              )}
            >
              <Icon className="h-8 w-8" />
              <span className="text-sm font-semibold text-center">{cat.nombre}</span>
              {isSelected && (
                <CheckCircle2 className="h-4 w-4 text-blue-600 absolute top-2 right-2" />
              )}
              {isSuggested && !isSelected && (
                <Badge className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px]">
                  Sugerida
                </Badge>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Componente de selección de raza
function RazaSelector({
  razas,
  selectedRaza,
  onSelect
}: {
  razas: Raza[]
  selectedRaza: string
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState("")

  const razasFiltradas = razas.filter(r => 
    r.nombre.toLowerCase().includes(search.toLowerCase())
  )

  const razasComunes = ["Angus", "Hereford", "Brangus", "Braford", "Charolais", "Limousin"]
  const razasDestacadas = razas.filter(r => razasComunes.some(rc => r.nombre.toLowerCase().includes(rc.toLowerCase())))
  const otrasRazas = razas.filter(r => !razasComunes.some(rc => r.nombre.toLowerCase().includes(rc.toLowerCase())))

  return (
    <div className="space-y-4">
      <div className="relative">
        <Input
          placeholder="Buscar raza..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 border-2"
        />
        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      </div>

      {search === "" && (
        <>
          <div className="space-y-2">
            <Label className="text-xs text-slate-500 uppercase tracking-wider">Razas más comunes</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {razasDestacadas.map((raza) => (
                <button
                  key={raza.id}
                  type="button"
                  onClick={() => onSelect(raza.id)}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                    selectedRaza === raza.id
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  )}
                >
                  {selectedRaza === raza.id && <CheckCircle2 className="h-4 w-4" />}
                  <span className="font-medium">{raza.nombre}</span>
                </button>
              ))}
            </div>
          </div>

          {otrasRazas.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-slate-500 uppercase tracking-wider">Otras razas</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {otrasRazas.map((raza) => (
                  <button
                    key={raza.id}
                    type="button"
                    onClick={() => onSelect(raza.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 p-2 rounded-lg border transition-all text-sm",
                      selectedRaza === raza.id
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 hover:border-slate-300 text-slate-500"
                    )}
                  >
                    {selectedRaza === raza.id && <CheckCircle2 className="h-3 w-3" />}
                    <span>{raza.nombre}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {search !== "" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {razasFiltradas.map((raza) => (
            <button
              key={raza.id}
              type="button"
              onClick={() => onSelect(raza.id)}
              className={cn(
                "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                selectedRaza === raza.id
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-200 hover:border-slate-300 text-slate-600"
              )}
            >
              {selectedRaza === raza.id && <CheckCircle2 className="h-4 w-4" />}
              <span className="font-medium">{raza.nombre}</span>
            </button>
          ))}
          {razasFiltradas.length === 0 && (
            <p className="col-span-full text-center text-slate-500 py-4">
              No se encontraron razas con "{search}"
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function IntuitiveRegisterWizard({ onSubmit, onClose, isSubmitting }: IntuitiveRegisterWizardProps) {
  const [step, setStep] = useState(1)
  const [especies, setEspecies] = useState<EspecieOpt[]>([])
  const [razas, setRazas] = useState<Raza[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loadingEspecies, setLoadingEspecies] = useState(true)
  const [catalogosLoading, setCatalogosLoading] = useState(false)
  const [registeredCount, setRegisteredCount] = useState(0)
  const [continueRegistering, setContinueRegistering] = useState(true)
  const prevEspecieRef = useRef<string | null>(null)

  const totalSteps = 3

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
    trigger,
  } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      sexo: "M",
      origen: "cria_propia",
      especieId: "",
    },
  })

  const selectedSexo = watch("sexo")
  const selectedRaza = watch("razaId")
  const selectedCategoria = watch("categoriaId")
  const fechaNacimiento = watch("fechaNacimiento")
  const especieIdWatch = watch("especieId")

  const cargarCatalogos = useCallback(async (nombreEspecie: string) => {
    const [razasData, categoriasData] = await Promise.all([
      fetch(`/api/razas?especie=${encodeURIComponent(nombreEspecie)}`).then((r) => r.json()),
      fetch(`/api/categorias?especie=${encodeURIComponent(nombreEspecie)}`).then((r) => r.json()),
    ])
    if (razasData.success) {
      setRazas((razasData.data || []).map((r: { id: string; nombre: string }) => ({ id: r.id, nombre: r.nombre })))
    } else {
      setRazas([])
    }
    if (categoriasData.success) {
      setCategorias(
        (categoriasData.data || []).map((c: Categoria) => ({
          id: c.id,
          nombre: c.nombre,
          sexo: c.sexo,
          edadMinMeses: c.edadMinMeses,
          edadMaxMeses: c.edadMaxMeses,
        }))
      )
    } else {
      setCategorias([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const espRes = await fetch("/api/especies")
        const espJson = await espRes.json()
        if (!espJson.success || cancelled) return
        const list = espJson.data as EspecieOpt[]
        setEspecies(list)
        const bov = list.find((e) => e.nombre === "bovino")
        const initialId = bov?.id ?? list[0]?.id
        if (initialId) {
          setValue("especieId", initialId)
        }
      } finally {
        if (!cancelled) setLoadingEspecies(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setValue])

  useEffect(() => {
    if (especies.length === 0 || !especieIdWatch) return
    const nombre = especies.find((e) => e.id === especieIdWatch)?.nombre
    if (!nombre) return

    if (prevEspecieRef.current !== null && prevEspecieRef.current !== especieIdWatch) {
      setValue("razaId", "")
      setValue("categoriaId", "")
    }
    prevEspecieRef.current = especieIdWatch

    let cancelled = false
    ;(async () => {
      setCatalogosLoading(true)
      try {
        await cargarCatalogos(nombre)
      } finally {
        if (!cancelled) setCatalogosLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [especieIdWatch, especies, cargarCatalogos, setValue])

  const nextStep = async () => {
    let fieldsToValidate: (keyof RegisterData)[] = []

    if (step === 1) fieldsToValidate = ["especieId", "caravanaVisual", "sexo"]
    if (step === 2) fieldsToValidate = ["razaId", "categoriaId"]

    const isStepValid = await trigger(fieldsToValidate)
    if (isStepValid) setStep((s) => Math.min(s + 1, totalSteps))
  }

  const prevStep = () => setStep((s) => Math.max(s - 1, 1))

  const handleFormSubmit = async (data: RegisterData) => {
    try {
      await onSubmit(data)
      setRegisteredCount((prev) => prev + 1)

      if (continueRegistering) {
        reset({
          especieId: data.especieId,
          sexo: data.sexo,
          razaId: data.razaId,
          origen: data.origen,
          categoriaId: "",
          caravanaVisual: "",
          fechaNacimiento: "",
          pesoInicial: undefined,
          notas: "",
        })
        setStep(1)

        toast.success("¡Animal registrado!", {
          description: `#${data.caravanaVisual} agregado. Total: ${registeredCount + 1} animales`,
        })
      } else {
        onClose()
      }
    } catch {
      // El error ya se maneja en el componente padre
    }
  }

  const progressPercent = (step / totalSteps) * 100

  const labelEspecie = (nombre: string) => {
    const n = nombre.toLowerCase()
    if (n === "bovino") return "Bovino"
    if (n === "ovino") return "Ovino"
    if (n === "equino") return "Equino"
    if (n === "caprino") return "Caprino"
    return nombre.charAt(0).toUpperCase() + nombre.slice(1)
  }

  if (loadingEspecies) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="mt-3 text-slate-500">Preparando formulario...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con progreso */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Zap className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Registro de Animal</h2>
              <p className="text-sm text-slate-500">Paso {step} de {totalSteps}</p>
            </div>
          </div>
          
          {registeredCount > 0 && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {registeredCount} registrado{registeredCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Barra de progreso */}
        <div className="relative">
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between mt-2">
            {["Identificación", "Clasificación", "Detalles"].map((label, i) => (
              <div 
                key={label}
                className={cn(
                  "text-xs font-medium transition-colors",
                  i + 1 <= step ? "text-blue-600" : "text-slate-400"
                )}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* PASO 1: Identificación básica */}
        {step === 1 && (
          <Card className="border-2 border-slate-100 shadow-sm">
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Identificación del animal</p>
                  <p className="text-xs text-blue-700">
                    Elegí la especie (bovino, ovino, equino…), el número de caravana visual y el sexo.
                  </p>
                </div>
              </div>

              {/* Especie */}
              <div className="space-y-3">
                <Label className="text-base font-bold text-slate-700">Tipo de animal</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {especies.map((esp) => {
                    const active = especieIdWatch === esp.id
                    return (
                      <button
                        key={esp.id}
                        type="button"
                        onClick={() => setValue("especieId", esp.id, { shouldValidate: true })}
                        className={cn(
                          "rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all",
                          active
                            ? "border-blue-600 bg-blue-50 text-blue-800 shadow-md"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        )}
                      >
                        {labelEspecie(esp.nombre)}
                      </button>
                    )
                  })}
                </div>
                {errors.especieId && (
                  <p className="text-sm text-red-600 font-medium flex items-center gap-1">
                    <X className="h-4 w-4" />
                    {errors.especieId.message}
                  </p>
                )}
              </div>

              {/* Caravana Visual */}
              <div className="space-y-3">
                <Label className="text-base font-bold text-slate-700 flex items-center gap-2">
                  <Tag className="h-5 w-5 text-slate-500" />
                  Número de Caravana
                </Label>
                <div className="relative">
                  <Input
                    {...register("caravanaVisual")}
                    placeholder="Ej: 001, A-123, etc."
                    autoFocus
                    className={cn(
                      "h-14 text-2xl font-bold text-center border-2 transition-all",
                      errors.caravanaVisual 
                        ? "border-red-400 bg-red-50 focus:border-red-500" 
                        : "border-slate-200 focus:border-blue-500"
                    )}
                  />
                </div>
                {errors.caravanaVisual && (
                  <p className="text-sm text-red-600 font-medium flex items-center gap-1">
                    <X className="h-4 w-4" />
                    {errors.caravanaVisual.message}
                  </p>
                )}
              </div>

              {/* Selector de Sexo */}
              <div className="space-y-3">
                <Label className="text-base font-bold text-slate-700">Sexo del Animal</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setValue("sexo", "M")}
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all duration-200",
                      selectedSexo === "M"
                        ? "border-blue-600 bg-blue-50 text-blue-700 shadow-lg shadow-blue-100"
                        : "border-slate-200 hover:border-slate-300 text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-full",
                      selectedSexo === "M" ? "bg-blue-100" : "bg-slate-100"
                    )}>
                      <Crown className="h-8 w-8" />
                    </div>
                    <span className="text-lg font-bold">MACHO</span>
                    {selectedSexo === "M" && <CheckCircle2 className="h-5 w-5 text-blue-600" />}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setValue("sexo", "F")}
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all duration-200",
                      selectedSexo === "F"
                        ? "border-pink-600 bg-pink-50 text-pink-700 shadow-lg shadow-pink-100"
                        : "border-slate-200 hover:border-slate-300 text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-full",
                      selectedSexo === "F" ? "bg-pink-100" : "bg-slate-100"
                    )}>
                      <Heart className="h-8 w-8" />
                    </div>
                    <span className="text-lg font-bold">HEMBRA</span>
                    {selectedSexo === "F" && <CheckCircle2 className="h-5 w-5 text-pink-600" />}
                  </button>
                </div>
              </div>

              {/* Fecha de Nacimiento (opcional pero útil) */}
              <div className="space-y-3">
                <Label className="text-base font-bold text-slate-700 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-slate-500" />
                  Fecha de Nacimiento
                  <Badge variant="outline" className="text-xs">Opcional</Badge>
                </Label>
                <Input
                  type="date"
                  {...register("fechaNacimiento")}
                  className="h-12 border-2 border-slate-200"
                />
                <p className="text-xs text-slate-500">
                  Si ingresas la fecha, te sugeriremos la categoría automáticamente
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PASO 2: Clasificación */}
        {step === 2 && (
          <Card className="border-2 border-slate-100 shadow-sm">
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <Sparkles className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900">Clasificación inteligente</p>
                  <p className="text-xs text-emerald-700">
                    Selecciona la raza y categoría. Te sugerimos opciones basadas en los datos anteriores.
                  </p>
                </div>
              </div>

              {/* Selector de Raza */}
              <div className="space-y-3">
                <Label className="text-base font-bold text-slate-700">Raza</Label>
                {catalogosLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm">Cargando razas y categorías…</span>
                  </div>
                ) : (
                  <RazaSelector
                    razas={razas}
                    selectedRaza={selectedRaza || ""}
                    onSelect={(id) => setValue("razaId", id)}
                  />
                )}
                {errors.razaId && (
                  <p className="text-sm text-red-600 font-medium flex items-center gap-1">
                    <X className="h-4 w-4" />
                    {errors.razaId.message}
                  </p>
                )}
              </div>

              {/* Selector de Categoría */}
              <div className="space-y-3">
                <Label className="text-base font-bold text-slate-700">
                  Categoría
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    (Mostrando para {selectedSexo === "M" ? "machos" : "hembras"})
                  </span>
                </Label>
                <CategorySelector
                  categorias={catalogosLoading ? [] : categorias}
                  selectedSexo={selectedSexo}
                  selectedCategoria={selectedCategoria || ""}
                  onSelect={(id) => setValue("categoriaId", id)}
                  fechaNacimiento={fechaNacimiento}
                />
                {errors.categoriaId && (
                  <p className="text-sm text-red-600 font-medium flex items-center gap-1">
                    <X className="h-4 w-4" />
                    {errors.categoriaId.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* PASO 3: Detalles finales */}
        {step === 3 && (
          <Card className="border-2 border-slate-100 shadow-sm">
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <ClipboardList className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Datos adicionales</p>
                  <p className="text-xs text-amber-700">
                    Información opcional para completar el registro.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Peso Inicial */}
                <div className="space-y-3">
                  <Label className="font-bold text-slate-700 flex items-center gap-2">
                    <Scale className="h-5 w-5 text-slate-500" />
                    Peso Inicial (kg)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    {...register("pesoInicial", { valueAsNumber: true })}
                    placeholder="Ej: 250"
                    className="h-12 border-2 border-slate-200"
                  />
                </div>

                {/* Origen */}
                <div className="space-y-3">
                  <Label className="font-bold text-slate-700">Origen</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "cria_propia", label: "Cría propia" },
                      { value: "compra", label: "Compra" },
                      { value: "otro", label: "Otro" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setValue("origen", opt.value as "cria_propia" | "compra" | "otro")}
                        className={cn(
                          "p-3 rounded-lg border-2 transition-all text-sm font-medium",
                          watch("origen") === opt.value
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-200 hover:border-slate-300 text-slate-600"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-3">
                <Label className="font-bold text-slate-700">Observaciones</Label>
                <Textarea
                  {...register("notas")}
                  placeholder="Notas adicionales sobre el animal..."
                  rows={3}
                  className="border-2 border-slate-200 resize-none"
                />
              </div>

              {/* Opción de continuar registrando */}
              <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <button
                  type="button"
                  onClick={() => setContinueRegistering(!continueRegistering)}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    continueRegistering ? "bg-blue-600" : "bg-slate-300"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow",
                    continueRegistering ? "translate-x-5" : "translate-x-0"
                  )} />
                </button>
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {continueRegistering ? "Continuar registrando" : "Cerrar al guardar"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {continueRegistering 
                      ? "El formulario se limpiará para registrar otro animal"
                      : "Se cerrará el diálogo después de guardar"
                    }
                  </p>
                </div>
                <Repeat className={cn(
                  "h-5 w-5 ml-auto",
                  continueRegistering ? "text-blue-600" : "text-slate-400"
                )} />
              </div>

              {/* Resumen */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                <p className="text-sm font-bold text-blue-900">Resumen del registro:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-blue-700">
                    <span className="text-blue-500">Caravana:</span> {watch("caravanaVisual") || "—"}
                  </div>
                  <div className="text-blue-700">
                    <span className="text-blue-500">Sexo:</span> {selectedSexo === "M" ? "Macho" : "Hembra"}
                  </div>
                  <div className="text-blue-700">
                    <span className="text-blue-500">Raza:</span> {razas.find(r => r.id === selectedRaza)?.nombre || "—"}
                  </div>
                  <div className="text-blue-700">
                    <span className="text-blue-500">Categoría:</span> {categorias.find(c => c.id === selectedCategoria)?.nombre || "—"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navegación */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={isSubmitting}
                className="h-12 px-6 border-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>
            )}
            
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset()
                setStep(1)
              }}
              disabled={isSubmitting}
              className="text-slate-500"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reiniciar
            </Button>
          </div>

          {step < totalSteps ? (
            <Button
              type="button"
              onClick={nextStep}
              className="h-12 px-8 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100"
            >
              Siguiente
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  {continueRegistering ? "Guardar y Siguiente" : "Guardar Animal"}
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}


