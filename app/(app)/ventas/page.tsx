"use client"

import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ShoppingCart,
  Plus,
  DollarSign,
  FileText,
  Users,
  Truck,
  TrendingUp,
  Search,
  ArrowDownUp,
  Phone,
  Building2,
  Loader2,
  Weight,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useTenant } from "@/lib/context/tenant-context"

// ─── Tipos ───────────────────────────────────────────────

interface Baja {
  id: string
  fecha: string
  motivo: string
  pesoVivoKg: number | null
  precioKg: number | null
  precioTotal: number | null
  dtaNumero: string | null
  facturaNumero: string | null
  observ: string | null
  animal: {
    id: string
    caravanaVisual: string | null
    cuig: string | null
    sexo: string
    raza: { nombre: string } | null
    categoria: { nombre: string } | null
  }
  cliente: { id: string; nombre: string } | null
}

interface Cliente {
  id: string
  nombre: string
  cuit: string | null
  tipo: string[]
  renspa: string | null
  contactoNombre: string | null
  contactoTel: string | null
  notas: string | null
  activo: boolean
  _count: { ventas: number }
}

interface Proveedor {
  id: string
  nombre: string
  cuit: string | null
  tipo: string[]
  contactoNombre: string | null
  contactoTel: string | null
  notas: string | null
  activo: boolean
  _count: { animalesComprados: number }
}

interface Documento {
  id: string
  numeroDta: string
  tipo: string
  fechaEmision: string
  fechaVencimiento: string
  fechaUso: string | null
  renspaOrigen: string
  nombreOrigen: string | null
  renspaDestino: string
  nombreDestino: string | null
  especie: string
  cantidadAnimales: number
  categorias: string | null
  motivo: string
  estado: string
  patenteCamion: string | null
  transportista: string | null
  observ: string | null
}

interface AnimalOption {
  id: string
  caravanaVisual: string | null
  cuig: string | null
  nombre: string
  category: string
}

// ─── Constantes ──────────────────────────────────────────

const MOTIVO_BADGE: Record<string, { label: string; className: string }> = {
  venta: { label: "Venta", className: "bg-green-600 hover:bg-green-700 text-white" },
  muerte: { label: "Muerte", className: "bg-red-600 hover:bg-red-700 text-white" },
  faena: { label: "Faena", className: "bg-orange-500 hover:bg-orange-600 text-white" },
  descarte: { label: "Descarte", className: "bg-gray-500 hover:bg-gray-600 text-white" },
  robo: { label: "Robo", className: "bg-red-800 hover:bg-red-900 text-white" },
  otro: { label: "Otro", className: "bg-gray-400 hover:bg-gray-500 text-white" },
}

const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  vigente: { label: "Vigente", className: "bg-green-600 hover:bg-green-700 text-white" },
  usado: { label: "Usado", className: "bg-blue-600 hover:bg-blue-700 text-white" },
  vencido: { label: "Vencido", className: "bg-red-600 hover:bg-red-700 text-white" },
  anulado: { label: "Anulado", className: "bg-gray-500 hover:bg-gray-600 text-white" },
}

const MOTIVO_DTA: Record<string, string> = {
  venta: "Venta",
  faena: "Faena",
  invernada: "Invernada",
  cambio_campo: "Cambio de campo",
}

const TIPOS_CLIENTE = ["invernador", "frigorifico", "consignatario", "feria", "particular"] as const
const TIPOS_PROVEEDOR = ["insumos", "hacienda", "servicios", "frigorifico", "consignatario"] as const

// ─── Helpers ─────────────────────────────────────────────

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "-"
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatWeight(kg: number | null): string {
  if (!kg) return "-"
  return `${kg.toLocaleString("es-AR")} kg`
}

// ─── Fetchers ────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Error ${res.status}`)
  }
  const json = await res.json()
  return json.success !== undefined ? json.data : json
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || "Error al guardar")
  return json.data ?? json
}

// ─── Default form states ─────────────────────────────────

const EMPTY_BAJA_FORM = {
  animalId: "",
  fecha: new Date().toISOString().split("T")[0],
  motivo: "venta",
  pesoVivoKg: "",
  precioKg: "",
  precioTotal: "",
  dtaNumero: "",
  facturaNumero: "",
  clienteId: "",
  observ: "",
}

const EMPTY_CLIENTE_FORM = {
  nombre: "",
  cuit: "",
  tipo: [] as string[],
  renspa: "",
  contactoNombre: "",
  contactoTel: "",
  notas: "",
}

const EMPTY_PROVEEDOR_FORM = {
  nombre: "",
  cuit: "",
  tipo: [] as string[],
  contactoNombre: "",
  contactoTel: "",
  notas: "",
}

const EMPTY_DOCUMENTO_FORM = {
  numeroDta: "",
  tipo: "DTe",
  fechaEmision: new Date().toISOString().split("T")[0],
  fechaVencimiento: "",
  renspaOrigen: "",
  nombreOrigen: "",
  renspaDestino: "",
  nombreDestino: "",
  especie: "bovino",
  cantidadAnimales: "",
  categorias: "",
  motivo: "venta",
  patenteCamion: "",
  transportista: "",
  observ: "",
}

// ─── Componente principal ────────────────────────────────

export default function VentasPage() {
  const { organizacionActiva, establecimientoActivo, isLoading: tenantLoading } = useTenant()
  const queryClient = useQueryClient()

  const orgId = organizacionActiva?.id ?? ""
  const estId = establecimientoActivo?.id ?? ""

  const [activeTab, setActiveTab] = useState("operaciones")
  const [filtroMotivo, setFiltroMotivo] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("")
  const [busquedaCliente, setBusquedaCliente] = useState("")
  const [busquedaProveedor, setBusquedaProveedor] = useState("")
  const [busquedaAnimal, setBusquedaAnimal] = useState("")

  const [bajaDialogOpen, setBajaDialogOpen] = useState(false)
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false)
  const [proveedorDialogOpen, setProveedorDialogOpen] = useState(false)
  const [documentoDialogOpen, setDocumentoDialogOpen] = useState(false)

  const [bajaForm, setBajaForm] = useState({ ...EMPTY_BAJA_FORM })
  const [clienteForm, setClienteForm] = useState({ ...EMPTY_CLIENTE_FORM })
  const [proveedorForm, setProveedorForm] = useState({ ...EMPTY_PROVEEDOR_FORM })
  const [documentoForm, setDocumentoForm] = useState({ ...EMPTY_DOCUMENTO_FORM })

  // ─── Queries ─────────────────────────────────────────

  const bajasQuery = useQuery({
    queryKey: ["ventas", "bajas", estId, filtroMotivo],
    queryFn: () => {
      const params = new URLSearchParams()
      if (estId) params.set("establecimientoId", estId)
      if (filtroMotivo) params.set("motivo", filtroMotivo)
      return fetchJSON<Baja[]>(`/api/ventas/bajas?${params}`)
    },
    enabled: !!orgId,
    staleTime: 30_000,
  })

  const clientesQuery = useQuery({
    queryKey: ["ventas", "clientes", orgId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (orgId) params.set("organizacionId", orgId)
      return fetchJSON<Cliente[]>(`/api/ventas/clientes?${params}`)
    },
    enabled: !!orgId,
    staleTime: 60_000,
  })

  const proveedoresQuery = useQuery({
    queryKey: ["ventas", "proveedores", orgId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (orgId) params.set("organizacionId", orgId)
      return fetchJSON<Proveedor[]>(`/api/ventas/proveedores?${params}`)
    },
    enabled: !!orgId,
    staleTime: 60_000,
  })

  const documentosQuery = useQuery({
    queryKey: ["ventas", "documentos", estId, filtroEstado],
    queryFn: () => {
      const params = new URLSearchParams()
      if (estId) params.set("establecimientoId", estId)
      if (filtroEstado) params.set("estado", filtroEstado)
      return fetchJSON<Documento[]>(`/api/ventas/documentos?${params}`)
    },
    enabled: !!orgId,
    staleTime: 30_000,
  })

  const animalesQuery = useQuery({
    queryKey: ["ganado", "bovinos-list", estId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "500" })
      if (estId) params.set("establecimientoId", estId)
      const res = await fetch(`/api/ganado/bovinos?${params}`)
      const data = await res.json()
      if (!data.success) return []
      return data.data.map((a: any) => ({
        id: a.id,
        caravanaVisual: a.caravanaVisual || a.tagNumber,
        cuig: a.cuig,
        nombre: a.nombre || a.caravanaVisual || "Sin ID",
        category: a.categoria?.nombre || a.category || "",
      })) as AnimalOption[]
    },
    enabled: !!orgId,
    staleTime: 60_000,
  })

  const bajas = bajasQuery.data ?? []
  const clientes = clientesQuery.data ?? []
  const proveedores = proveedoresQuery.data ?? []
  const documentos = documentosQuery.data ?? []
  const animales = animalesQuery.data ?? []

  // ─── Mutations ───────────────────────────────────────

  const bajaMutation = useMutation({
    mutationFn: (data: typeof bajaForm) => postJSON("/api/ventas/bajas", data),
    onSuccess: () => {
      toast.success("Baja registrada correctamente")
      setBajaDialogOpen(false)
      setBajaForm({ ...EMPTY_BAJA_FORM })
      queryClient.invalidateQueries({ queryKey: ["ventas", "bajas"] })
      queryClient.invalidateQueries({ queryKey: ["ganado"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const clienteMutation = useMutation({
    mutationFn: (data: typeof clienteForm) => postJSON("/api/ventas/clientes", data),
    onSuccess: () => {
      toast.success("Cliente creado correctamente")
      setClienteDialogOpen(false)
      setClienteForm({ ...EMPTY_CLIENTE_FORM })
      queryClient.invalidateQueries({ queryKey: ["ventas", "clientes"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const proveedorMutation = useMutation({
    mutationFn: (data: typeof proveedorForm) => postJSON("/api/ventas/proveedores", data),
    onSuccess: () => {
      toast.success("Proveedor creado correctamente")
      setProveedorDialogOpen(false)
      setProveedorForm({ ...EMPTY_PROVEEDOR_FORM })
      queryClient.invalidateQueries({ queryKey: ["ventas", "proveedores"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const documentoMutation = useMutation({
    mutationFn: (data: typeof documentoForm) => postJSON("/api/ventas/documentos", data),
    onSuccess: () => {
      toast.success("Documento creado correctamente")
      setDocumentoDialogOpen(false)
      setDocumentoForm({ ...EMPTY_DOCUMENTO_FORM })
      queryClient.invalidateQueries({ queryKey: ["ventas", "documentos"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const isSubmitting =
    bajaMutation.isPending ||
    clienteMutation.isPending ||
    proveedorMutation.isPending ||
    documentoMutation.isPending

  // ─── KPIs ────────────────────────────────────────────

  const kpis = useMemo(() => {
    const now = new Date()
    const mesActual = now.getMonth()
    const anioActual = now.getFullYear()

    const bajasDelMes = bajas.filter((b) => {
      const f = new Date(b.fecha)
      return f.getMonth() === mesActual && f.getFullYear() === anioActual
    })

    const ventasDelMes = bajasDelMes.filter((b) => b.motivo === "venta")

    return {
      totalVentas: ventasDelMes.length,
      kgTotales: ventasDelMes.reduce((s, b) => s + (b.pesoVivoKg || 0), 0),
      facturacion: ventasDelMes.reduce((s, b) => s + (b.precioTotal || 0), 0),
      dtasVigentes: documentos.filter((d) => d.estado === "vigente").length,
    }
  }, [bajas, documentos])

  // ─── Filtrado local ──────────────────────────────────

  const clientesFiltrados = useMemo(() => {
    if (!busquedaCliente) return clientes
    const q = busquedaCliente.toLowerCase()
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.cuit?.toLowerCase().includes(q) ||
        c.contactoNombre?.toLowerCase().includes(q)
    )
  }, [clientes, busquedaCliente])

  const proveedoresFiltrados = useMemo(() => {
    if (!busquedaProveedor) return proveedores
    const q = busquedaProveedor.toLowerCase()
    return proveedores.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.cuit?.toLowerCase().includes(q) ||
        p.contactoNombre?.toLowerCase().includes(q)
    )
  }, [proveedores, busquedaProveedor])

  const animalesFiltrados = useMemo(() => {
    if (!busquedaAnimal) return animales
    const q = busquedaAnimal.toLowerCase()
    return animales.filter(
      (a) =>
        a.caravanaVisual?.toLowerCase().includes(q) ||
        a.cuig?.toLowerCase().includes(q) ||
        a.nombre?.toLowerCase().includes(q)
    )
  }, [animales, busquedaAnimal])

  // ─── Auto-calcular precio total ──────────────────────

  useEffect(() => {
    const peso = parseFloat(bajaForm.pesoVivoKg)
    const pKg = parseFloat(bajaForm.precioKg)
    if (!isNaN(peso) && !isNaN(pKg) && peso > 0 && pKg > 0) {
      setBajaForm((prev) => ({ ...prev, precioTotal: (peso * pKg).toFixed(2) }))
    }
  }, [bajaForm.pesoVivoKg, bajaForm.precioKg])

  // ─── Submit handlers ─────────────────────────────────

  function handleSubmitBaja() {
    if (!bajaForm.animalId || !bajaForm.motivo) {
      toast.error("Seleccioná un animal y un motivo")
      return
    }
    bajaMutation.mutate(bajaForm)
  }

  function handleSubmitCliente() {
    if (!clienteForm.nombre) {
      toast.error("El nombre es requerido")
      return
    }
    clienteMutation.mutate(clienteForm)
  }

  function handleSubmitProveedor() {
    if (!proveedorForm.nombre) {
      toast.error("El nombre es requerido")
      return
    }
    proveedorMutation.mutate(proveedorForm)
  }

  function handleSubmitDocumento() {
    if (!documentoForm.numeroDta || !documentoForm.renspaOrigen || !documentoForm.renspaDestino) {
      toast.error("Número DTA, RENSPA origen y destino son requeridos")
      return
    }
    documentoMutation.mutate(documentoForm)
  }

  // ─── Toggle tipo arrays ──────────────────────────────

  function toggleClienteTipo(tipo: string) {
    setClienteForm((prev) => ({
      ...prev,
      tipo: prev.tipo.includes(tipo) ? prev.tipo.filter((t) => t !== tipo) : [...prev.tipo, tipo],
    }))
  }

  function toggleProveedorTipo(tipo: string) {
    setProveedorForm((prev) => ({
      ...prev,
      tipo: prev.tipo.includes(tipo) ? prev.tipo.filter((t) => t !== tipo) : [...prev.tipo, tipo],
    }))
  }

  // ─── Loading guard ───────────────────────────────────

  if (tenantLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!organizacionActiva) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Sin organización activa</h2>
        <p className="text-muted-foreground max-w-md">
          Seleccioná una organización desde el menú superior para poder ver las ventas y compras.
        </p>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShoppingCart className="h-7 w-7 md:h-8 md:w-8 text-primary" />
            Ventas y Compras
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestión de ventas, clientes, proveedores y documentos de tránsito
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setBajaDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Registrar venta
          </Button>
          <Button variant="outline" onClick={() => setClienteDialogOpen(true)}>
            <Users className="h-4 w-4 mr-2" />
            Nuevo cliente
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendidos este mes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalVentas}</div>
            <p className="text-xs text-muted-foreground">operaciones de venta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kg totales</CardTitle>
            <Weight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatWeight(kpis.kgTotales)}</div>
            <p className="text-xs text-muted-foreground">peso vendido este mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facturación total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.facturacion)}</div>
            <p className="text-xs text-muted-foreground">ingresos del mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DTAs vigentes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.dtasVigentes}</div>
            <p className="text-xs text-muted-foreground">documentos activos</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="operaciones" className="gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Operaciones</span>
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-1.5">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="proveedores" className="gap-1.5">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Proveedores</span>
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Operaciones ───────────────────────── */}
        <TabsContent value="operaciones" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 items-center">
              <Select
                value={filtroMotivo || "todos"}
                onValueChange={(v) => setFiltroMotivo(v === "todos" ? "" : v)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filtrar motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los motivos</SelectItem>
                  <SelectItem value="venta">Venta</SelectItem>
                  <SelectItem value="muerte">Muerte</SelectItem>
                  <SelectItem value="faena">Faena</SelectItem>
                  <SelectItem value="descarte">Descarte</SelectItem>
                  <SelectItem value="robo">Robo</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
              <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {bajas.length} registro{bajas.length !== 1 ? "s" : ""}
              </span>
            </div>
            <Button onClick={() => setBajaDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Registrar baja
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Animal</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Destino / Cliente</TableHead>
                      <TableHead className="text-right">Peso venta</TableHead>
                      <TableHead className="text-right">$/kg</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>DTA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bajasQuery.isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 8 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : bajasQuery.isError ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            <span>Error al cargar: {bajasQuery.error.message}</span>
                            <Button size="sm" variant="outline" onClick={() => bajasQuery.refetch()}>
                              Reintentar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : bajas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No hay registros de bajas
                        </TableCell>
                      </TableRow>
                    ) : (
                      bajas.map((baja) => {
                        const badge = MOTIVO_BADGE[baja.motivo] ?? MOTIVO_BADGE.otro
                        return (
                          <TableRow key={baja.id}>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(baja.fecha)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {baja.animal.caravanaVisual || baja.animal.cuig || "S/ID"}
                            </TableCell>
                            <TableCell>
                              <Badge className={badge.className}>{badge.label}</Badge>
                            </TableCell>
                            <TableCell>{baja.cliente?.nombre || "-"}</TableCell>
                            <TableCell className="text-right">
                              {formatWeight(baja.pesoVivoKg)}
                            </TableCell>
                            <TableCell className="text-right">
                              {baja.precioKg ? formatCurrency(baja.precioKg) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(baja.precioTotal)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {baja.dtaNumero || "-"}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Clientes ──────────────────────────── */}
        <TabsContent value="clientes" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, CUIT..."
                className="pl-9"
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
              />
            </div>
            <Button onClick={() => setClienteDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo cliente
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>CUIT</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>RENSPA</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead className="text-right">Ventas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesQuery.isLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 7 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : clientesQuery.isError ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            <span>Error al cargar clientes</span>
                            <Button size="sm" variant="outline" onClick={() => clientesQuery.refetch()}>
                              Reintentar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : clientesFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          {busquedaCliente ? "Sin resultados para la búsqueda" : "No hay clientes registrados"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientesFiltrados.map((cliente) => (
                        <TableRow key={cliente.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                              {cliente.nombre}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {cliente.cuit || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {cliente.tipo.map((t) => (
                                <Badge key={t} variant="outline" className="text-xs capitalize">
                                  {t}
                                </Badge>
                              ))}
                              {cliente.tipo.length === 0 && (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {cliente.renspa || "-"}
                          </TableCell>
                          <TableCell>
                            {cliente.contactoNombre && (
                              <div className="text-sm">{cliente.contactoNombre}</div>
                            )}
                            {cliente.contactoTel && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {cliente.contactoTel}
                              </div>
                            )}
                            {!cliente.contactoNombre && !cliente.contactoTel && "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={cliente.activo ? "default" : "secondary"}
                              className={
                                cliente.activo
                                  ? "bg-green-100 text-green-800 hover:bg-green-200"
                                  : "bg-gray-100 text-gray-600"
                              }
                            >
                              {cliente.activo ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {cliente._count.ventas}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Proveedores ───────────────────────── */}
        <TabsContent value="proveedores" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, CUIT..."
                className="pl-9"
                value={busquedaProveedor}
                onChange={(e) => setBusquedaProveedor(e.target.value)}
              />
            </div>
            <Button onClick={() => setProveedorDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo proveedor
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>CUIT</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead className="text-right">Animales</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proveedoresQuery.isLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : proveedoresQuery.isError ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            <span>Error al cargar proveedores</span>
                            <Button size="sm" variant="outline" onClick={() => proveedoresQuery.refetch()}>
                              Reintentar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : proveedoresFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {busquedaProveedor ? "Sin resultados para la búsqueda" : "No hay proveedores registrados"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      proveedoresFiltrados.map((prov) => (
                        <TableRow key={prov.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                              {prov.nombre}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{prov.cuit || "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {prov.tipo.map((t) => (
                                <Badge key={t} variant="outline" className="text-xs capitalize">
                                  {t}
                                </Badge>
                              ))}
                              {prov.tipo.length === 0 && (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {prov.contactoNombre && (
                              <div className="text-sm">{prov.contactoNombre}</div>
                            )}
                            {prov.contactoTel && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {prov.contactoTel}
                              </div>
                            )}
                            {!prov.contactoNombre && !prov.contactoTel && "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={prov.activo ? "default" : "secondary"}
                              className={
                                prov.activo
                                  ? "bg-green-100 text-green-800 hover:bg-green-200"
                                  : "bg-gray-100 text-gray-600"
                              }
                            >
                              {prov.activo ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {prov._count.animalesComprados}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Documentos ────────────────────────── */}
        <TabsContent value="documentos" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 items-center">
              <Select
                value={filtroEstado || "todos"}
                onValueChange={(v) => setFiltroEstado(v === "todos" ? "" : v)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filtrar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="vigente">Vigente</SelectItem>
                  <SelectItem value="usado">Usado</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="anulado">Anulado</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {documentos.length} documento{documentos.length !== 1 ? "s" : ""}
              </span>
            </div>
            <Button onClick={() => setDocumentoDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear DTA/DTe
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº DTA</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Fecha salida</TableHead>
                      <TableHead>RENSPA origen</TableHead>
                      <TableHead>RENSPA destino</TableHead>
                      <TableHead className="text-right">Animales</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentosQuery.isLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 8 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : documentosQuery.isError ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            <span>Error al cargar documentos</span>
                            <Button size="sm" variant="outline" onClick={() => documentosQuery.refetch()}>
                              Reintentar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : documentos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No hay documentos registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      documentos.map((doc) => {
                        const estadoBadge = ESTADO_BADGE[doc.estado] ?? ESTADO_BADGE.anulado
                        return (
                          <TableRow key={doc.id}>
                            <TableCell className="font-mono font-medium text-sm">
                              {doc.numeroDta}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{doc.tipo}</Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(doc.fechaEmision)}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <span className="font-medium">{doc.nombreOrigen || doc.renspaOrigen}</span>
                                {doc.nombreOrigen && (
                                  <div className="text-xs text-muted-foreground font-mono">{doc.renspaOrigen}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <span className="font-medium">{doc.nombreDestino || doc.renspaDestino}</span>
                                {doc.nombreDestino && (
                                  <div className="text-xs text-muted-foreground font-mono">{doc.renspaDestino}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {doc.cantidadAnimales}
                            </TableCell>
                            <TableCell>{MOTIVO_DTA[doc.motivo] || doc.motivo}</TableCell>
                            <TableCell>
                              <Badge className={estadoBadge.className}>{estadoBadge.label}</Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Dialog: Registrar baja / venta ───────────── */}
      <Dialog open={bajaDialogOpen} onOpenChange={setBajaDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar baja / venta</DialogTitle>
            <DialogDescription>Registrá la salida de un animal del rodeo</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Animal *</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por caravana..."
                    className="pl-9"
                    value={busquedaAnimal}
                    onChange={(e) => setBusquedaAnimal(e.target.value)}
                  />
                </div>
                <Select
                  value={bajaForm.animalId}
                  onValueChange={(v) => setBajaForm((prev) => ({ ...prev, animalId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar animal" />
                  </SelectTrigger>
                  <SelectContent>
                    {animalesFiltrados.length === 0 && (
                      <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                        Sin resultados
                      </div>
                    )}
                    {animalesFiltrados.slice(0, 50).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.caravanaVisual || a.cuig || a.nombre}
                        {a.category ? ` (${a.category})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={bajaForm.fecha}
                  onChange={(e) => setBajaForm((prev) => ({ ...prev, fecha: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Motivo *</Label>
                <Select
                  value={bajaForm.motivo}
                  onValueChange={(v) => setBajaForm((prev) => ({ ...prev, motivo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venta">Venta</SelectItem>
                    <SelectItem value="descarte">Descarte</SelectItem>
                    <SelectItem value="muerte">Muerte</SelectItem>
                    <SelectItem value="robo">Robo</SelectItem>
                    <SelectItem value="faena">Faena</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Cliente</Label>
              <Select
                value={bajaForm.clienteId || "ninguno"}
                onValueChange={(v) =>
                  setBajaForm((prev) => ({ ...prev, clienteId: v === "ninguno" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">Sin cliente</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Peso venta (kg)</Label>
                <Input
                  type="number"
                  placeholder="450"
                  value={bajaForm.pesoVivoKg}
                  onChange={(e) =>
                    setBajaForm((prev) => ({ ...prev, pesoVivoKg: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Precio/kg ($)</Label>
                <Input
                  type="number"
                  placeholder="2500"
                  value={bajaForm.precioKg}
                  onChange={(e) =>
                    setBajaForm((prev) => ({ ...prev, precioKg: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Total ($)</Label>
                <Input
                  type="number"
                  placeholder="Auto"
                  value={bajaForm.precioTotal}
                  onChange={(e) =>
                    setBajaForm((prev) => ({ ...prev, precioTotal: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Nº DTA</Label>
                <Input
                  placeholder="DTA-001234"
                  value={bajaForm.dtaNumero}
                  onChange={(e) =>
                    setBajaForm((prev) => ({ ...prev, dtaNumero: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Nº Factura</Label>
                <Input
                  placeholder="0001-00001234"
                  value={bajaForm.facturaNumero}
                  onChange={(e) =>
                    setBajaForm((prev) => ({ ...prev, facturaNumero: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Observaciones</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={bajaForm.observ}
                onChange={(e) => setBajaForm((prev) => ({ ...prev, observ: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBajaDialogOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitBaja} disabled={isSubmitting}>
              {bajaMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                "Registrar baja"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Nuevo cliente ────────────────────── */}
      <Dialog open={clienteDialogOpen} onOpenChange={setClienteDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
            <DialogDescription>Agregá un nuevo comprador o consignatario</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre / Razón social *</Label>
              <Input
                placeholder="Ej: Cabaña Don Juan"
                value={clienteForm.nombre}
                onChange={(e) => setClienteForm((prev) => ({ ...prev, nombre: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>CUIT</Label>
                <Input
                  placeholder="XX-XXXXXXXX-X"
                  value={clienteForm.cuit}
                  onChange={(e) => setClienteForm((prev) => ({ ...prev, cuit: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>RENSPA</Label>
                <Input
                  placeholder="01.001.0.00001/00"
                  value={clienteForm.renspa}
                  onChange={(e) => setClienteForm((prev) => ({ ...prev, renspa: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Tipo de cliente</Label>
              <div className="flex flex-wrap gap-2">
                {TIPOS_CLIENTE.map((t) => (
                  <Badge
                    key={t}
                    variant={clienteForm.tipo.includes(t) ? "default" : "outline"}
                    className="cursor-pointer capitalize"
                    onClick={() => toggleClienteTipo(t)}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Nombre de contacto</Label>
                <Input
                  placeholder="Juan Pérez"
                  value={clienteForm.contactoNombre}
                  onChange={(e) =>
                    setClienteForm((prev) => ({ ...prev, contactoNombre: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input
                  placeholder="+54 11 1234-5678"
                  value={clienteForm.contactoTel}
                  onChange={(e) =>
                    setClienteForm((prev) => ({ ...prev, contactoTel: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Información adicional..."
                value={clienteForm.notas}
                onChange={(e) => setClienteForm((prev) => ({ ...prev, notas: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClienteDialogOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitCliente} disabled={isSubmitting}>
              {clienteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear cliente"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Nuevo proveedor ──────────────────── */}
      <Dialog open={proveedorDialogOpen} onOpenChange={setProveedorDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
            <DialogDescription>Agregá un proveedor de hacienda, insumos o servicios</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre / Razón social *</Label>
              <Input
                placeholder="Ej: Veterinaria del Campo"
                value={proveedorForm.nombre}
                onChange={(e) => setProveedorForm((prev) => ({ ...prev, nombre: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label>CUIT</Label>
              <Input
                placeholder="XX-XXXXXXXX-X"
                value={proveedorForm.cuit}
                onChange={(e) => setProveedorForm((prev) => ({ ...prev, cuit: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label>Tipo de proveedor</Label>
              <div className="flex flex-wrap gap-2">
                {TIPOS_PROVEEDOR.map((t) => (
                  <Badge
                    key={t}
                    variant={proveedorForm.tipo.includes(t) ? "default" : "outline"}
                    className="cursor-pointer capitalize"
                    onClick={() => toggleProveedorTipo(t)}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Nombre de contacto</Label>
                <Input
                  placeholder="Juan Pérez"
                  value={proveedorForm.contactoNombre}
                  onChange={(e) =>
                    setProveedorForm((prev) => ({ ...prev, contactoNombre: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input
                  placeholder="+54 11 1234-5678"
                  value={proveedorForm.contactoTel}
                  onChange={(e) =>
                    setProveedorForm((prev) => ({ ...prev, contactoTel: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Información adicional..."
                value={proveedorForm.notas}
                onChange={(e) => setProveedorForm((prev) => ({ ...prev, notas: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProveedorDialogOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitProveedor} disabled={isSubmitting}>
              {proveedorMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear proveedor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Nuevo documento DTA/DTe ──────────── */}
      <Dialog open={documentoDialogOpen} onOpenChange={setDocumentoDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo documento de tránsito</DialogTitle>
            <DialogDescription>Registrá un DTA o DTe para movimiento de hacienda</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Número DTA *</Label>
                <Input
                  placeholder="DTA-001234"
                  value={documentoForm.numeroDta}
                  onChange={(e) =>
                    setDocumentoForm((prev) => ({ ...prev, numeroDta: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select
                  value={documentoForm.tipo}
                  onValueChange={(v) => setDocumentoForm((prev) => ({ ...prev, tipo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DTA">DTA</SelectItem>
                    <SelectItem value="DTe">DTe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Motivo</Label>
                <Select
                  value={documentoForm.motivo}
                  onValueChange={(v) => setDocumentoForm((prev) => ({ ...prev, motivo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venta">Venta</SelectItem>
                    <SelectItem value="faena">Faena</SelectItem>
                    <SelectItem value="invernada">Invernada</SelectItem>
                    <SelectItem value="cambio_campo">Cambio de campo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Fecha de emisión</Label>
                <Input
                  type="date"
                  value={documentoForm.fechaEmision}
                  onChange={(e) =>
                    setDocumentoForm((prev) => ({ ...prev, fechaEmision: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Fecha de vencimiento *</Label>
                <Input
                  type="date"
                  value={documentoForm.fechaVencimiento}
                  onChange={(e) =>
                    setDocumentoForm((prev) => ({ ...prev, fechaVencimiento: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Origen</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>RENSPA origen *</Label>
                  <Input
                    placeholder="01.001.0.00001/00"
                    value={documentoForm.renspaOrigen}
                    onChange={(e) =>
                      setDocumentoForm((prev) => ({ ...prev, renspaOrigen: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Nombre origen</Label>
                  <Input
                    placeholder="Estancia La Pampa"
                    value={documentoForm.nombreOrigen}
                    onChange={(e) =>
                      setDocumentoForm((prev) => ({ ...prev, nombreOrigen: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Destino</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>RENSPA destino *</Label>
                  <Input
                    placeholder="01.002.0.00002/00"
                    value={documentoForm.renspaDestino}
                    onChange={(e) =>
                      setDocumentoForm((prev) => ({ ...prev, renspaDestino: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Nombre destino</Label>
                  <Input
                    placeholder="Frigorífico Sur"
                    value={documentoForm.nombreDestino}
                    onChange={(e) =>
                      setDocumentoForm((prev) => ({ ...prev, nombreDestino: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Hacienda</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Especie</Label>
                  <Select
                    value={documentoForm.especie}
                    onValueChange={(v) => setDocumentoForm((prev) => ({ ...prev, especie: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bovino">Bovino</SelectItem>
                      <SelectItem value="ovino">Ovino</SelectItem>
                      <SelectItem value="equino">Equino</SelectItem>
                      <SelectItem value="caprino">Caprino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Cantidad *</Label>
                  <Input
                    type="number"
                    placeholder="25"
                    value={documentoForm.cantidadAnimales}
                    onChange={(e) =>
                      setDocumentoForm((prev) => ({ ...prev, cantidadAnimales: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Categorías</Label>
                  <Input
                    placeholder="Novillos, vacas"
                    value={documentoForm.categorias}
                    onChange={(e) =>
                      setDocumentoForm((prev) => ({ ...prev, categorias: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Transporte</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Patente camión</Label>
                  <Input
                    placeholder="AB123CD"
                    value={documentoForm.patenteCamion}
                    onChange={(e) =>
                      setDocumentoForm((prev) => ({ ...prev, patenteCamion: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Transportista</Label>
                  <Input
                    placeholder="Transportes Pampa SRL"
                    value={documentoForm.transportista}
                    onChange={(e) =>
                      setDocumentoForm((prev) => ({ ...prev, transportista: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Observaciones</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={documentoForm.observ}
                onChange={(e) =>
                  setDocumentoForm((prev) => ({ ...prev, observ: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentoDialogOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitDocumento} disabled={isSubmitting}>
              {documentoMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear documento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
