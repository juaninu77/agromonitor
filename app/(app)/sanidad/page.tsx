"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Syringe,
  Plus,
  Users,
  Calendar,
  Search,
  Pill,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Activity,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { useTenant } from "@/lib/context/tenant-context"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EventoSanidad {
  id: string
  fecha: string
  dosis: number | null
  unidad: string | null
  via: string | null
  motivo: string | null
  observ: string | null
  cantidadAnimales: number | null
  animal: {
    id: string
    caravanaVisual: string | null
    cuig: string | null
    otroId: string | null
    sexo: string
    categoria: { nombre: string } | null
  } | null
  producto: {
    id: string
    nombre: string
    tipo: string
  }
  loteProducto: { id: string; nroLote: string } | null
  lote: { id: string; nombre: string } | null
}

interface AnimalOption {
  id: string
  caravanaVisual: string | null
  cuig: string | null
  otroId: string | null
}

interface LoteOption {
  id: string
  nombre: string
  cantidadAnimales: number
}

interface InventarioProducto {
  id: string
  nombre: string
  tipo: string
  lotes: {
    id: string
    nroLote: string
    vencimiento: string | null
    proximoAVencer: boolean
    vencido: boolean
  }[]
}

interface SanidadResponse {
  success: boolean
  data: EventoSanidad[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIAS = [
  { value: "subcutanea", label: "Subcutánea" },
  { value: "intramuscular", label: "Intramuscular" },
  { value: "oral", label: "Oral" },
  { value: "pour-on", label: "Pour-on" },
]

const MOTIVOS = [
  { value: "preventivo", label: "Preventivo" },
  { value: "curativo", label: "Curativo" },
  { value: "metafilaxis", label: "Metafilaxis" },
]

const UNIDADES = [
  { value: "ml", label: "ml" },
  { value: "cc", label: "cc" },
  { value: "comprimido", label: "Comprimido" },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function animalLabel(a: { caravanaVisual: string | null; cuig: string | null; otroId: string | null }) {
  return a.caravanaVisual || a.cuig || a.otroId || "Sin ID"
}

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

// ---------------------------------------------------------------------------
// Data-fetching helpers
// ---------------------------------------------------------------------------

async function fetchSanidad(estId: string, page: number, limit: number): Promise<SanidadResponse> {
  const params = new URLSearchParams({
    establecimientoId: estId,
    page: String(page),
    limit: String(limit),
  })
  const res = await fetch(`/api/sanidad?${params}`)
  if (!res.ok) throw new Error("Error al cargar eventos")
  const json = await res.json()
  if (!json.success) throw new Error(json.error || "Error")
  return json
}

async function fetchAllSanidad(estId: string): Promise<EventoSanidad[]> {
  const params = new URLSearchParams({
    establecimientoId: estId,
    page: "1",
    limit: "5000",
  })
  const res = await fetch(`/api/sanidad?${params}`)
  if (!res.ok) return []
  const json = await res.json()
  return json.success ? json.data : []
}

async function fetchBovinos(estId: string): Promise<AnimalOption[]> {
  const res = await fetch(`/api/ganado/bovinos?establecimientoId=${estId}&limit=2000`)
  if (!res.ok) return []
  const json = await res.json()
  if (!json.success) return []
  return json.data.map((a: any) => ({
    id: a.id,
    caravanaVisual: a.caravanaVisual || a.tagNumber,
    cuig: a.cuig,
    otroId: a.otroId,
  }))
}

async function fetchLotes(estId: string): Promise<LoteOption[]> {
  const res = await fetch(`/api/establecimientos/${estId}/lotes`)
  if (!res.ok) return []
  const json = await res.json()
  if (!Array.isArray(json)) return []
  return json.map((l: any) => ({ id: l.id, nombre: l.nombre, cantidadAnimales: l.cantidadAnimales ?? 0 }))
}

async function fetchInventario(estId: string): Promise<InventarioProducto[]> {
  const res = await fetch(`/api/inventario?establecimientoId=${estId}`)
  if (!res.ok) return []
  const json = await res.json()
  return json.success ? json.data : []
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SanidadPage() {
  const { establecimientoActivo } = useTenant()
  const estId = establecimientoActivo?.id ?? ""
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState("historial")
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const LIMIT = 20

  const [tratamientoOpen, setTratamientoOpen] = useState(false)
  const [masivaOpen, setMasivaOpen] = useState(false)

  const eventosQuery = useQuery({
    queryKey: ["sanidad", "eventos", estId, page, LIMIT],
    queryFn: () => fetchSanidad(estId, page, LIMIT),
    enabled: !!estId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const allEventosQuery = useQuery({
    queryKey: ["sanidad", "all", estId],
    queryFn: () => fetchAllSanidad(estId),
    enabled: !!estId,
    staleTime: 60_000,
  })

  const bovinosQuery = useQuery({
    queryKey: ["bovinos", estId],
    queryFn: () => fetchBovinos(estId),
    enabled: !!estId,
    staleTime: 60_000,
  })

  const lotesQuery = useQuery({
    queryKey: ["lotes", estId],
    queryFn: () => fetchLotes(estId),
    enabled: !!estId,
    staleTime: 60_000,
  })

  const inventarioQuery = useQuery({
    queryKey: ["inventario", estId],
    queryFn: () => fetchInventario(estId),
    enabled: !!estId,
    staleTime: 60_000,
  })

  const eventos = eventosQuery.data?.data ?? []
  const pagination = eventosQuery.data?.pagination
  const allEventos = allEventosQuery.data ?? []
  const animales = bovinosQuery.data ?? []
  const lotes = lotesQuery.data ?? []
  const productos = inventarioQuery.data ?? []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sanidad"] })
  }

  // --------------- KPI computations ---------------

  const kpis = useMemo(() => {
    const now = new Date()
    const mesActual = now.getMonth()
    const anioActual = now.getFullYear()

    const eventosMes = allEventos.filter((e) => {
      const d = new Date(e.fecha)
      return d.getMonth() === mesActual && d.getFullYear() === anioActual
    })

    const animalesTratados = new Set(
      eventosMes.filter((e) => e.animal?.id).map((e) => e.animal!.id)
    ).size

    const productoCount: Record<string, number> = {}
    eventosMes.forEach((e) => {
      const name = e.producto.nombre
      productoCount[name] = (productoCount[name] || 0) + 1
    })
    const topProductos = Object.entries(productoCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)

    let proximosVenc = 0
    productos.forEach((p) => {
      p.lotes.forEach((l) => {
        if (l.proximoAVencer && !l.vencido) proximosVenc++
      })
    })

    return {
      totalTratamientosMes: eventosMes.length,
      animalesTratados,
      topProductos,
      proximosVencimientos: proximosVenc,
    }
  }, [allEventos, productos])

  // --------------- Filtered historial ---------------

  const filteredEventos = useMemo(() => {
    if (!search.trim()) return eventos
    const q = search.toLowerCase()
    return eventos.filter((e) => {
      const caravana = e.animal?.caravanaVisual?.toLowerCase() ?? ""
      const cuig = e.animal?.cuig?.toLowerCase() ?? ""
      const otro = e.animal?.otroId?.toLowerCase() ?? ""
      const prod = e.producto.nombre.toLowerCase()
      return caravana.includes(q) || cuig.includes(q) || otro.includes(q) || prod.includes(q)
    })
  }, [eventos, search])

  // --------------- Guard: no establecimiento ---------------

  if (!estId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        <p>Seleccioná un establecimiento para ver la sección de Sanidad.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Syringe className="h-8 w-8 text-purple-600" />
            Sanidad
          </h1>
          <p className="text-gray-600 mt-1">
            Control sanitario y tratamientos veterinarios
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-2 border-purple-600 text-purple-700 hover:bg-purple-50"
            onClick={() => setMasivaOpen(true)}
          >
            <Users className="h-4 w-4 mr-2" />
            Aplicación masiva
          </Button>
          <Button
            onClick={() => setTratamientoOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 border-0 shadow-lg shadow-purple-100"
          >
            <Plus className="h-4 w-4 mr-2" />
            Registrar tratamiento
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Tratamientos (mes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {kpis.totalTratamientosMes}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Animales tratados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {kpis.animalesTratados}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Pill className="h-4 w-4" />
              Productos más usados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpis.topProductos.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {kpis.topProductos.map((n) => (
                  <Badge key={n} variant="outline" className="text-xs">
                    {n}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-sm text-gray-400">—</span>
            )}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Próximos vencimientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpis.proximosVencimientos > 0 ? "text-orange-600" : "text-green-700"}`}>
              {kpis.proximosVencimientos}
              {kpis.proximosVencimientos > 0 && (
                <AlertTriangle className="inline h-5 w-5 ml-2 text-orange-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card className="border-2 border-gray-200">
        <CardContent className="p-4 md:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 border-2 border-gray-200">
              <TabsTrigger value="historial" className="flex items-center gap-2">
                <Syringe className="h-4 w-4" />
                <span className="hidden sm:inline">Historial</span>
              </TabsTrigger>
              <TabsTrigger value="por-animal" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Por animal</span>
              </TabsTrigger>
              <TabsTrigger value="calendario" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Calendario</span>
              </TabsTrigger>
            </TabsList>

            {/* --- Historial Tab --- */}
            <TabsContent value="historial" className="mt-6">
              <HistorialTab
                eventos={filteredEventos}
                loading={eventosQuery.isLoading}
                search={search}
                onSearch={setSearch}
                page={page}
                totalPages={pagination?.totalPages ?? 1}
                total={pagination?.total ?? 0}
                limit={LIMIT}
                onPageChange={setPage}
              />
            </TabsContent>

            {/* --- Por Animal Tab --- */}
            <TabsContent value="por-animal" className="mt-6">
              <PorAnimalTab eventos={allEventos} loading={allEventosQuery.isLoading} />
            </TabsContent>

            {/* --- Calendario Tab --- */}
            <TabsContent value="calendario" className="mt-6">
              <CalendarioTab eventos={allEventos} loading={allEventosQuery.isLoading} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <TratamientoDialog
        open={tratamientoOpen}
        onOpenChange={setTratamientoOpen}
        animales={animales}
        lotes={lotes}
        productos={productos}
        onSuccess={invalidate}
      />
      <MasivaDialog
        open={masivaOpen}
        onOpenChange={setMasivaOpen}
        lotes={lotes}
        productos={productos}
        estId={estId}
        onSuccess={invalidate}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Historial
// ---------------------------------------------------------------------------

function HistorialTab({
  eventos,
  loading,
  search,
  onSearch,
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: {
  eventos: EventoSanidad[]
  loading: boolean
  search: string
  onSearch: (v: string) => void
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (p: number) => void
}) {
  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por caravana o producto..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : eventos.length === 0 ? (
        <div className="text-center py-12">
          <Syringe className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No se encontraron eventos sanitarios</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Animal</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Dosis</TableHead>
                  <TableHead>Vía</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventos.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(ev.fecha)}</TableCell>
                    <TableCell className="font-medium">
                      {ev.animal
                        ? animalLabel(ev.animal)
                        : ev.lote
                          ? `Lote: ${ev.lote.nombre}`
                          : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ev.producto.nombre}</Badge>
                    </TableCell>
                    <TableCell>
                      {ev.dosis != null ? `${ev.dosis} ${ev.unidad || ""}` : "—"}
                    </TableCell>
                    <TableCell className="capitalize">{ev.via || "—"}</TableCell>
                    <TableCell className="capitalize">{ev.motivo || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">
                {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="flex items-center px-3 text-sm">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Por Animal
// ---------------------------------------------------------------------------

interface AnimalGroup {
  animalId: string
  label: string
  count: number
  lastDate: string
  eventos: EventoSanidad[]
}

function PorAnimalTab({ eventos, loading }: { eventos: EventoSanidad[]; loading: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const groups: AnimalGroup[] = useMemo(() => {
    const map = new Map<string, AnimalGroup>()
    eventos.forEach((ev) => {
      if (!ev.animal) return
      const key = ev.animal.id
      if (!map.has(key)) {
        map.set(key, {
          animalId: key,
          label: animalLabel(ev.animal),
          count: 0,
          lastDate: ev.fecha,
          eventos: [],
        })
      }
      const g = map.get(key)!
      g.count++
      g.eventos.push(ev)
      if (new Date(ev.fecha) > new Date(g.lastDate)) g.lastDate = ev.fecha
    })
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [eventos])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">No hay tratamientos registrados por animal</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const isOpen = expanded === g.animalId
        return (
          <div key={g.animalId} className="border rounded-lg">
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left"
              onClick={() => setExpanded(isOpen ? null : g.animalId)}
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold">{g.label}</span>
                <Badge variant="outline">{g.count} tratamiento{g.count !== 1 && "s"}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Último: {formatDate(g.lastDate)}</span>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>
            {isOpen && (
              <div className="border-t px-4 pb-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Dosis</TableHead>
                      <TableHead>Vía</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.eventos.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell>{formatDate(ev.fecha)}</TableCell>
                        <TableCell>{ev.producto.nombre}</TableCell>
                        <TableCell>{ev.dosis != null ? `${ev.dosis} ${ev.unidad || ""}` : "—"}</TableCell>
                        <TableCell className="capitalize">{ev.via || "—"}</TableCell>
                        <TableCell className="capitalize">{ev.motivo || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Calendario
// ---------------------------------------------------------------------------

function CalendarioTab({ eventos, loading }: { eventos: EventoSanidad[]; loading: boolean }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const eventsByDay = useMemo(() => {
    const map = new Map<number, number>()
    eventos.forEach((ev) => {
      const d = new Date(ev.fecha)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        map.set(day, (map.get(day) || 0) + 1)
      }
    })
    return map
  }, [eventos, year, month])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const monthLabel = new Date(year, month).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  })

  const goPrev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }
  const goNext = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  const dayCells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) dayCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) dayCells.push(d)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={goPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold capitalize">{monthLabel}</h3>
        <Button variant="outline" size="sm" onClick={goNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">
            {d}
          </div>
        ))}
        {dayCells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />
          const count = eventsByDay.get(day) || 0
          const isToday =
            day === now.getDate() && month === now.getMonth() && year === now.getFullYear()
          return (
            <div
              key={day}
              className={`
                relative flex flex-col items-center justify-center rounded-lg p-2 min-h-[56px]
                border transition-colors
                ${isToday ? "border-purple-400 bg-purple-50" : "border-gray-100"}
                ${count > 0 ? "bg-purple-50/50" : ""}
              `}
            >
              <span className={`text-sm ${isToday ? "font-bold text-purple-700" : "text-gray-700"}`}>
                {day}
              </span>
              {count > 0 && (
                <Badge className="mt-1 text-[10px] px-1.5 py-0 bg-purple-600 hover:bg-purple-600">
                  {count}
                </Badge>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialog: Registrar Tratamiento
// ---------------------------------------------------------------------------

function TratamientoDialog({
  open,
  onOpenChange,
  animales,
  lotes,
  productos,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  animales: AnimalOption[]
  lotes: LoteOption[]
  productos: InventarioProducto[]
  onSuccess: () => void
}) {
  const [animalId, setAnimalId] = useState("")
  const [loteId, setLoteId] = useState("")
  const [productoId, setProductoId] = useState("")
  const [dosis, setDosis] = useState("")
  const [unidad, setUnidad] = useState("")
  const [via, setVia] = useState("")
  const [motivo, setMotivo] = useState("")
  const [fecha, setFecha] = useState(todayISO())
  const [observaciones, setObservaciones] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)

  const reset = () => {
    setAnimalId("")
    setLoteId("")
    setProductoId("")
    setDosis("")
    setUnidad("")
    setVia("")
    setMotivo("")
    setFecha(todayISO())
    setObservaciones("")
    setBusqueda("")
    setShowDropdown(false)
  }

  const filteredAnimales = useMemo(() => {
    if (!busqueda.trim()) return []
    const q = busqueda.toLowerCase()
    return animales
      .filter(
        (a) =>
          a.caravanaVisual?.toLowerCase().includes(q) ||
          a.cuig?.toLowerCase().includes(q) ||
          a.otroId?.toLowerCase().includes(q)
      )
      .slice(0, 10)
  }, [busqueda, animales])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        productoId,
        dosis: dosis ? parseFloat(dosis) : undefined,
        unidad: unidad || undefined,
        via: via || undefined,
        motivo: motivo || undefined,
        fecha,
        observ: observaciones || undefined,
      }
      if (animalId) payload.animalId = animalId
      if (loteId) payload.loteId = loteId

      const res = await fetch("/api/sanidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || "Error al registrar")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Tratamiento registrado correctamente")
      reset()
      onOpenChange(false)
      onSuccess()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const handleSubmit = () => {
    if (!productoId) return toast.error("Seleccioná un producto")
    if (!animalId && !loteId) return toast.error("Seleccioná un animal o un lote")
    mutation.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Syringe className="h-5 w-5 text-purple-600" />
            Registrar tratamiento
          </DialogTitle>
          <DialogDescription>
            Registrá un tratamiento individual o por lote
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Animal search */}
          <div>
            <Label>Animal (buscar por caravana)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Escribí la caravana..."
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  setAnimalId("")
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                className="pl-10"
              />
            </div>
            {showDropdown && filteredAnimales.length > 0 && !animalId && (
              <div className="mt-1 border rounded-lg max-h-40 overflow-y-auto bg-white shadow-sm">
                {filteredAnimales.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                    onClick={() => {
                      setAnimalId(a.id)
                      setBusqueda(animalLabel(a))
                      setShowDropdown(false)
                      setLoteId("")
                    }}
                  >
                    {animalLabel(a)}
                  </button>
                ))}
              </div>
            )}
            {animalId && (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  Animal seleccionado
                </Badge>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setAnimalId(""); setBusqueda("") }}>
                  Cambiar
                </Button>
              </div>
            )}
          </div>

          <div className="text-center text-xs text-gray-400">— O —</div>

          {/* Lote select */}
          <div>
            <Label>Lote (aplica a todos los animales del lote)</Label>
            <Select
              value={loteId}
              onValueChange={(v) => {
                setLoteId(v)
                setAnimalId("")
                setBusqueda("")
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar lote" />
              </SelectTrigger>
              <SelectContent>
                {lotes.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nombre} ({l.cantidadAnimales} animales)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Producto */}
          <div>
            <Label>Producto *</Label>
            <Select value={productoId} onValueChange={setProductoId}>
              <SelectTrigger>
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

          {/* Dosis + Unidad + Vía */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Dosis</Label>
              <Input type="number" step="0.1" placeholder="Ej: 5" value={dosis} onChange={(e) => setDosis(e.target.value)} />
            </div>
            <div>
              <Label>Unidad</Label>
              <Select value={unidad} onValueChange={setUnidad}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vía</Label>
              <Select value={via} onValueChange={setVia}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {VIAS.map((v) => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Motivo + Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Motivo</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <Label>Observaciones</Label>
            <Textarea
              placeholder="Notas adicionales..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" className="border-2" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Registrar tratamiento"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialog: Aplicación Masiva
// ---------------------------------------------------------------------------

function MasivaDialog({
  open,
  onOpenChange,
  lotes,
  productos,
  estId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  lotes: LoteOption[]
  productos: InventarioProducto[]
  estId: string
  onSuccess: () => void
}) {
  const [loteId, setLoteId] = useState("")
  const [productoId, setProductoId] = useState("")
  const [dosis, setDosis] = useState("")
  const [unidad, setUnidad] = useState("")
  const [via, setVia] = useState("")
  const [motivo, setMotivo] = useState("")
  const [fecha, setFecha] = useState(todayISO())

  const selectedLote = lotes.find((l) => l.id === loteId)

  const bovinosInLote = useQuery({
    queryKey: ["bovinos", "lote", loteId],
    queryFn: async () => {
      const res = await fetch(`/api/ganado/bovinos?establecimientoId=${estId}&loteId=${loteId}&limit=2000`)
      if (!res.ok) return []
      const json = await res.json()
      return json.success ? (json.data as AnimalOption[]) : []
    },
    enabled: !!loteId,
    staleTime: 30_000,
  })

  const animalCount = bovinosInLote.data?.length ?? selectedLote?.cantidadAnimales ?? 0

  const reset = () => {
    setLoteId("")
    setProductoId("")
    setDosis("")
    setUnidad("")
    setVia("")
    setMotivo("")
    setFecha(todayISO())
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const animals = bovinosInLote.data ?? []
      if (animals.length === 0) throw new Error("No hay animales en el lote seleccionado")

      const results = await Promise.allSettled(
        animals.map((a: any) =>
          fetch("/api/sanidad", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              animalId: a.id,
              productoId,
              dosis: dosis ? parseFloat(dosis) : undefined,
              unidad: unidad || undefined,
              via: via || undefined,
              motivo: motivo || undefined,
              fecha,
              loteId,
            }),
          })
        )
      )

      const ok = results.filter((r) => r.status === "fulfilled").length
      const failed = results.length - ok
      return { ok, failed, total: results.length }
    },
    onSuccess: (data) => {
      if (data.failed > 0) {
        toast.warning(`${data.ok} de ${data.total} tratamientos registrados (${data.failed} fallaron)`)
      } else {
        toast.success(`${data.ok} tratamientos registrados correctamente`)
      }
      reset()
      onOpenChange(false)
      onSuccess()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const handleSubmit = () => {
    if (!loteId) return toast.error("Seleccioná un lote")
    if (!productoId) return toast.error("Seleccioná un producto")
    mutation.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            Aplicación masiva
          </DialogTitle>
          <DialogDescription>
            Aplicá el mismo tratamiento a todos los animales de un lote
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Lote */}
          <div>
            <Label>Lote *</Label>
            <Select value={loteId} onValueChange={setLoteId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar lote" />
              </SelectTrigger>
              <SelectContent>
                {lotes.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nombre} ({l.cantidadAnimales} animales)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loteId && (
            <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
              <p className="text-sm text-purple-800 font-medium">
                {bovinosInLote.isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando animales...
                  </span>
                ) : (
                  `Se aplicará el tratamiento a ${animalCount} animal${animalCount !== 1 ? "es" : ""}`
                )}
              </p>
            </div>
          )}

          {/* Producto */}
          <div>
            <Label>Producto *</Label>
            <Select value={productoId} onValueChange={setProductoId}>
              <SelectTrigger>
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Dosis</Label>
              <Input type="number" step="0.1" placeholder="Ej: 5" value={dosis} onChange={(e) => setDosis(e.target.value)} />
            </div>
            <div>
              <Label>Unidad</Label>
              <Select value={unidad} onValueChange={setUnidad}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vía</Label>
              <Select value={via} onValueChange={setVia}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {VIAS.map((v) => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Motivo</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" className="border-2" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending || bovinosInLote.isLoading}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Aplicando a {animalCount} animales...
                </>
              ) : (
                `Confirmar (${animalCount} animales)`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
