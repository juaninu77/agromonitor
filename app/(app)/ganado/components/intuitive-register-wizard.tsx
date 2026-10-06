"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Baby,
  Beef,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Crown,
  Heart,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  Repeat,
  RotateCcw,
  Scale,
  Sparkles,
  Tag,
  Target,
  X,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { isValidEID } from "@/lib/hardware/eid"
import { CC_MAX, CC_MIN, PESO_MAX_KG } from "@/lib/validations/animal-schema"
import { useCatalogosAlta, type CategoriaOpt, type RazaOpt } from "./alta-masiva/use-catalogos-alta"

// ============================================================
// Esquema del formulario (cliente). El servidor vuelve a validar todo.
// ============================================================

const hoyISO = () => new Date().toISOString().slice(0, 10)

const numeroOpcional = z.preprocess(
  (v) => (v === "" || v === null || v === undefined || (typeof v === "number" && Number.isNaN(v)) ? undefined : v),
  z.number({ invalid_type_error: "Ingresá un número" }).optional(),
)

const registerSchema = z
  .object({
    especieId: z.string().min(1, "Seleccioná el tipo de animal"),
    caravanaVisual: z.string().trim().max(30, "Máximo 30 caracteres").optional(),
    caravanaRfid: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || isValidEID(v), "El RFID debe tener 15 o 16 dígitos"),
    razaId: z.string().min(1, "Seleccioná una raza"),
    categoriaId: z.string().min(1, "Seleccioná una categoría"),
    sexo: z.enum(["M", "F"]),
    fechaNacimiento: z
      .string()
      .optional()
      .refine((v) => !v || v <= hoyISO(), "La fecha de nacimiento no puede ser futura"),
    pesoInicial: numeroOpcional.refine((v) => v === undefined || (v > 0 && v <= PESO_MAX_KG), `El peso debe ser mayor a 0 y hasta ${PESO_MAX_KG} kg`),
    ccInicial: numeroOpcional.refine((v) => v === undefined || (v >= CC_MIN && v <= CC_MAX), `La condición corporal va de ${CC_MIN} a ${CC_MAX}`),
    origen: z.enum(["cria_propia", "compra", "otro"]).default("cria_propia"),
    loteId: z.string().optional(),
    sectorId: z.string().optional(),
    notas: z.string().max(2000, "Máximo 2000 caracteres").optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.caravanaVisual && !d.caravanaRfid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["caravanaVisual"], message: "Indicá la caravana visual o el RFID" })
    }
  })

type RegisterData = z.infer<typeof registerSchema>

interface IntuitiveRegisterWizardProps {
  onSubmit: (data: RegisterData) => Promise<unknown>
  onClose: () => void
  isSubmitting: boolean
  onDirtyChange?: (dirty: boolean) => void
}

// ============================================================
// Subcomponentes
// ============================================================

function ErrorCampo({ mensaje, id }: { mensaje?: string; id?: string }) {
  if (!mensaje) return null
  return (
    <p id={id} role="alert" className="flex items-center gap-1 text-sm font-medium text-red-600">
      <X className="h-4 w-4" aria-hidden />
      {mensaje}
    </p>
  )
}

/** Edad en meses completos a partir de una fecha yyyy-mm-dd; null si no hay fecha o es futura. */
export function edadEnMeses(fechaNacimiento?: string, hoy = new Date()): number | null {
  if (!fechaNacimiento) return null
  const nac = new Date(fechaNacimiento + "T00:00:00")
  if (Number.isNaN(nac.getTime()) || nac > hoy) return null
  let meses = (hoy.getFullYear() - nac.getFullYear()) * 12 + (hoy.getMonth() - nac.getMonth())
  if (hoy.getDate() < nac.getDate()) meses -= 1
  return Math.max(0, meses)
}

function iconoCategoria(nombre: string) {
  const n = nombre.toLowerCase()
  if (n.includes("terner")) return Baby
  if (n.includes("toro")) return Crown
  if (n.includes("vaca")) return Heart
  if (n.includes("novill") || n.includes("vaquillona")) return Target
  if (/cordero|cordera|oveja|carnero|borreg/.test(n)) return Heart
  if (/potrill|potranc|caballo|yegua|semental/.test(n)) return Zap
  return Beef
}

function CategorySelector({
  categorias,
  seleccionada,
  onSelect,
  fechaNacimiento,
  sexo,
}: {
  categorias: CategoriaOpt[]
  seleccionada: string
  onSelect: (id: string) => void
  fechaNacimiento?: string
  sexo: "M" | "F"
}) {
  const edad = edadEnMeses(fechaNacimiento)
  const sugerida =
    edad !== null
      ? categorias.find((c) => (c.edadMinMeses == null || edad >= c.edadMinMeses) && (c.edadMaxMeses == null || edad <= c.edadMaxMeses))
      : undefined

  if (!categorias.length) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/20" role="alert">
        No hay categorías de {sexo === "M" ? "machos" : "hembras"} para esta especie.{" "}
        <a className="underline" href="/configuracion/catalogo">Agregalas en Configuración → Catálogo</a>.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {sugerida && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 dark:bg-emerald-950/20">
          <Sparkles className="h-4 w-4 text-emerald-600" aria-hidden />
          <span className="text-sm text-emerald-700">
            Sugerencia: <strong className="capitalize">{sugerida.nombre}</strong> según la edad ({edad} {edad === 1 ? "mes" : "meses"})
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3" role="radiogroup" aria-label="Categoría">
        {categorias.map((c) => {
          const Icon = iconoCategoria(c.nombre)
          const activa = seleccionada === c.id
          const esSugerida = sugerida?.id === c.id && !activa
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={activa}
              onClick={() => onSelect(c.id)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-all",
                activa && "border-primary bg-primary/10 text-primary shadow-md",
                esSugerida && "border-emerald-400 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200 dark:bg-emerald-950/20",
                !activa && !esSugerida && "border-border text-muted-foreground hover:border-slate-300",
              )}
            >
              <Icon className="h-8 w-8" aria-hidden />
              <span className="text-center text-sm font-semibold capitalize">{c.nombre}</span>
              {activa && <CheckCircle2 className="absolute right-2 top-2 h-4 w-4" aria-hidden />}
              {esSugerida && <Badge className="absolute -right-2 -top-2 bg-emerald-500 text-[10px] text-white">Sugerida</Badge>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RazaSelector({ razas, seleccionada, onSelect }: { razas: RazaOpt[]; seleccionada: string; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState("")
  const filtradas = razas.filter((r) => r.nombre.toLowerCase().includes(search.toLowerCase()))
  if (!razas.length) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/20" role="alert">
        No hay razas para esta especie. <a className="underline" href="/configuracion/catalogo">Agregalas en Configuración → Catálogo</a>.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      {razas.length > 6 && <Input aria-label="Buscar raza" placeholder="Buscar raza…" value={search} onChange={(e) => setSearch(e.target.value)} />}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Raza">
        {filtradas.map((r) => (
          <Button type="button" key={r.id} role="radio" variant={seleccionada === r.id ? "default" : "outline"} aria-checked={seleccionada === r.id} onClick={() => onSelect(r.id)}>
            <span className="truncate">{r.nombre}</span>
          </Button>
        ))}
      </div>
      {!filtradas.length && <p className="text-sm text-muted-foreground">Ninguna raza coincide con “{search}”.</p>}
    </div>
  )
}

// ============================================================
// Asistente
// ============================================================

export function IntuitiveRegisterWizard({ onSubmit, onClose, isSubmitting, onDirtyChange }: IntuitiveRegisterWizardProps) {
  const cat = useCatalogosAlta()
  const [step, setStep] = useState(1)
  const [registeredCount, setRegisteredCount] = useState(0)
  const [continueRegistering, setContinueRegistering] = useState(true)
  const totalSteps = 3

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
    reset,
    trigger,
  } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: { sexo: "M", origen: "cria_propia", especieId: "", caravanaVisual: "", caravanaRfid: "", razaId: "", categoriaId: "", notas: "" },
  })

  const especieId = watch("especieId")
  const sexo = watch("sexo")
  const razaId = watch("razaId")
  const categoriaId = watch("categoriaId")
  const fechaNacimiento = watch("fechaNacimiento")
  const caravanaVisual = watch("caravanaVisual")
  const caravanaRfid = watch("caravanaRfid")
  const origen = watch("origen")
  const loteId = watch("loteId")
  const sectorId = watch("sectorId")

  useEffect(() => {
    onDirtyChange?.(isDirty && Boolean(caravanaVisual || caravanaRfid))
  }, [isDirty, caravanaVisual, caravanaRfid, onDirtyChange])

  // Especie inicial cuando llega el catálogo
  useEffect(() => {
    if (!especieId && cat.especies.length) {
      const def = cat.especieDefault()
      if (def) setValue("especieId", def.id)
    }
  }, [cat.especies, especieId, setValue, cat])

  // Cambiar de especie limpia raza, categoría y lote
  const prevEspecie = useRef<string | null>(null)
  useEffect(() => {
    if (prevEspecie.current && prevEspecie.current !== especieId) {
      setValue("razaId", "")
      setValue("categoriaId", "")
      setValue("loteId", undefined)
    }
    prevEspecie.current = especieId || null
  }, [especieId, setValue])

  const razas = useMemo(() => (especieId ? cat.razasDe(especieId) : []), [cat, especieId])
  const categorias = useMemo(() => (especieId ? cat.categoriasDe(especieId, sexo) : []), [cat, especieId, sexo])
  const lotes = useMemo(() => (especieId ? cat.lotesDe(especieId) : []), [cat, especieId])

  // Si la categoría elegida dejó de ser válida para el sexo, se limpia
  useEffect(() => {
    if (categoriaId && !categorias.some((c) => c.id === categoriaId)) setValue("categoriaId", "")
  }, [categorias, categoriaId, setValue])

  const nextStep = async () => {
    const campos: (keyof RegisterData)[] = step === 1 ? ["especieId", "caravanaVisual", "caravanaRfid", "sexo", "fechaNacimiento"] : ["razaId", "categoriaId"]
    if (await trigger(campos)) setStep((s) => Math.min(s + 1, totalSteps))
  }
  const prevStep = () => setStep((s) => Math.max(s - 1, 1))

  const reiniciar = (mantener?: Partial<RegisterData>) => {
    reset({
      especieId: mantener?.especieId ?? especieId,
      sexo: mantener?.sexo ?? "M",
      razaId: mantener?.razaId ?? "",
      categoriaId: "",
      origen: mantener?.origen ?? "cria_propia",
      loteId: mantener?.loteId,
      sectorId: mantener?.sectorId,
      caravanaVisual: "",
      caravanaRfid: "",
      fechaNacimiento: "",
      pesoInicial: undefined,
      ccInicial: undefined,
      notas: "",
    })
    setStep(1)
  }

  const handleFormSubmit = async (data: RegisterData) => {
    if (step !== totalSteps) return
    try {
      await onSubmit({ ...data, loteId: data.loteId || undefined, sectorId: data.sectorId || undefined })
      const total = registeredCount + 1
      setRegisteredCount(total)
      const etiqueta = data.caravanaVisual || data.caravanaRfid
      if (continueRegistering) {
        reiniciar({ especieId: data.especieId, sexo: data.sexo, razaId: data.razaId, origen: data.origen, loteId: data.loteId, sectorId: data.sectorId })
        toast.success("Animal registrado", { description: `${etiqueta} agregado. Total: ${total} ${total === 1 ? "animal" : "animales"}` })
      } else {
        toast.success("Animal registrado", { description: `${etiqueta} agregado.` })
        onClose()
      }
    } catch {
      // El error ya se mostró en el diálogo padre
    }
  }

  const labelEspecie = (nombre: string) => nombre.charAt(0).toUpperCase() + nombre.slice(1)

  // ---------- Estados de carga / vacío ----------
  if (cat.cargando) {
    return (
      <div className="flex items-center justify-center py-16" role="status">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-3 text-muted-foreground">Preparando formulario…</p>
        </div>
      </div>
    )
  }
  if (cat.error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center" role="alert">
        <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
        <p className="mt-2 font-medium">{cat.error}</p>
        <Button variant="outline" className="mt-4" onClick={cat.reintentar}>
          <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
        </Button>
      </div>
    )
  }
  if (!cat.especies.length) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center dark:bg-amber-950/20" role="alert">
        <Info className="mx-auto h-8 w-8 text-amber-600" />
        <p className="mt-2 font-semibold">No hay especies en el catálogo</p>
        <p className="mt-1 text-sm text-muted-foreground">Para registrar animales primero hay que dar de alta al menos una especie con sus razas y categorías.</p>
        <Button asChild className="mt-4">
          <a href="/configuracion/catalogo">Ir a Configuración → Catálogo</a>
        </Button>
      </div>
    )
  }

  const progress = (step / totalSteps) * 100

  return (
    <div className="space-y-6">
      {/* Header con progreso */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2">
              <Zap className="h-6 w-6 text-primary" aria-hidden />
            </div>
            <div>
              <h2 className="text-xl font-bold">Registro individual</h2>
              <p className="text-sm text-muted-foreground">Paso {step} de {totalSteps}</p>
            </div>
          </div>
          {registeredCount > 0 && (
            <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              {registeredCount} registrado{registeredCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div>
          <Progress value={progress} className="h-2" aria-label={`Paso ${step} de ${totalSteps}`} />
          <div className="mt-2 flex justify-between">
            {["Identificación", "Clasificación", "Detalles"].map((label, i) => (
              <span key={label} className={cn("text-xs font-medium", i + 1 <= step ? "text-primary" : "text-muted-foreground")}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
        {/* PASO 1 */}
        {step === 1 && (
          <Card className="border-2">
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="text-sm font-semibold">Identificación del animal</p>
                  <p className="text-xs text-muted-foreground">Caravana visual o RFID (al menos una), sexo y, si la conocés, la fecha de nacimiento.</p>
                </div>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-base font-bold">
                  Tipo de animal <span className="text-destructive">*</span>
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de animal">
                  {cat.especies.map((esp) => {
                    const activa = especieId === esp.id
                    return (
                      <button
                        key={esp.id}
                        type="button"
                        role="radio"
                        aria-checked={activa}
                        onClick={() => setValue("especieId", esp.id, { shouldValidate: true })}
                        className={cn(
                          "rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all",
                          activa ? "border-primary bg-primary/10 text-primary shadow-md" : "border-border text-muted-foreground hover:border-slate-300",
                        )}
                      >
                        {labelEspecie(esp.nombre)}
                      </button>
                    )
                  })}
                </div>
                <ErrorCampo mensaje={errors.especieId?.message} />
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wiz-caravana" className="flex items-center gap-2 text-base font-bold">
                    <Tag className="h-5 w-5 text-muted-foreground" aria-hidden /> Caravana visual <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="wiz-caravana"
                    {...register("caravanaVisual")}
                    placeholder="Ej: 001, A-123"
                    autoFocus
                    autoComplete="off"
                    aria-invalid={!!errors.caravanaVisual}
                    aria-describedby={errors.caravanaVisual ? "wiz-caravana-error" : undefined}
                    className={cn("h-14 border-2 text-center text-2xl font-bold uppercase", errors.caravanaVisual && "border-red-400 bg-red-50")}
                  />
                  <ErrorCampo id="wiz-caravana-error" mensaje={errors.caravanaVisual?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wiz-rfid" className="flex items-center gap-2 text-base font-bold">
                    RFID <Badge variant="outline" className="text-xs">Opcional</Badge>
                  </Label>
                  <Input
                    id="wiz-rfid"
                    {...register("caravanaRfid")}
                    placeholder="15 o 16 dígitos"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-invalid={!!errors.caravanaRfid}
                    className={cn("h-14 border-2 text-center text-lg", errors.caravanaRfid && "border-red-400 bg-red-50")}
                  />
                  <ErrorCampo mensaje={errors.caravanaRfid?.message} />
                  <p className="text-xs text-muted-foreground">Podés leerlo con el bastón: dejá el cursor en el campo.</p>
                </div>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-base font-bold">
                  Sexo <span className="text-destructive">*</span>
                </legend>
                <div className="grid grid-cols-2 gap-4" role="radiogroup" aria-label="Sexo">
                  {(["M", "F"] as const).map((valor) => {
                    const activo = sexo === valor
                    const Icon = valor === "M" ? Crown : Heart
                    return (
                      <button
                        key={valor}
                        type="button"
                        role="radio"
                        aria-checked={activo}
                        onClick={() => setValue("sexo", valor, { shouldDirty: true })}
                        className={cn(
                          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-5 transition-all",
                          activo
                            ? valor === "M"
                              ? "border-primary bg-primary/10 text-primary shadow-md"
                              : "border-pink-600 bg-pink-50 text-pink-700 shadow-md dark:bg-pink-950/20"
                            : "border-border text-muted-foreground hover:border-slate-300",
                        )}
                      >
                        <Icon className="h-8 w-8" aria-hidden />
                        <span className="text-lg font-bold">{valor === "M" ? "MACHO" : "HEMBRA"}</span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="wiz-fecha" className="flex items-center gap-2 text-base font-bold">
                  <Calendar className="h-5 w-5 text-muted-foreground" aria-hidden /> Fecha de nacimiento
                  <Badge variant="outline" className="text-xs">Opcional</Badge>
                </Label>
                <Input id="wiz-fecha" type="date" max={hoyISO()} {...register("fechaNacimiento")} aria-invalid={!!errors.fechaNacimiento} className="h-12 border-2" />
                <ErrorCampo mensaje={errors.fechaNacimiento?.message} />
                <p className="text-xs text-muted-foreground">Con la fecha te sugerimos la categoría automáticamente.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PASO 2 */}
        {step === 2 && (
          <Card className="border-2">
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 dark:bg-emerald-950/20">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Clasificación</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">Elegí la raza y la categoría. Si cargaste la fecha, te marcamos la categoría sugerida.</p>
                </div>
              </div>
              <fieldset className="space-y-3">
                <legend className="text-base font-bold">
                  Raza <span className="text-destructive">*</span>
                </legend>
                <RazaSelector razas={razas} seleccionada={razaId || ""} onSelect={(id) => setValue("razaId", id, { shouldValidate: true, shouldDirty: true })} />
                <ErrorCampo mensaje={errors.razaId?.message} />
              </fieldset>
              <fieldset className="space-y-3">
                <legend className="text-base font-bold">
                  Categoría <span className="text-destructive">*</span>
                  <span className="ml-2 text-sm font-normal text-muted-foreground">({sexo === "M" ? "machos" : "hembras"})</span>
                </legend>
                <CategorySelector categorias={categorias} seleccionada={categoriaId || ""} onSelect={(id) => setValue("categoriaId", id, { shouldValidate: true, shouldDirty: true })} fechaNacimiento={fechaNacimiento} sexo={sexo} />
                <ErrorCampo mensaje={errors.categoriaId?.message} />
              </fieldset>
            </CardContent>
          </Card>
        )}

        {/* PASO 3 */}
        {step === 3 && (
          <Card className="border-2">
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 dark:bg-amber-950/20">
                <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Datos adicionales</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">Todo lo de este paso es opcional.</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wiz-peso" className="flex items-center gap-2 font-bold">
                    <Scale className="h-5 w-5 text-muted-foreground" aria-hidden /> Peso inicial (kg)
                  </Label>
                  <Input
                    id="wiz-peso"
                    type="number"
                    step="0.1"
                    min={0.1}
                    max={PESO_MAX_KG}
                    inputMode="decimal"
                    {...register("pesoInicial", { setValueAs: (v) => (v === "" || v === null ? undefined : Number(String(v).replace(",", "."))) })}
                    placeholder="Ej: 250"
                    aria-invalid={!!errors.pesoInicial}
                    className={cn("h-12 border-2", errors.pesoInicial && "border-red-400 bg-red-50")}
                  />
                  <ErrorCampo mensaje={errors.pesoInicial?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wiz-cc" className="font-bold">
                    Condición corporal ({CC_MIN}–{CC_MAX})
                  </Label>
                  <Input
                    id="wiz-cc"
                    type="number"
                    step="0.5"
                    min={CC_MIN}
                    max={CC_MAX}
                    inputMode="decimal"
                    {...register("ccInicial", { setValueAs: (v) => (v === "" || v === null ? undefined : Number(String(v).replace(",", "."))) })}
                    placeholder="Ej: 5"
                    aria-invalid={!!errors.ccInicial}
                    className={cn("h-12 border-2", errors.ccInicial && "border-red-400 bg-red-50")}
                  />
                  <ErrorCampo mensaje={errors.ccInicial?.message} />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wiz-lote" className="flex items-center gap-2 font-bold">
                    <MapPin className="h-5 w-5 text-muted-foreground" aria-hidden /> Lote
                  </Label>
                  <Select value={loteId || "none"} onValueChange={(v) => setValue("loteId", v === "none" ? undefined : v, { shouldDirty: true })}>
                    <SelectTrigger id="wiz-lote" className="h-12 border-2"><SelectValue placeholder="Sin lote" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin lote</SelectItem>
                      {lotes.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wiz-sector" className="font-bold">Potrero / corral</Label>
                  <Select value={sectorId || "none"} onValueChange={(v) => setValue("sectorId", v === "none" ? undefined : v, { shouldDirty: true })}>
                    <SelectTrigger id="wiz-sector" className="h-12 border-2"><SelectValue placeholder="Sin ubicación" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin ubicación</SelectItem>
                      {cat.sectores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.nombre} · {s.tipo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <fieldset className="space-y-3">
                <legend className="font-bold">Origen</legend>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Origen">
                  {[
                    { value: "cria_propia", label: "Cría propia" },
                    { value: "compra", label: "Compra" },
                    { value: "otro", label: "Otro" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={origen === opt.value}
                      onClick={() => setValue("origen", opt.value as RegisterData["origen"], { shouldDirty: true })}
                      className={cn(
                        "rounded-lg border-2 p-3 text-sm font-medium transition-all",
                        origen === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-slate-300",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="wiz-notas" className="font-bold">Observaciones</Label>
                <Textarea id="wiz-notas" {...register("notas")} placeholder="Notas sobre el animal…" rows={3} className="resize-none border-2" />
                <ErrorCampo mensaje={errors.notas?.message} />
              </div>

              <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked={continueRegistering}
                  aria-label="Continuar registrando después de guardar"
                  onClick={() => setContinueRegistering(!continueRegistering)}
                  className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", continueRegistering ? "bg-primary" : "bg-slate-300")}
                >
                  <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform", continueRegistering ? "translate-x-5" : "translate-x-0")} />
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{continueRegistering ? "Continuar registrando" : "Cerrar al guardar"}</p>
                  <p className="text-xs text-muted-foreground">
                    {continueRegistering ? "Se conservan especie, sexo, raza, origen, lote y potrero para el siguiente." : "Se cierra el diálogo después de guardar."}
                  </p>
                </div>
                <Repeat className={cn("ml-auto h-5 w-5 shrink-0", continueRegistering ? "text-primary" : "text-muted-foreground")} aria-hidden />
              </div>

              <dl className="grid grid-cols-2 gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <div><dt className="inline text-muted-foreground">Caravana: </dt><dd className="inline font-medium uppercase">{caravanaVisual || caravanaRfid || "—"}</dd></div>
                <div><dt className="inline text-muted-foreground">Sexo: </dt><dd className="inline font-medium">{sexo === "M" ? "Macho" : "Hembra"}</dd></div>
                <div><dt className="inline text-muted-foreground">Raza: </dt><dd className="inline font-medium">{razas.find((r) => r.id === razaId)?.nombre || "—"}</dd></div>
                <div><dt className="inline text-muted-foreground">Categoría: </dt><dd className="inline font-medium capitalize">{categorias.find((c) => c.id === categoriaId)?.nombre || "—"}</dd></div>
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Navegación */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={prevStep} disabled={isSubmitting} className="h-12 border-2">
                <ArrowLeft className="h-4 w-4 sm:mr-2" aria-hidden />
                <span className="hidden sm:inline">Anterior</span>
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => reiniciar()} disabled={isSubmitting} className="text-muted-foreground">
              <RotateCcw className="h-4 w-4 sm:mr-2" aria-hidden />
              <span className="hidden sm:inline">Reiniciar</span>
            </Button>
          </div>
          {step < totalSteps ? (
            // key distinta: si React reutilizara el mismo <button>, el navegador
            // lo vería como submit al terminar el click y guardaría sin querer.
            <Button key="siguiente" type="button" onClick={nextStep} className="h-12 px-6">
              Siguiente <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button key="guardar" type="submit" disabled={isSubmitting} className="h-12 bg-emerald-600 px-6 hover:bg-emerald-700">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden /> Guardando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" aria-hidden /> {continueRegistering ? "Guardar y seguir" : "Guardar animal"}
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
