"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Syringe,
  Plus,
  Package,
  Calendar,
  Search,
  RefreshCw,
  Pill,
  ShieldCheck,
  Bug,
  Droplets,
  Sparkles,
  MoreHorizontal,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

// ============================================
// TIPOS
// ============================================

interface Producto {
  id: string
  nombre: string
  tipo: string
  principioActivo: string | null
  laboratorio: string | null
  retiroDias: number
  dosisReferencia: string | null
  notas: string | null
  lotes: LoteProducto[]
  _count: { eventosSanidad: number }
}

interface LoteProducto {
  id: string
  nroLote: string
  vencimiento: string | null
  proveedor: string | null
  cantidad: number | null
  unidad: string | null
  costo: number | null
}

interface EventoSanidad {
  id: string
  fecha: string
  dosis: number | null
  unidad: string | null
  via: string | null
  motivo: string | null
  carenciaDias: number | null
  aplicador: string | null
  veterinario: string | null
  costo: number | null
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
  producto: Producto
  loteProducto: LoteProducto | null
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
}

// ============================================
// CONSTANTES
// ============================================

const TIPOS_PRODUCTO = [
  { value: "vacuna", label: "Vacuna", icon: ShieldCheck, color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "antiparasitario", label: "Antiparasitario", icon: Bug, color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "antibiotico", label: "Antibiótico", icon: Pill, color: "bg-red-100 text-red-800 border-red-200" },
  { value: "mineral", label: "Mineral", icon: Sparkles, color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "vitaminico", label: "Vitamínico", icon: Droplets, color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "otro", label: "Otro", icon: MoreHorizontal, color: "bg-gray-100 text-gray-800 border-gray-200" },
]

const VIAS_APLICACION = [
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

const UNIDADES_DOSIS = [
  { value: "ml", label: "ml" },
  { value: "cc", label: "cc" },
  { value: "comprimido", label: "Comprimido" },
]

function getTipoBadge(tipo: string) {
  return TIPOS_PRODUCTO.find((t) => t.value === tipo) || TIPOS_PRODUCTO[5]
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  })
}

function isExpired(dateStr: string | null) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function isExpiringSoon(dateStr: string | null) {
  if (!dateStr) return false
  const venc = new Date(dateStr)
  const limit = new Date()
  limit.setDate(limit.getDate() + 30)
  return venc > new Date() && venc <= limit
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function SanidadPage() {
  const [activeTab, setActiveTab] = useState("eventos")

  // Estado de datos
  const [eventos, setEventos] = useState<EventoSanidad[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [animales, setAnimales] = useState<AnimalOption[]>([])
  const [lotes, setLotes] = useState<LoteOption[]>([])

  // Estado de carga
  const [loadingEventos, setLoadingEventos] = useState(false)
  const [loadingProductos, setLoadingProductos] = useState(false)

  // Dialogs
  const [eventoDialogOpen, setEventoDialogOpen] = useState(false)
  const [productoDialogOpen, setProductoDialogOpen] = useState(false)
  const [loteProductoDialogOpen, setLoteProductoDialogOpen] = useState(false)
  const [productoParaLote, setProductoParaLote] = useState<string | null>(null)

  // Filtros eventos
  const [filtroDesde, setFiltroDesde] = useState("")
  const [filtroHasta, setFiltroHasta] = useState("")
  const [filtroProducto, setFiltroProducto] = useState("all")

  // Filtros productos
  const [filtroTipoProducto, setFiltroTipoProducto] = useState("all")
  const [busquedaProducto, setBusquedaProducto] = useState("")

  // Búsqueda de animal
  const [busquedaAnimal, setBusquedaAnimal] = useState("")
  const [animalesFiltrados, setAnimalesFiltrados] = useState<AnimalOption[]>([])

  // Paginación eventos
  const [paginaEventos, setPaginaEventos] = useState(1)
  const [totalEventos, setTotalEventos] = useState(0)
  const limitEventos = 20

  // ============================================
  // FETCH DE DATOS
  // ============================================

  const fetchEventos = useCallback(async () => {
    setLoadingEventos(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(paginaEventos))
      params.set("limit", String(limitEventos))
      if (filtroDesde) params.set("desde", filtroDesde)
      if (filtroHasta) params.set("hasta", filtroHasta)
      if (filtroProducto && filtroProducto !== "all") params.set("productoId", filtroProducto)

      const res = await fetch(`/api/sanidad?${params.toString()}`)
      const json = await res.json()

      if (json.success) {
        setEventos(json.data)
        setTotalEventos(json.pagination.total)
      }
    } catch {
      toast.error("Error al cargar eventos sanitarios")
    } finally {
      setLoadingEventos(false)
    }
  }, [paginaEventos, filtroDesde, filtroHasta, filtroProducto])

  const fetchProductos = useCallback(async () => {
    setLoadingProductos(true)
    try {
      const params = new URLSearchParams()
      if (filtroTipoProducto && filtroTipoProducto !== "all") params.set("tipo", filtroTipoProducto)
      if (busquedaProducto) params.set("busqueda", busquedaProducto)

      const res = await fetch(`/api/productos?${params.toString()}`)
      const json = await res.json()

      if (json.success) {
        setProductos(json.data)
      }
    } catch {
      toast.error("Error al cargar productos")
    } finally {
      setLoadingProductos(false)
    }
  }, [filtroTipoProducto, busquedaProducto])

  const fetchAnimales = useCallback(async () => {
    try {
      const res = await fetch("/api/ganado/bovinos?limit=500")
      const json = await res.json()
      if (json.success) {
        setAnimales(
          json.data.map((a: any) => ({
            id: a.id,
            caravanaVisual: a.caravanaVisual || a.tagNumber,
            cuig: a.cuig,
            otroId: a.otroId,
          }))
        )
      }
    } catch {
      /* silencioso */
    }
  }, [])

  const fetchLotes = useCallback(async () => {
    try {
      const res = await fetch("/api/establecimientos/all/lotes")
      const json = await res.json()
      if (Array.isArray(json)) {
        setLotes(json)
      }
    } catch {
      /* silencioso: puede que la ruta no exista */
    }
  }, [])

  useEffect(() => {
    fetchEventos()
  }, [fetchEventos])

  useEffect(() => {
    fetchProductos()
  }, [fetchProductos])

  useEffect(() => {
    fetchAnimales()
    fetchLotes()
  }, [fetchAnimales, fetchLotes])

  // Filtrar animales por caravana cuando se busca
  useEffect(() => {
    if (!busquedaAnimal.trim()) {
      setAnimalesFiltrados([])
      return
    }
    const query = busquedaAnimal.toLowerCase()
    setAnimalesFiltrados(
      animales.filter(
        (a) =>
          a.caravanaVisual?.toLowerCase().includes(query) ||
          a.cuig?.toLowerCase().includes(query) ||
          a.otroId?.toLowerCase().includes(query)
      ).slice(0, 10)
    )
  }, [busquedaAnimal, animales])

  // ============================================
  // CALENDARIO: agrupar eventos por mes
  // ============================================

  const eventosPorMes = useMemo(() => {
    const grupos: Record<string, EventoSanidad[]> = {}
    eventos.forEach((ev) => {
      const d = new Date(ev.fecha)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      if (!grupos[key]) grupos[key] = []
      grupos[key].push(ev)
    })
    return Object.entries(grupos)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, evs]) => {
        const [year, month] = key.split("-")
        const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(
          "es-AR",
          { month: "long", year: "numeric" }
        )
        return { key, label, eventos: evs }
      })
  }, [eventos])

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Syringe className="h-8 w-8 text-purple-600" />
            Sanidad Animal
          </h1>
          <p className="text-gray-600 mt-1">
            Gestión de eventos sanitarios, productos veterinarios y calendario de aplicaciones
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-2"
            onClick={() => {
              fetchEventos()
              fetchProductos()
            }}
            disabled={loadingEventos || loadingProductos}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loadingEventos || loadingProductos ? "animate-spin" : ""}`}
            />
            Actualizar
          </Button>
          <Button
            onClick={() => setProductoDialogOpen(true)}
            variant="outline"
            className="border-2 border-purple-600 text-purple-700 hover:bg-purple-50"
          >
            <Package className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
          <Button
            onClick={() => setEventoDialogOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 border-0 shadow-lg shadow-purple-100"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Evento
          </Button>
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-700">{totalEventos}</div>
            <p className="text-sm text-gray-500">Eventos registrados</p>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-700">{productos.length}</div>
            <p className="text-sm text-gray-500">Productos</p>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-700">
              {productos.reduce(
                (acc, p) =>
                  acc + p.lotes.filter((l) => isExpiringSoon(l.vencimiento)).length,
                0
              )}
            </div>
            <p className="text-sm text-gray-500">Lotes por vencer</p>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-700">
              {productos.reduce(
                (acc, p) =>
                  acc + p.lotes.filter((l) => isExpired(l.vencimiento)).length,
                0
              )}
            </div>
            <p className="text-sm text-gray-500">Lotes vencidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Card className="border-2 border-gray-200">
        <CardContent className="p-4 md:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 border-2 border-gray-200">
              <TabsTrigger value="eventos" className="flex items-center gap-2">
                <Syringe className="h-4 w-4" />
                <span className="hidden sm:inline">Eventos</span>
              </TabsTrigger>
              <TabsTrigger value="productos" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Productos</span>
              </TabsTrigger>
              <TabsTrigger value="calendario" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Calendario</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB: EVENTOS */}
            <TabsContent value="eventos" className="mt-6">
              <EventosTab
                eventos={eventos}
                loading={loadingEventos}
                productos={productos}
                filtroDesde={filtroDesde}
                filtroHasta={filtroHasta}
                filtroProducto={filtroProducto}
                paginaActual={paginaEventos}
                totalEventos={totalEventos}
                limitEventos={limitEventos}
                onFiltroDesde={setFiltroDesde}
                onFiltroHasta={setFiltroHasta}
                onFiltroProducto={setFiltroProducto}
                onPageChange={setPaginaEventos}
                onNuevoEvento={() => setEventoDialogOpen(true)}
              />
            </TabsContent>

            {/* TAB: PRODUCTOS */}
            <TabsContent value="productos" className="mt-6">
              <ProductosTab
                productos={productos}
                loading={loadingProductos}
                filtroTipo={filtroTipoProducto}
                busqueda={busquedaProducto}
                onFiltroTipo={setFiltroTipoProducto}
                onBusqueda={setBusquedaProducto}
                onNuevoProducto={() => setProductoDialogOpen(true)}
                onNuevoLote={(productoId) => {
                  setProductoParaLote(productoId)
                  setLoteProductoDialogOpen(true)
                }}
              />
            </TabsContent>

            {/* TAB: CALENDARIO */}
            <TabsContent value="calendario" className="mt-6">
              <CalendarioTab eventosPorMes={eventosPorMes} loading={loadingEventos} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* DIALOG: Nuevo Evento Sanitario */}
      <EventoFormDialog
        open={eventoDialogOpen}
        onOpenChange={setEventoDialogOpen}
        productos={productos}
        animales={animales}
        lotes={lotes}
        busquedaAnimal={busquedaAnimal}
        animalesFiltrados={animalesFiltrados}
        onBusquedaAnimal={setBusquedaAnimal}
        onSuccess={() => {
          fetchEventos()
          setEventoDialogOpen(false)
        }}
      />

      {/* DIALOG: Nuevo Producto */}
      <ProductoFormDialog
        open={productoDialogOpen}
        onOpenChange={setProductoDialogOpen}
        onSuccess={() => {
          fetchProductos()
          setProductoDialogOpen(false)
        }}
      />

      {/* DIALOG: Nuevo Lote de Producto */}
      <LoteProductoFormDialog
        open={loteProductoDialogOpen}
        onOpenChange={setLoteProductoDialogOpen}
        productoId={productoParaLote}
        onSuccess={() => {
          fetchProductos()
          setLoteProductoDialogOpen(false)
          setProductoParaLote(null)
        }}
      />
    </div>
  )
}

// ============================================
// TAB: EVENTOS
// ============================================

function EventosTab({
  eventos,
  loading,
  productos,
  filtroDesde,
  filtroHasta,
  filtroProducto,
  paginaActual,
  totalEventos,
  limitEventos,
  onFiltroDesde,
  onFiltroHasta,
  onFiltroProducto,
  onPageChange,
  onNuevoEvento,
}: {
  eventos: EventoSanidad[]
  loading: boolean
  productos: Producto[]
  filtroDesde: string
  filtroHasta: string
  filtroProducto: string
  paginaActual: number
  totalEventos: number
  limitEventos: number
  onFiltroDesde: (v: string) => void
  onFiltroHasta: (v: string) => void
  onFiltroProducto: (v: string) => void
  onPageChange: (p: number) => void
  onNuevoEvento: () => void
}) {
  const totalPages = Math.ceil(totalEventos / limitEventos)

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs text-gray-500">Desde</Label>
          <Input
            type="date"
            value={filtroDesde}
            onChange={(e) => onFiltroDesde(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Hasta</Label>
          <Input
            type="date"
            value={filtroHasta}
            onChange={(e) => onFiltroHasta(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Producto</Label>
          <Select value={filtroProducto} onValueChange={onFiltroProducto}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {productos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onFiltroDesde("")
            onFiltroHasta("")
            onFiltroProducto("all")
          }}
        >
          Limpiar
        </Button>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando eventos...</div>
      ) : eventos.length === 0 ? (
        <div className="text-center py-12">
          <Syringe className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">No hay eventos sanitarios registrados</p>
          <Button onClick={onNuevoEvento} variant="outline" className="border-2">
            <Plus className="h-4 w-4 mr-2" />
            Registrar primer evento
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Fecha</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Animal / Lote</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Producto</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Dosis</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Vía</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Motivo</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Veterinario</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => {
                  const tipoBadge = getTipoBadge(ev.producto.tipo)
                  return (
                    <tr key={ev.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2 whitespace-nowrap">{formatDate(ev.fecha)}</td>
                      <td className="py-3 px-2">
                        {ev.animal ? (
                          <span className="font-medium">
                            {ev.animal.caravanaVisual || ev.animal.cuig || "S/ID"}
                          </span>
                        ) : ev.lote ? (
                          <div>
                            <span className="font-medium">{ev.lote.nombre}</span>
                            {ev.cantidadAnimales && (
                              <span className="text-gray-500 text-xs ml-1">
                                ({ev.cantidadAnimales} cab.)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={tipoBadge.color}>
                            {ev.producto.nombre}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        {ev.dosis ? `${ev.dosis} ${ev.unidad || ""}` : "—"}
                      </td>
                      <td className="py-3 px-2 capitalize">{ev.via || "—"}</td>
                      <td className="py-3 px-2 capitalize">{ev.motivo || "—"}</td>
                      <td className="py-3 px-2">{ev.veterinario || "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-gray-500">
                Mostrando {(paginaActual - 1) * limitEventos + 1}-
                {Math.min(paginaActual * limitEventos, totalEventos)} de {totalEventos}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaActual <= 1}
                  onClick={() => onPageChange(paginaActual - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="flex items-center px-3 text-sm text-gray-700">
                  {paginaActual} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaActual >= totalPages}
                  onClick={() => onPageChange(paginaActual + 1)}
                >
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

// ============================================
// TAB: PRODUCTOS
// ============================================

function ProductosTab({
  productos,
  loading,
  filtroTipo,
  busqueda,
  onFiltroTipo,
  onBusqueda,
  onNuevoProducto,
  onNuevoLote,
}: {
  productos: Producto[]
  loading: boolean
  filtroTipo: string
  busqueda: string
  onFiltroTipo: (v: string) => void
  onBusqueda: (v: string) => void
  onNuevoProducto: () => void
  onNuevoLote: (productoId: string) => void
}) {
  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs text-gray-500">Buscar producto</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Nombre, principio activo o laboratorio..."
              value={busqueda}
              onChange={(e) => onBusqueda(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-gray-500">Tipo</Label>
          <Select value={filtroTipo} onValueChange={onFiltroTipo}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {TIPOS_PRODUCTO.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando productos...</div>
      ) : productos.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">No hay productos registrados</p>
          <Button onClick={onNuevoProducto} variant="outline" className="border-2">
            <Plus className="h-4 w-4 mr-2" />
            Agregar primer producto
          </Button>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {productos.map((producto) => {
            const tipoBadge = getTipoBadge(producto.tipo)
            const TipoIcon = tipoBadge.icon

            return (
              <AccordionItem
                key={producto.id}
                value={producto.id}
                className="border-2 rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-4 flex-1 text-left">
                    <div className="p-2 rounded-lg bg-gray-50">
                      <TipoIcon className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{producto.nombre}</span>
                        <Badge variant="outline" className={tipoBadge.color}>
                          {tipoBadge.label}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        {producto.principioActivo && (
                          <span>P.A.: {producto.principioActivo}</span>
                        )}
                        {producto.laboratorio && (
                          <span>Lab.: {producto.laboratorio}</span>
                        )}
                        <span>Retiro: {producto.retiroDias} días</span>
                        <span>{producto._count.eventosSanidad} aplicaciones</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="mr-2">
                      {producto.lotes.length} lote{producto.lotes.length !== 1 && "s"}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-3">
                    {producto.dosisReferencia && (
                      <p className="text-sm text-gray-600">
                        <strong>Dosis de referencia:</strong> {producto.dosisReferencia}
                      </p>
                    )}
                    {producto.notas && (
                      <p className="text-sm text-gray-600">
                        <strong>Notas:</strong> {producto.notas}
                      </p>
                    )}

                    {/* Lotes del producto */}
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm text-gray-700">
                        Lotes disponibles
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-2"
                        onClick={() => onNuevoLote(producto.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Agregar lote
                      </Button>
                    </div>

                    {producto.lotes.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Sin lotes registrados</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-2 text-gray-600">Nº Lote</th>
                              <th className="text-left py-2 px-2 text-gray-600">Vencimiento</th>
                              <th className="text-left py-2 px-2 text-gray-600">Proveedor</th>
                              <th className="text-left py-2 px-2 text-gray-600">Cantidad</th>
                              <th className="text-left py-2 px-2 text-gray-600">Costo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {producto.lotes.map((lote) => (
                              <tr
                                key={lote.id}
                                className="border-b border-gray-50 hover:bg-gray-50"
                              >
                                <td className="py-2 px-2 font-medium">{lote.nroLote}</td>
                                <td className="py-2 px-2">
                                  {lote.vencimiento ? (
                                    <span className="flex items-center gap-1">
                                      {formatDate(lote.vencimiento)}
                                      {isExpired(lote.vencimiento) && (
                                        <Badge variant="destructive" className="text-xs">
                                          Vencido
                                        </Badge>
                                      )}
                                      {isExpiringSoon(lote.vencimiento) && (
                                        <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                                          <AlertTriangle className="h-3 w-3 mr-1" />
                                          Próximo
                                        </Badge>
                                      )}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="py-2 px-2">{lote.proveedor || "—"}</td>
                                <td className="py-2 px-2">
                                  {lote.cantidad != null
                                    ? `${lote.cantidad} ${lote.unidad || ""}`
                                    : "—"}
                                </td>
                                <td className="py-2 px-2">
                                  {lote.costo != null ? `$${lote.costo.toLocaleString("es-AR")}` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  )
}

// ============================================
// TAB: CALENDARIO
// ============================================

function CalendarioTab({
  eventosPorMes,
  loading,
}: {
  eventosPorMes: { key: string; label: string; eventos: EventoSanidad[] }[]
  loading: boolean
}) {
  if (loading) {
    return <div className="text-center py-12 text-gray-500">Cargando calendario...</div>
  }

  if (eventosPorMes.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">No hay eventos para mostrar en el calendario</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {eventosPorMes.map((grupo) => (
        <div key={grupo.key}>
          <h3 className="text-lg font-semibold capitalize mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            {grupo.label}
            <Badge variant="outline">{grupo.eventos.length}</Badge>
          </h3>
          <div className="grid gap-2">
            {grupo.eventos.map((ev) => {
              const tipoBadge = getTipoBadge(ev.producto.tipo)
              return (
                <div
                  key={ev.id}
                  className="flex items-center gap-4 p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <div className="text-center min-w-[50px]">
                    <div className="text-lg font-bold text-gray-800">
                      {new Date(ev.fecha).getDate()}
                    </div>
                    <div className="text-xs text-gray-500 uppercase">
                      {formatDateShort(ev.fecha).split(" ")[1]}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={tipoBadge.color}>
                        {ev.producto.nombre}
                      </Badge>
                      {ev.motivo && (
                        <span className="text-xs text-gray-500 capitalize">{ev.motivo}</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {ev.animal
                        ? `Animal: ${ev.animal.caravanaVisual || ev.animal.cuig || "S/ID"}`
                        : ev.lote
                          ? `Lote: ${ev.lote.nombre}${ev.cantidadAnimales ? ` (${ev.cantidadAnimales} cab.)` : ""}`
                          : "—"}
                      {ev.dosis && ` — ${ev.dosis} ${ev.unidad || ""}`}
                      {ev.veterinario && ` — Vet: ${ev.veterinario}`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// DIALOG: Formulario de Evento Sanitario
// ============================================

function EventoFormDialog({
  open,
  onOpenChange,
  productos,
  animales,
  lotes,
  busquedaAnimal,
  animalesFiltrados,
  onBusquedaAnimal,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  productos: Producto[]
  animales: AnimalOption[]
  lotes: LoteOption[]
  busquedaAnimal: string
  animalesFiltrados: AnimalOption[]
  onBusquedaAnimal: (v: string) => void
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [modo, setModo] = useState<"animal" | "lote">("animal")
  const [animalId, setAnimalId] = useState("")
  const [loteId, setLoteId] = useState("")
  const [productoId, setProductoId] = useState("")
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])
  const [dosis, setDosis] = useState("")
  const [unidad, setUnidad] = useState("")
  const [via, setVia] = useState("")
  const [motivo, setMotivo] = useState("")
  const [veterinario, setVeterinario] = useState("")
  const [observ, setObserv] = useState("")
  const [cantidadAnimales, setCantidadAnimales] = useState("")
  const [loteProductoId, setLoteProductoId] = useState("")

  const productoSeleccionado = productos.find((p) => p.id === productoId)

  const resetForm = () => {
    setModo("animal")
    setAnimalId("")
    setLoteId("")
    setProductoId("")
    setFecha(new Date().toISOString().split("T")[0])
    setDosis("")
    setUnidad("")
    setVia("")
    setMotivo("")
    setVeterinario("")
    setObserv("")
    setCantidadAnimales("")
    setLoteProductoId("")
    onBusquedaAnimal("")
  }

  const handleSubmit = async () => {
    if (!productoId) {
      toast.error("Seleccioná un producto")
      return
    }
    if (modo === "animal" && !animalId) {
      toast.error("Seleccioná un animal")
      return
    }
    if (modo === "lote" && !loteId) {
      toast.error("Seleccioná un lote")
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        productoId,
        fecha,
        dosis: dosis || null,
        unidad: unidad || null,
        via: via || null,
        motivo: motivo || null,
        veterinario: veterinario || null,
        observ: observ || null,
        loteProductoId: loteProductoId && loteProductoId !== "none" ? loteProductoId : null,
      }

      if (modo === "animal") {
        payload.animalId = animalId
      } else {
        payload.loteId = loteId
        payload.cantidadAnimales = cantidadAnimales || null
      }

      const res = await fetch("/api/sanidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Error al crear evento")
      }

      toast.success("Evento sanitario registrado correctamente")
      resetForm()
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || "Error al registrar evento")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Syringe className="h-5 w-5 text-purple-600" />
            Nuevo Evento Sanitario
          </DialogTitle>
          <DialogDescription>
            Registrá una aplicación sanitaria individual o masiva por lote
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Modo: Animal o Lote */}
          <div>
            <Label>Aplicar a</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                variant={modo === "animal" ? "default" : "outline"}
                size="sm"
                className={modo === "animal" ? "" : "border-2"}
                onClick={() => setModo("animal")}
              >
                Animal individual
              </Button>
              <Button
                type="button"
                variant={modo === "lote" ? "default" : "outline"}
                size="sm"
                className={modo === "lote" ? "" : "border-2"}
                onClick={() => setModo("lote")}
              >
                Lote (masivo)
              </Button>
            </div>
          </div>

          {/* Selección de animal con búsqueda */}
          {modo === "animal" && (
            <div>
              <Label>Buscar animal por caravana</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Escribí la caravana..."
                  value={busquedaAnimal}
                  onChange={(e) => onBusquedaAnimal(e.target.value)}
                  className="pl-10"
                />
              </div>
              {animalesFiltrados.length > 0 && !animalId && (
                <div className="mt-1 border rounded-lg max-h-40 overflow-y-auto">
                  {animalesFiltrados.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                      onClick={() => {
                        setAnimalId(a.id)
                        onBusquedaAnimal(
                          a.caravanaVisual || a.cuig || a.otroId || ""
                        )
                      }}
                    >
                      {a.caravanaVisual || a.cuig || a.otroId || "Sin ID"}
                    </button>
                  ))}
                </div>
              )}
              {animalId && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    Animal seleccionado
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAnimalId("")
                      onBusquedaAnimal("")
                    }}
                  >
                    Cambiar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Selección de lote */}
          {modo === "lote" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Lote</Label>
                <Select value={loteId} onValueChange={setLoteId}>
                  <SelectTrigger>
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
              </div>
              <div>
                <Label>Cantidad de animales</Label>
                <Input
                  type="number"
                  placeholder="Ej: 50"
                  value={cantidadAnimales}
                  onChange={(e) => setCantidadAnimales(e.target.value)}
                />
              </div>
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
                    {p.nombre} ({getTipoBadge(p.tipo).label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lote de producto (si el producto tiene lotes) */}
          {productoSeleccionado && productoSeleccionado.lotes.length > 0 && (
            <div>
              <Label>Lote del producto (opcional)</Label>
              <Select value={loteProductoId} onValueChange={setLoteProductoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin especificar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin especificar</SelectItem>
                  {productoSeleccionado.lotes.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      Lote {l.nroLote}
                      {l.vencimiento && ` — Venc: ${formatDate(l.vencimiento)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Fecha */}
          <div>
            <Label>Fecha *</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          {/* Dosis, Unidad, Vía */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Dosis</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="Ej: 5"
                value={dosis}
                onChange={(e) => setDosis(e.target.value)}
              />
            </div>
            <div>
              <Label>Unidad</Label>
              <Select value={unidad} onValueChange={setUnidad}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_DOSIS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vía</Label>
              <Select value={via} onValueChange={setVia}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {VIAS_APLICACION.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Motivo y Veterinario */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Motivo</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Veterinario</Label>
              <Input
                placeholder="Nombre del veterinario"
                value={veterinario}
                onChange={(e) => setVeterinario(e.target.value)}
              />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <Label>Observaciones</Label>
            <Input
              placeholder="Notas adicionales..."
              value={observ}
              onChange={(e) => setObserv(e.target.value)}
            />
          </div>

          {/* Botón enviar */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              className="border-2"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {submitting ? "Guardando..." : "Registrar Evento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// DIALOG: Formulario de Producto
// ============================================

function ProductoFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState("")
  const [principioActivo, setPrincipioActivo] = useState("")
  const [laboratorio, setLaboratorio] = useState("")
  const [retiroDias, setRetiroDias] = useState("")
  const [dosisReferencia, setDosisReferencia] = useState("")
  const [notas, setNotas] = useState("")

  const resetForm = () => {
    setNombre("")
    setTipo("")
    setPrincipioActivo("")
    setLaboratorio("")
    setRetiroDias("")
    setDosisReferencia("")
    setNotas("")
  }

  const handleSubmit = async () => {
    if (!nombre.trim()) {
      toast.error("El nombre del producto es obligatorio")
      return
    }
    if (!tipo) {
      toast.error("Seleccioná el tipo de producto")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          tipo,
          principioActivo: principioActivo || null,
          laboratorio: laboratorio || null,
          retiroDias: retiroDias || null,
          dosisReferencia: dosisReferencia || null,
          notas: notas || null,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Error al crear producto")
      }

      toast.success(`Producto "${nombre}" creado correctamente`)
      resetForm()
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || "Error al crear producto")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            Nuevo Producto Veterinario
          </DialogTitle>
          <DialogDescription>
            Agregá un producto al catálogo de sanidad
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label>Nombre *</Label>
            <Input
              placeholder="Ej: Ivomec Gold"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div>
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_PRODUCTO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Principio Activo</Label>
            <Input
              placeholder="Ej: Ivermectina 1%"
              value={principioActivo}
              onChange={(e) => setPrincipioActivo(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Laboratorio</Label>
              <Input
                placeholder="Ej: Merial"
                value={laboratorio}
                onChange={(e) => setLaboratorio(e.target.value)}
              />
            </div>
            <div>
              <Label>Días de retiro</Label>
              <Input
                type="number"
                placeholder="0"
                value={retiroDias}
                onChange={(e) => setRetiroDias(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Dosis de referencia</Label>
            <Input
              placeholder="Ej: 1 ml cada 50 kg"
              value={dosisReferencia}
              onChange={(e) => setDosisReferencia(e.target.value)}
            />
          </div>

          <div>
            <Label>Notas</Label>
            <Input
              placeholder="Notas adicionales..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              className="border-2"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {submitting ? "Guardando..." : "Crear Producto"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// DIALOG: Formulario de Lote de Producto
// ============================================

function LoteProductoFormDialog({
  open,
  onOpenChange,
  productoId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  productoId: string | null
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [nroLote, setNroLote] = useState("")
  const [vencimiento, setVencimiento] = useState("")
  const [proveedor, setProveedor] = useState("")
  const [cantidad, setCantidad] = useState("")
  const [unidad, setUnidad] = useState("")
  const [costo, setCosto] = useState("")

  const resetForm = () => {
    setNroLote("")
    setVencimiento("")
    setProveedor("")
    setCantidad("")
    setUnidad("")
    setCosto("")
  }

  const handleSubmit = async () => {
    if (!productoId) return

    if (!nroLote.trim()) {
      toast.error("El número de lote es obligatorio")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/productos/${productoId}/lotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nroLote: nroLote.trim(),
          vencimiento: vencimiento || null,
          proveedor: proveedor || null,
          cantidad: cantidad || null,
          unidad: unidad || null,
          costo: costo || null,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Error al crear lote")
      }

      toast.success(`Lote "${nroLote}" agregado correctamente`)
      resetForm()
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || "Error al crear lote")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            Nuevo Lote de Producto
          </DialogTitle>
          <DialogDescription>
            Registrá un lote nuevo para el producto seleccionado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label>Número de Lote *</Label>
            <Input
              placeholder="Ej: LOT-2024-001"
              value={nroLote}
              onChange={(e) => setNroLote(e.target.value)}
            />
          </div>

          <div>
            <Label>Fecha de Vencimiento</Label>
            <Input
              type="date"
              value={vencimiento}
              onChange={(e) => setVencimiento(e.target.value)}
            />
          </div>

          <div>
            <Label>Proveedor</Label>
            <Input
              placeholder="Ej: Distribuidora Agro Norte"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cantidad</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="Ej: 500"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <div>
              <Label>Unidad</Label>
              <Input
                placeholder="Ej: ml, dosis, frascos"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Costo ($)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="Ej: 15000"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              className="border-2"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {submitting ? "Guardando..." : "Agregar Lote"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
