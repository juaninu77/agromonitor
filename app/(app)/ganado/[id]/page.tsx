"use client"

import { useState, useMemo, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Edit,
  Scale,
  Syringe,
  ArrowRightLeft,
  Loader2,
  AlertCircle,
  Tag,
  Dna,
  Activity,
  Palette,
  MapPin,
  Baby,
  ClipboardList,
  Clock,
  TrendingUp,
  Heart,
  Footprints,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { toast } from "sonner"

import { useTenant } from "@/lib/context/tenant-context"
import { formatDate } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnimalDetail {
  id: string
  cuig: string | null
  caravanaVisual: string | null
  caravanaRfid: string | null
  otroId: string | null
  sexo: "M" | "F"
  fechaNacimiento: string | null
  origen: "cria_propia" | "compra" | null
  estadoVital: "activo" | "vendido" | "baja" | "muerto"
  colorManto: string | null
  estadoCastracion: "entero" | "castrado" | null
  denticion: string | null
  esCabana: boolean
  registroCabana: string | null
  notas: string | null
  especie: { id: string; nombre: string } | null
  raza: { id: string; nombre: string } | null
  categoria: { id: string; nombre: string } | null
  proveedor: { id: string; nombre: string } | null
  genealogia: { padreId: string | null; madreId: string | null } | null
  eventosPesada: PesadaEvent[]
  eventosSanidad: SanidadEvent[]
  serviciosHembra: ServicioEvent[]
  tactos: TactoEvent[]
  partosComoMadre: PartoEvent[]
  eventosMovimiento: MovimientoEvent[]
  ubicacionHist: UbicacionHist[]
  loteHist: LoteHist[]
  eventoBaja: BajaEvent | null
}

interface PesadaEvent {
  id: string
  fecha: string
  pesoKg: number
  cc: number | null
  gdpKg: number | null
}

interface SanidadEvent {
  id: string
  fecha: string
  dosis: number | null
  producto: { id?: string; nombre: string; principioActivo?: string } | null
}

interface ServicioEvent {
  id: string
  fecha: string
  tipo: string
}

interface TactoEvent {
  id: string
  fecha: string
  resultado: string
  mesesGest: number | null
}

interface PartoEvent {
  id: string
  fecha: string
  resultado: string
}

interface MovimientoEvent {
  id: string
  fecha: string
  motivo: string
}

interface UbicacionHist {
  desde: string
  hasta: string | null
  sector: { nombre: string } | null
}

interface LoteHist {
  desde: string
  hasta: string | null
  lote: { nombre: string } | null
}

interface BajaEvent {
  id: string
  fecha?: string
  motivo?: string
}

interface Lote {
  id: string
  nombre: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAnimalName(animal: AnimalDetail): string {
  return animal.caravanaVisual || animal.cuig || animal.otroId || "Sin identificación"
}

function calcularEdad(fechaNacimiento: string | null): string {
  if (!fechaNacimiento) return "—"
  const nacimiento = new Date(fechaNacimiento)
  const hoy = new Date()
  const diffMs = hoy.getTime() - nacimiento.getTime()
  const meses = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44))
  if (meses < 12) return `${meses} meses`
  const anios = Math.floor(meses / 12)
  const mesesResto = meses % 12
  if (mesesResto === 0) return `${anios} ${anios === 1 ? "año" : "años"}`
  return `${anios} ${anios === 1 ? "año" : "años"}, ${mesesResto} m`
}

const ESTADO_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string; label: string }> = {
  activo: { variant: "default", className: "bg-green-100 text-green-800 border-green-300 hover:bg-green-100", label: "Activo" },
  vendido: { variant: "secondary", className: "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100", label: "Vendido" },
  baja: { variant: "destructive", className: "bg-red-100 text-red-800 border-red-300 hover:bg-red-100", label: "Baja" },
  muerto: { variant: "destructive", className: "bg-red-100 text-red-800 border-red-300 hover:bg-red-100", label: "Muerto" },
}

function formatSexo(sexo: string): string {
  return sexo === "M" ? "Macho" : sexo === "F" ? "Hembra" : sexo
}

function formatOrigen(origen: string | null): string {
  if (!origen) return "—"
  return origen === "cria_propia" ? "Cría propia" : origen === "compra" ? "Compra" : origen
}

function formatCastracion(estado: string | null): string {
  if (!estado) return "—"
  return estado === "entero" ? "Entero" : estado === "castrado" ? "Castrado" : estado
}

function formatTipoServicio(tipo: string): string {
  const map: Record<string, string> = {
    monta_natural: "Monta natural",
    inseminacion: "Inseminación artificial",
    transferencia: "Transferencia embrionaria",
  }
  return map[tipo] || tipo
}

// ---------------------------------------------------------------------------
// API fetchers
// ---------------------------------------------------------------------------

async function fetchAnimal(id: string): Promise<AnimalDetail> {
  const res = await fetch(`/api/ganado/bovinos/${id}?fullHistory=true`)
  if (!res.ok) {
    if (res.status === 404) throw new Error("Animal no encontrado")
    if (res.status === 401) throw new Error("No autenticado")
    throw new Error("Error al cargar el animal")
  }
  const json = await res.json()
  if (!json.success) throw new Error(json.error || "Error al cargar el animal")
  return json.data
}

async function fetchLotes(establecimientoId: string): Promise<Lote[]> {
  const res = await fetch(`/api/establecimientos/${establecimientoId}/lotes`)
  if (!res.ok) return []
  return res.json()
}

async function fetchProductos(): Promise<{ id: string; nombre: string }[]> {
  const res = await fetch("/api/productos")
  if (!res.ok) return []
  const json = await res.json()
  return Array.isArray(json) ? json : json.data ?? []
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AnimalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { establecimientoActivo } = useTenant()

  const [activeTab, setActiveTab] = useState("pesadas")

  // Quick-action dialogs
  const [pesoDialogOpen, setPesoDialogOpen] = useState(false)
  const [sanidadDialogOpen, setSanidadDialogOpen] = useState(false)
  const [moverDialogOpen, setMoverDialogOpen] = useState(false)

  // Form state: peso
  const [pesoKg, setPesoKg] = useState("")
  const [pesoCC, setPesoCC] = useState("")
  const [pesoSubmitting, setPesoSubmitting] = useState(false)

  // Form state: sanidad
  const [productoId, setProductoId] = useState("")
  const [dosis, setDosis] = useState("")
  const [sanidadSubmitting, setSanidadSubmitting] = useState(false)

  // Form state: mover lote
  const [loteId, setLoteId] = useState("")
  const [moverSubmitting, setMoverSubmitting] = useState(false)

  const { data: animal, isLoading, error } = useQuery({
    queryKey: ["ganado", "bovino", id],
    queryFn: () => fetchAnimal(id),
    staleTime: 30_000,
    enabled: !!id,
  })

  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", establecimientoActivo?.id],
    queryFn: () => fetchLotes(establecimientoActivo!.id),
    enabled: !!establecimientoActivo?.id && moverDialogOpen,
  })

  const { data: productos = [] } = useQuery({
    queryKey: ["productos"],
    queryFn: fetchProductos,
    enabled: sanidadDialogOpen,
    staleTime: 60_000,
  })

  const invalidateAnimal = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["ganado", "bovino", id] })
  }, [queryClient, id])

  // ----- Peso submit -----
  const handlePesoSubmit = useCallback(async () => {
    if (!pesoKg) return
    setPesoSubmitting(true)
    try {
      const res = await fetch("/api/ganado/pesos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bovinoId: id,
          peso: parseFloat(pesoKg),
          cc: pesoCC ? parseFloat(pesoCC) : undefined,
          fecha: new Date().toISOString(),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al registrar peso")
      }
      toast.success("Peso registrado", { description: `${pesoKg} kg guardado correctamente.` })
      setPesoDialogOpen(false)
      setPesoKg("")
      setPesoCC("")
      invalidateAnimal()
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setPesoSubmitting(false)
    }
  }, [id, pesoKg, pesoCC, invalidateAnimal])

  // ----- Sanidad submit -----
  const handleSanidadSubmit = useCallback(async () => {
    if (!productoId) return
    setSanidadSubmitting(true)
    try {
      const res = await fetch("/api/ganado/eventos-sanitarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bovinoId: id,
          productoId,
          dosis: dosis ? parseFloat(dosis) : undefined,
          fecha: new Date().toISOString(),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al registrar evento sanitario")
      }
      toast.success("Sanidad registrada", { description: "Evento sanitario guardado correctamente." })
      setSanidadDialogOpen(false)
      setProductoId("")
      setDosis("")
      invalidateAnimal()
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setSanidadSubmitting(false)
    }
  }, [id, productoId, dosis, invalidateAnimal])

  // ----- Mover lote submit -----
  const handleMoverSubmit = useCallback(async () => {
    if (!loteId) return
    setMoverSubmitting(true)
    try {
      const res = await fetch(`/api/ganado/bovinos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loteId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al mover de lote")
      }
      toast.success("Lote actualizado", { description: "El animal fue movido de lote correctamente." })
      setMoverDialogOpen(false)
      setLoteId("")
      invalidateAnimal()
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setMoverSubmitting(false)
    }
  }, [id, loteId, invalidateAnimal])

  // ----- Derived data -----
  const ultimaPesada = animal?.eventosPesada?.[0] ?? null
  const ubicacionActual = animal?.ubicacionHist?.find((u) => !u.hasta) ?? animal?.ubicacionHist?.[0] ?? null
  const loteActual = animal?.loteHist?.find((l) => !l.hasta) ?? animal?.loteHist?.[0] ?? null

  const chartData = useMemo(() => {
    if (!animal?.eventosPesada?.length) return []
    return [...animal.eventosPesada]
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
      .map((e) => ({
        fecha: new Date(e.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }),
        peso: e.pesoKg,
      }))
  }, [animal?.eventosPesada])

  const timelineEvents = useMemo(() => {
    if (!animal) return []
    const events: { fecha: string; tipo: string; icono: string; descripcion: string }[] = []

    animal.eventosPesada?.forEach((e) =>
      events.push({ fecha: e.fecha, tipo: "Pesada", icono: "scale", descripcion: `${e.pesoKg} kg${e.cc ? ` — CC ${e.cc}` : ""}` })
    )
    animal.eventosSanidad?.forEach((e) =>
      events.push({ fecha: e.fecha, tipo: "Sanidad", icono: "syringe", descripcion: `${e.producto?.nombre || "Producto"}${e.dosis ? ` — ${e.dosis} ml` : ""}` })
    )
    animal.serviciosHembra?.forEach((e) =>
      events.push({ fecha: e.fecha, tipo: "Servicio", icono: "heart", descripcion: formatTipoServicio(e.tipo) })
    )
    animal.tactos?.forEach((e) =>
      events.push({ fecha: e.fecha, tipo: "Tacto", icono: "activity", descripcion: `${e.resultado}${e.mesesGest ? ` — ${e.mesesGest} meses` : ""}` })
    )
    animal.partosComoMadre?.forEach((e) =>
      events.push({ fecha: e.fecha, tipo: "Parto", icono: "baby", descripcion: `Resultado: ${e.resultado}` })
    )
    animal.eventosMovimiento?.forEach((e) =>
      events.push({ fecha: e.fecha, tipo: "Movimiento", icono: "move", descripcion: e.motivo || "Movimiento registrado" })
    )

    return events.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [animal])

  const reproEvents = useMemo(() => {
    if (!animal) return []
    const events: { fecha: string; tipo: string; detalle: string }[] = []

    animal.serviciosHembra?.forEach((e) =>
      events.push({ fecha: e.fecha, tipo: "Servicio", detalle: formatTipoServicio(e.tipo) })
    )
    animal.tactos?.forEach((e) =>
      events.push({ fecha: e.fecha, tipo: "Tacto", detalle: `${e.resultado}${e.mesesGest ? ` (${e.mesesGest}m)` : ""}` })
    )
    animal.partosComoMadre?.forEach((e) =>
      events.push({ fecha: e.fecha, tipo: "Parto", detalle: e.resultado })
    )

    return events.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [animal])

  // ----- Loading state -----
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-gray-500">Cargando datos del animal...</p>
        </div>
      </div>
    )
  }

  // ----- Error state -----
  if (error || !animal) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <h2 className="text-xl font-semibold text-gray-900">
              {error?.message || "Animal no encontrado"}
            </h2>
            <p className="text-gray-500 text-center">
              No se pudo cargar la información del animal. Verificá el ID o intentá nuevamente.
            </p>
            <Button variant="outline" onClick={() => router.push("/ganado")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al listado
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const badge = ESTADO_BADGE[animal.estadoVital] ?? ESTADO_BADGE.activo

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ================================================================ */}
      {/* HEADER                                                          */}
      {/* ================================================================ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/ganado")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {getAnimalName(animal)}
              </h1>
              <Badge variant={badge.variant} className={badge.className}>
                {badge.label}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {animal.especie?.nombre ? `${animal.especie.nombre} — ` : ""}
              {animal.raza?.nombre || ""} {animal.categoria?.nombre ? `/ ${animal.categoria.nombre}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={() => setPesoDialogOpen(true)}
          >
            <Scale className="h-4 w-4 mr-1.5" />
            Registrar peso
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-purple-300 text-purple-700 hover:bg-purple-50"
            onClick={() => setSanidadDialogOpen(true)}
          >
            <Syringe className="h-4 w-4 mr-1.5" />
            Aplicar sanidad
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => setMoverDialogOpen(true)}
          >
            <ArrowRightLeft className="h-4 w-4 mr-1.5" />
            Mover de lote
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
            onClick={() => router.push(`/ganado?edit=${id}`)}
          >
            <Edit className="h-4 w-4 mr-1.5" />
            Editar
          </Button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* INFO CARDS                                                       */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Identificación */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
              <Tag className="h-4 w-4" />
              Identificación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label="CUIG" value={animal.cuig} />
            <InfoRow label="Caravana visual" value={animal.caravanaVisual} />
            <InfoRow label="RFID" value={animal.caravanaRfid} />
            <InfoRow label="Otro ID" value={animal.otroId} />
          </CardContent>
        </Card>

        {/* Card 2: Datos básicos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
              <Dna className="h-4 w-4" />
              Datos básicos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label="Sexo" value={formatSexo(animal.sexo)} />
            <InfoRow label="Raza" value={animal.raza?.nombre} />
            <InfoRow label="Categoría" value={animal.categoria?.nombre} />
            <InfoRow label="Edad" value={calcularEdad(animal.fechaNacimiento)} />
            <InfoRow label="Origen" value={formatOrigen(animal.origen)} />
          </CardContent>
        </Card>

        {/* Card 3: Estado actual */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
              <Activity className="h-4 w-4" />
              Estado actual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow
              label="Peso actual"
              value={ultimaPesada ? `${ultimaPesada.pesoKg} kg` : null}
            />
            <InfoRow
              label="CC"
              value={ultimaPesada?.cc != null ? String(ultimaPesada.cc) : null}
            />
            <InfoRow label="Lote" value={loteActual?.lote?.nombre} />
            <InfoRow label="Ubicación" value={ubicacionActual?.sector?.nombre} />
          </CardContent>
        </Card>

        {/* Card 4: Físico */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
              <Palette className="h-4 w-4" />
              Físico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label="Color manto" value={animal.colorManto} />
            <InfoRow label="Dentición" value={animal.denticion} />
            <InfoRow label="Castración" value={formatCastracion(animal.estadoCastracion)} />
            <InfoRow label="Cabaña" value={animal.esCabana ? (animal.registroCabana || "Sí") : "No"} />
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* TABS                                                             */}
      {/* ================================================================ */}
      <Card className="border-2 border-gray-200">
        <CardContent className="p-4 md:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
              <TabsTrigger value="pesadas" className="text-xs sm:text-sm">
                <Scale className="h-3.5 w-3.5 mr-1 hidden sm:inline-block" />
                Pesadas
              </TabsTrigger>
              <TabsTrigger value="sanidad" className="text-xs sm:text-sm">
                <Syringe className="h-3.5 w-3.5 mr-1 hidden sm:inline-block" />
                Sanidad
              </TabsTrigger>
              <TabsTrigger value="reproduccion" className="text-xs sm:text-sm">
                <Heart className="h-3.5 w-3.5 mr-1 hidden sm:inline-block" />
                Reproducción
              </TabsTrigger>
              <TabsTrigger value="movimientos" className="text-xs sm:text-sm">
                <Footprints className="h-3.5 w-3.5 mr-1 hidden sm:inline-block" />
                Movimientos
              </TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs sm:text-sm col-span-2 sm:col-span-1">
                <Clock className="h-3.5 w-3.5 mr-1 hidden sm:inline-block" />
                Timeline
              </TabsTrigger>
            </TabsList>

            {/* ---- Pesadas ---- */}
            <TabsContent value="pesadas" className="mt-6 space-y-6">
              {chartData.length > 1 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" />
                    Evolución de peso
                  </h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" unit=" kg" />
                        <RechartsTooltip
                          contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                          formatter={(value: number) => [`${value} kg`, "Peso"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="peso"
                          stroke="#059669"
                          strokeWidth={2}
                          dot={{ fill: "#059669", r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <Separator className="mt-4" />
                </div>
              )}

              {animal.eventosPesada.length === 0 ? (
                <EmptyState message="No hay pesadas registradas" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Peso (kg)</TableHead>
                      <TableHead className="text-right">CC</TableHead>
                      <TableHead className="text-right">GDP (kg/día)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {animal.eventosPesada.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{formatDate(e.fecha)}</TableCell>
                        <TableCell className="text-right font-medium">{e.pesoKg}</TableCell>
                        <TableCell className="text-right">{e.cc ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {e.gdpKg != null ? e.gdpKg.toFixed(2) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* ---- Sanidad ---- */}
            <TabsContent value="sanidad" className="mt-6">
              {animal.eventosSanidad.length === 0 ? (
                <EmptyState message="No hay eventos sanitarios registrados" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Principio activo</TableHead>
                      <TableHead className="text-right">Dosis</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {animal.eventosSanidad.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{formatDate(e.fecha)}</TableCell>
                        <TableCell className="font-medium">{e.producto?.nombre || "—"}</TableCell>
                        <TableCell className="text-gray-500">{e.producto?.principioActivo || "—"}</TableCell>
                        <TableCell className="text-right">{e.dosis ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* ---- Reproducción ---- */}
            <TabsContent value="reproduccion" className="mt-6">
              {reproEvents.length === 0 ? (
                <EmptyState message="No hay eventos reproductivos registrados" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reproEvents.map((e, i) => (
                      <TableRow key={`${e.tipo}-${i}`}>
                        <TableCell>{formatDate(e.fecha)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {e.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>{e.detalle}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* ---- Movimientos ---- */}
            <TabsContent value="movimientos" className="mt-6 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  Historial de lotes
                </h3>
                {animal.loteHist.length === 0 ? (
                  <EmptyState message="Sin historial de lotes" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lote</TableHead>
                        <TableHead>Desde</TableHead>
                        <TableHead>Hasta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {animal.loteHist.map((l, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{l.lote?.nombre || "—"}</TableCell>
                          <TableCell>{formatDate(l.desde)}</TableCell>
                          <TableCell>
                            {l.hasta ? formatDate(l.hasta) : (
                              <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                                Actual
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
                  <ArrowRightLeft className="h-4 w-4" />
                  Eventos de movimiento
                </h3>
                {animal.eventosMovimiento.length === 0 ? (
                  <EmptyState message="Sin eventos de movimiento" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {animal.eventosMovimiento.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{formatDate(e.fecha)}</TableCell>
                          <TableCell>{e.motivo || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            {/* ---- Timeline ---- */}
            <TabsContent value="timeline" className="mt-6">
              {timelineEvents.length === 0 ? (
                <EmptyState message="No hay eventos registrados" />
              ) : (
                <div className="relative space-y-0">
                  {timelineEvents.map((ev, i) => (
                    <div key={i} className="flex gap-4 pb-6 last:pb-0">
                      <div className="flex flex-col items-center">
                        <TimelineIcon tipo={ev.tipo} />
                        {i < timelineEvents.length - 1 && (
                          <div className="w-px flex-1 bg-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {ev.tipo}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {formatDate(ev.fecha, "long")}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{ev.descripcion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* DIALOG: Registrar peso                                           */}
      {/* ================================================================ */}
      <Dialog open={pesoDialogOpen} onOpenChange={setPesoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-blue-600" />
              Registrar peso
            </DialogTitle>
            <DialogDescription>
              Registrá una nueva pesada para {getAnimalName(animal)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pesoKg">Peso (kg)</Label>
              <Input
                id="pesoKg"
                type="number"
                min={0}
                step={0.1}
                placeholder="Ej: 450"
                value={pesoKg}
                onChange={(e) => setPesoKg(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pesoCC">Condición corporal (CC)</Label>
              <Select value={pesoCC} onValueChange={setPesoCC}>
                <SelectTrigger id="pesoCC">
                  <SelectValue placeholder="Seleccionar CC" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((v) => (
                    <SelectItem key={v} value={String(v)}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPesoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePesoSubmit} disabled={!pesoKg || pesoSubmitting}>
              {pesoSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* DIALOG: Aplicar sanidad                                          */}
      {/* ================================================================ */}
      <Dialog open={sanidadDialogOpen} onOpenChange={setSanidadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Syringe className="h-5 w-5 text-purple-600" />
              Aplicar sanidad
            </DialogTitle>
            <DialogDescription>
              Registrá un evento sanitario para {getAnimalName(animal)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="producto">Producto</Label>
              <Select value={productoId} onValueChange={setProductoId}>
                <SelectTrigger id="producto">
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {productos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dosis">Dosis (ml)</Label>
              <Input
                id="dosis"
                type="number"
                min={0}
                step={0.1}
                placeholder="Ej: 5"
                value={dosis}
                onChange={(e) => setDosis(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSanidadDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSanidadSubmit} disabled={!productoId || sanidadSubmitting}>
              {sanidadSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* DIALOG: Mover de lote                                            */}
      {/* ================================================================ */}
      <Dialog open={moverDialogOpen} onOpenChange={setMoverDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-amber-600" />
              Mover de lote
            </DialogTitle>
            <DialogDescription>
              Seleccioná el nuevo lote para {getAnimalName(animal)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="lote">Nuevo lote</Label>
              <Select value={loteId} onValueChange={setLoteId}>
                <SelectTrigger id="lote">
                  <SelectValue placeholder="Seleccionar lote" />
                </SelectTrigger>
                <SelectContent>
                  {lotes.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lotes.length === 0 && !establecimientoActivo && (
                <p className="text-xs text-gray-400">
                  Seleccioná un establecimiento activo para ver los lotes disponibles.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoverDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleMoverSubmit} disabled={!loteId || moverSubmitting}>
              {moverSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-medium text-gray-900 text-right truncate">
        {value || "—"}
      </span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <ClipboardList className="h-10 w-10 mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

function TimelineIcon({ tipo }: { tipo: string }) {
  const iconMap: Record<string, { icon: React.ReactNode; bg: string }> = {
    Pesada: { icon: <Scale className="h-3.5 w-3.5" />, bg: "bg-blue-100 text-blue-700" },
    Sanidad: { icon: <Syringe className="h-3.5 w-3.5" />, bg: "bg-purple-100 text-purple-700" },
    Servicio: { icon: <Heart className="h-3.5 w-3.5" />, bg: "bg-pink-100 text-pink-700" },
    Tacto: { icon: <Activity className="h-3.5 w-3.5" />, bg: "bg-cyan-100 text-cyan-700" },
    Parto: { icon: <Baby className="h-3.5 w-3.5" />, bg: "bg-amber-100 text-amber-700" },
    Movimiento: { icon: <ArrowRightLeft className="h-3.5 w-3.5" />, bg: "bg-gray-100 text-gray-700" },
  }
  const { icon, bg } = iconMap[tipo] ?? iconMap.Movimiento

  return (
    <div className={`flex items-center justify-center h-7 w-7 rounded-full shrink-0 ${bg}`}>
      {icon}
    </div>
  )
}
