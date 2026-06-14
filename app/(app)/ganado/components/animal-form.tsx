"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { animalFormSchema, type AnimalFormData } from "@/lib/validations/animal-schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { 
  Loader2, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Tag, 
  Dna, 
  Baby, 
  Scale, 
  Calendar, 
  MapPin,
  ClipboardList,
  Fingerprint
} from "lucide-react"
import { useEffect, useState, useCallback, useRef } from "react"
import { useTenant } from "@/lib/context/tenant-context"
import { VisualIdGuide } from "./visual-id-guide"
import { cn } from "@/lib/utils"

interface AnimalFormProps {
  onSubmit: (data: AnimalFormData) => Promise<void>
  isSubmitting: boolean
  initialData?: Partial<AnimalFormData>
}

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
}

interface Lote {
  id: string
  nombre: string
  tipo: string
  especie: {
    id: string
    nombre: string
  }
}

const STEPS = [
  { id: 1, name: "Identificación", icon: Fingerprint },
  { id: 2, name: "Información Biológica", icon: Dna },
  { id: 3, name: "Características & Cabaña", icon: ClipboardList },
  { id: 4, name: "Ubicación & Notas", icon: MapPin },
]

export function AnimalForm({ onSubmit, isSubmitting, initialData }: AnimalFormProps) {
  const { establecimientoActivo } = useTenant()
  const [step, setStep] = useState(1)
  const [especies, setEspecies] = useState<EspecieOpt[]>([])
  const [razas, setRazas] = useState<Raza[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const prevEspecieRef = useRef<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<AnimalFormData>({
    resolver: zodResolver(animalFormSchema),
    mode: "onChange",
    defaultValues: {
      sexo: "M",
      origen: "cria_propia",
      esCabana: false,
      especieId: initialData?.especieId ?? "",
      ...initialData,
    },
  })

  const esCabana = watch("esCabana")
  const selectedSexo = watch("sexo")
  const especieIdWatch = watch("especieId")

  const cargarCatalogos = useCallback(
    async (nombreEspecie: string, especieUuid: string) => {
      const [razasRes, categoriasRes] = await Promise.all([
        fetch(`/api/razas?especie=${encodeURIComponent(nombreEspecie)}`),
        fetch(`/api/categorias?especie=${encodeURIComponent(nombreEspecie)}`),
      ])
      if (razasRes.ok) {
        const razasData = await razasRes.json()
        setRazas(
          (razasData.data || []).map((r: { id: string; nombre: string }) => ({
            id: r.id,
            nombre: r.nombre,
          }))
        )
      } else {
        setRazas([])
      }
      if (categoriasRes.ok) {
        const categoriasData = await categoriasRes.json()
        setCategorias(
          (categoriasData.data || []).map((c: { id: string; nombre: string }) => ({
            id: c.id,
            nombre: c.nombre,
          }))
        )
      } else {
        setCategorias([])
      }

      if (establecimientoActivo) {
        try {
          const lotesRes = await fetch(`/api/establecimientos/${establecimientoActivo.id}/lotes`)
          if (lotesRes.ok) {
            const lotesData = await lotesRes.json()
            setLotes(
              (lotesData || []).filter((lote: Lote) => lote.especie?.id === especieUuid)
            )
          }
        } catch (error) {
          console.error("Error loading lotes:", error)
        }
      }
    },
    [establecimientoActivo]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/especies")
        const data = await res.json()
        if (!data.success || cancelled) return
        const list = data.data as EspecieOpt[]
        setEspecies(list)
        if (list.length === 0) {
          setLoadingOptions(false)
          return
        }
        const existing = initialData?.especieId
        if (existing && list.some((e) => e.id === existing)) {
          setValue("especieId", existing)
        } else {
          const bov = list.find((e) => e.nombre === "bovino")
          if (bov) setValue("especieId", bov.id)
        }
      } catch (e) {
        console.error(e)
        setLoadingOptions(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initialData?.especieId, setValue])

  useEffect(() => {
    if (!especieIdWatch || especies.length === 0) return
    const esp = especies.find((e) => e.id === especieIdWatch)
    if (!esp) return

    if (prevEspecieRef.current !== null && prevEspecieRef.current !== especieIdWatch) {
      setValue("razaId", "")
      setValue("categoriaId", "")
    }
    prevEspecieRef.current = especieIdWatch

    let cancelled = false
    ;(async () => {
      setLoadingOptions(true)
      try {
        await cargarCatalogos(esp.nombre, esp.id)
      } finally {
        if (!cancelled) setLoadingOptions(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [especieIdWatch, especies, cargarCatalogos, setValue])

  const nextStep = async () => {
    let fieldsToValidate: any[] = []
    if (step === 1) fieldsToValidate = ["caravanaVisual", "caravanaRfid", "cuig", "otroId"]
    if (step === 2) fieldsToValidate = ["especieId", "razaId", "categoriaId", "sexo", "fechaNacimiento", "origen"]
    
    const isStepValid = await trigger(fieldsToValidate)
    if (isStepValid) setStep((s) => Math.min(s + 1, 4))
  }

  const prevStep = () => setStep((s) => Math.max(s - 1, 1))

  return (
    <div className="space-y-8">
      {/* Indicador de Pasos */}
      <nav aria-label="Progress">
        <ol role="list" className="flex items-center">
          {STEPS.map((s, index) => (
            <li key={s.name} className={cn(index !== STEPS.length - 1 ? "pr-8 sm:pr-20" : "", "relative")}>
              {s.id < step ? (
                <>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="h-0.5 w-full bg-blue-600" />
                  </div>
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
                    <Check className="h-5 w-5 text-white" aria-hidden="true" />
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-blue-600 uppercase">
                      {s.name}
                    </span>
                  </div>
                </>
              ) : s.id === step ? (
                <>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="h-0.5 w-full bg-slate-200" />
                  </div>
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-600 bg-white" aria-current="step">
                    <s.icon className="h-4 w-4 text-blue-600" />
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-blue-600 uppercase">
                      {s.name}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="h-0.5 w-full bg-slate-200" />
                  </div>
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-200 bg-white">
                    <s.icon className="h-4 w-4 text-slate-400" />
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-slate-400 uppercase">
                      {s.name}
                    </span>
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <form onSubmit={handleSubmit(onSubmit)} className="pt-6">
        {/* PASO 1: Identificación */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Fingerprint className="h-5 w-5 text-blue-600" />
                  Identificación del Animal
                </h3>
                <p className="text-sm text-slate-500">Registra las marcas y números oficiales para seguimiento.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="caravanaVisual" className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-slate-500" />
                    Caravana Visual *
                  </Label>
                  <Input
                    id="caravanaVisual"
                    {...register("caravanaVisual")}
                    placeholder="Ej: 001"
                    className={cn("h-11 border-2 transition-all", errors.caravanaVisual ? "border-red-500 focus:ring-red-200" : "border-slate-200")}
                  />
                  {errors.caravanaVisual && (
                    <p className="text-xs text-red-600 font-medium">{errors.caravanaVisual.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="caravanaRfid" className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-slate-400" />
                    Caravana RFID / Botón
                  </Label>
                  <Input
                    id="caravanaRfid"
                    {...register("caravanaRfid")}
                    placeholder="Ej: 982000..."
                    className="h-11 border-2 border-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cuig" className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-slate-400" />
                    CUIG (SENASA)
                  </Label>
                  <Input
                    id="cuig"
                    {...register("cuig")}
                    placeholder="CUIG del animal"
                    className="h-11 border-2 border-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="otroId" className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-slate-400" />
                    Nombre / Otro ID
                  </Label>
                  <Input
                    id="otroId"
                    {...register("otroId")}
                    placeholder="Identificador interno"
                    className="h-11 border-2 border-slate-200"
                  />
                </div>
              </div>
            </div>
            <div className="shrink-0">
              <VisualIdGuide />
            </div>
          </div>
        )}

        {/* PASO 2: Información Biológica */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Dna className="h-5 w-5 text-blue-600" />
                Información Biológica
              </h3>
              <p className="text-sm text-slate-500">Datos genéticos y de origen para trazabilidad.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2">Especie *</Label>
                <Select
                  value={especieIdWatch || undefined}
                  onValueChange={(value) => setValue("especieId", value)}
                  disabled={loadingOptions || especies.length === 0}
                >
                  <SelectTrigger className={cn("h-11 border-2", errors.especieId ? "border-red-500" : "border-slate-200")}>
                    <SelectValue placeholder={loadingOptions ? "Cargando especies…" : "Seleccionar especie"} />
                  </SelectTrigger>
                  <SelectContent>
                    {especies.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nombre.charAt(0).toUpperCase() + e.nombre.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.especieId && (
                  <p className="text-xs text-red-600 font-medium">{errors.especieId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">Raza *</Label>
                <Select
                  key={`raza-${especieIdWatch}`}
                  onValueChange={(value) => setValue("razaId", value)}
                  value={watch("razaId") || undefined}
                  disabled={loadingOptions}
                >
                  <SelectTrigger className={cn("h-11 border-2", errors.razaId ? "border-red-500" : "border-slate-200")}>
                    <SelectValue placeholder={loadingOptions ? "Cargando..." : "Seleccionar raza"} />
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

              <div className="space-y-2">
                <Label className="flex items-center gap-2">Categoría *</Label>
                <Select
                  key={`cat-${especieIdWatch}`}
                  onValueChange={(value) => setValue("categoriaId", value)}
                  value={watch("categoriaId") || undefined}
                  disabled={loadingOptions}
                >
                  <SelectTrigger className={cn("h-11 border-2", errors.categoriaId ? "border-red-500" : "border-slate-200")}>
                    <SelectValue placeholder={loadingOptions ? "Cargando..." : "Seleccionar categoría"} />
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

              <div className="space-y-4">
                <Label className="flex items-center gap-2 text-slate-700 font-bold">Sexo *</Label>
                <div className="grid grid-cols-2 gap-4 h-14">
                  <button
                    type="button"
                    onClick={() => setValue("sexo", "M")}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border-2 transition-all p-2",
                      selectedSexo === "M" 
                        ? "border-blue-600 bg-blue-50 text-blue-700" 
                        : "border-slate-200 hover:border-slate-300 text-slate-500"
                    )}
                  >
                    <span className="text-sm font-bold">MACHO</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue("sexo", "F")}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border-2 transition-all p-2",
                      selectedSexo === "F" 
                        ? "border-pink-600 bg-pink-50 text-pink-700" 
                        : "border-slate-200 hover:border-slate-300 text-slate-500"
                    )}
                  >
                    <span className="text-sm font-bold">HEMBRA</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fechaNacimiento" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  Fecha de Nacimiento
                </Label>
                <Input
                  id="fechaNacimiento"
                  type="date"
                  {...register("fechaNacimiento")}
                  className="h-11 border-2 border-slate-200"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">Origen *</Label>
                <Select
                  onValueChange={(value: "cria_propia" | "compra" | "otro") => setValue("origen", value)}
                  defaultValue={initialData?.origen || "cria_propia"}
                >
                  <SelectTrigger className={cn("h-11 border-2", errors.origen ? "border-red-500" : "border-slate-200")}>
                    <SelectValue placeholder="Seleccionar origen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cria_propia">Cría Propia</SelectItem>
                    <SelectItem value="compra">Compra</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* PASO 3: Características y Cabaña */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-blue-600" />
                Rasgos & Registro de Cabaña
              </h3>
              <p className="text-sm text-slate-500">Características físicas y estado de pedigrí.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="colorManto">Color de Manto</Label>
                <Input
                  id="colorManto"
                  {...register("colorManto")}
                  placeholder="Ej: Negro, Colorado"
                  className="h-11 border-2 border-slate-200"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estadoCastracion">Estado de Castración</Label>
                <Select onValueChange={(value) => setValue("estadoCastracion", value)}>
                  <SelectTrigger className="h-11 border-2 border-slate-200">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entero">Entero</SelectItem>
                    <SelectItem value="castrado">Castrado</SelectItem>
                    <SelectItem value="no_aplica">No Aplica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="denticion">Dentición</Label>
                <Input
                  id="denticion"
                  {...register("denticion")}
                  placeholder="Ej: 2 dientes"
                  className="h-11 border-2 border-slate-200"
                />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="esCabana" className="text-base font-bold text-slate-800">Animal de Cabaña</Label>
                  <p className="text-sm text-slate-500">Activa si el animal tiene registro de pedigrí o pureza racial.</p>
                </div>
                <Switch
                  id="esCabana"
                  onCheckedChange={(checked) => setValue("esCabana", checked)}
                  defaultChecked={initialData?.esCabana}
                />
              </div>

              {esCabana && (
                <div className="pt-4 border-t border-slate-200 animate-in slide-in-from-top-2 duration-200">
                  <Label htmlFor="registroCabana" className="mb-2 block">Número de Registro / HBA</Label>
                  <Input
                    id="registroCabana"
                    {...register("registroCabana")}
                    placeholder="Ej: 123456"
                    className="h-11 border-2 border-blue-100 bg-white"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* PASO 4: Ubicación e Inicio */}
        {step === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                Ubicación & Datos Iniciales
              </h3>
              <p className="text-sm text-slate-500">Asignación a lote y registros de entrada.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <Label htmlFor="loteId">Lote Asignado</Label>
                <Select
                  onValueChange={(value) => setValue("loteId", value)}
                  defaultValue={initialData?.loteId}
                  disabled={loadingOptions || !establecimientoActivo || lotes.length === 0}
                >
                  <SelectTrigger className={cn("h-11 border-2", errors.loteId ? "border-red-500" : "border-slate-200")}>
                    <SelectValue 
                      placeholder={
                        !establecimientoActivo 
                          ? "Selecciona establecimiento" 
                          : lotes.length === 0 
                            ? "Sin lotes disponibles"
                            : "Seleccionar lote (opcional)"
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {lotes.map((lote) => (
                      <SelectItem key={lote.id} value={lote.id}>
                        {lote.nombre} ({lote.tipo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pesoInicial" className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-slate-500" />
                    Peso (kg)
                  </Label>
                  <Input
                    id="pesoInicial"
                    type="number"
                    step="0.1"
                    {...register("pesoInicial", { valueAsNumber: true })}
                    placeholder="Ej: 250"
                    className="h-11 border-2 border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ccInicial">CC (1-9)</Label>
                  <Input
                    id="ccInicial"
                    type="number"
                    step="0.1"
                    min="1"
                    max="9"
                    {...register("ccInicial", { valueAsNumber: true })}
                    placeholder="6.5"
                    className="h-11 border-2 border-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-slate-500" />
                Observaciones Adicionales
              </Label>
              <Textarea
                id="notas"
                {...register("notas")}
                placeholder="Cualquier detalle relevante del animal..."
                rows={4}
                className="border-2 border-slate-200 resize-none"
              />
            </div>
          </div>
        )}

        {/* NAVEGACIÓN */}
        <div className="mt-12 flex items-center justify-between border-t border-slate-100 pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={step === 1 || isSubmitting}
            className={cn("h-12 px-6 font-bold border-2 transition-all", step === 1 ? "opacity-0 pointer-events-none" : "")}
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Anterior
          </Button>

          {step < 4 ? (
            <Button
              type="button"
              onClick={nextStep}
              className="h-12 px-8 font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 active:scale-95 transition-all"
            >
              Siguiente
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={isSubmitting || loadingOptions}
              className="h-12 px-10 font-extrabold bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100 active:scale-95 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  Finalizar Registro
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
