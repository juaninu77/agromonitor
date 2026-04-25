"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
import {
  ShoppingCart,
  Plus,
  DollarSign,
  FileText,
  Users,
  Truck,
  TrendingUp,
  RefreshCw,
  Search,
  ArrowDownUp,
  Phone,
  Building2,
} from "lucide-react"
import { toast } from "sonner"

// ============================================
// TIPOS
// ============================================

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
  cliente: {
    id: string
    nombre: string
  } | null
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

// ============================================
// HELPERS
// ============================================

const MOTIVO_BADGE: Record<string, { label: string; variant: string; className: string }> = {
  venta: { label: "Venta", variant: "default", className: "bg-green-600 hover:bg-green-700" },
  muerte: { label: "Muerte", variant: "destructive", className: "bg-red-600 hover:bg-red-700" },
  faena: { label: "Faena", variant: "default", className: "bg-orange-500 hover:bg-orange-600" },
  descarte: { label: "Descarte", variant: "secondary", className: "bg-gray-500 hover:bg-gray-600 text-white" },
  robo: { label: "Robo", variant: "destructive", className: "bg-red-800 hover:bg-red-900" },
  otro: { label: "Otro", variant: "outline", className: "bg-gray-400 hover:bg-gray-500 text-white" },
}

const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  vigente: { label: "Vigente", className: "bg-green-600 hover:bg-green-700" },
  usado: { label: "Usado", className: "bg-blue-600 hover:bg-blue-700" },
  vencido: { label: "Vencido", className: "bg-red-600 hover:bg-red-700" },
  anulado: { label: "Anulado", className: "bg-gray-500 hover:bg-gray-600 text-white" },
}

const MOTIVO_DTA: Record<string, string> = {
  venta: "Venta",
  faena: "Faena",
  invernada: "Invernada",
  cambio_campo: "Cambio de campo",
}

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

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function VentasPage() {
  const [activeTab, setActiveTab] = useState("ventas")

  // Data
  const [bajas, setBajas] = useState<Baja[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [animales, setAnimales] = useState<AnimalOption[]>([])

  // Loading
  const [loadingBajas, setLoadingBajas] = useState(true)
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [loadingProveedores, setLoadingProveedores] = useState(true)
  const [loadingDocumentos, setLoadingDocumentos] = useState(true)

  // Filters
  const [filtroMotivo, setFiltroMotivo] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("")
  const [busquedaCliente, setBusquedaCliente] = useState("")
  const [busquedaProveedor, setBusquedaProveedor] = useState("")

  // Dialogs
  const [bajaDialogOpen, setBajaDialogOpen] = useState(false)
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false)
  const [proveedorDialogOpen, setProveedorDialogOpen] = useState(false)
  const [documentoDialogOpen, setDocumentoDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Forms
  const [bajaForm, setBajaForm] = useState({
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
  })

  const [clienteForm, setClienteForm] = useState({
    nombre: "",
    cuit: "",
    tipo: [] as string[],
    renspa: "",
    contactoNombre: "",
    contactoTel: "",
    notas: "",
  })

  const [proveedorForm, setProveedorForm] = useState({
    nombre: "",
    cuit: "",
    tipo: [] as string[],
    contactoNombre: "",
    contactoTel: "",
    notas: "",
  })

  const [documentoForm, setDocumentoForm] = useState({
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
  })

  // ============================================
  // FETCHERS
  // ============================================

  const fetchBajas = useCallback(async () => {
    setLoadingBajas(true)
    try {
      const params = new URLSearchParams()
      if (filtroMotivo) params.set("motivo", filtroMotivo)
      const res = await fetch(`/api/ventas/bajas?${params}`)
      const data = await res.json()
      if (data.success) setBajas(data.data)
    } catch {
      toast.error("Error al cargar ventas/bajas")
    } finally {
      setLoadingBajas(false)
    }
  }, [filtroMotivo])

  const fetchClientes = useCallback(async () => {
    setLoadingClientes(true)
    try {
      const res = await fetch("/api/ventas/clientes")
      const data = await res.json()
      if (data.success) setClientes(data.data)
    } catch {
      toast.error("Error al cargar clientes")
    } finally {
      setLoadingClientes(false)
    }
  }, [])

  const fetchProveedores = useCallback(async () => {
    setLoadingProveedores(true)
    try {
      const res = await fetch("/api/ventas/proveedores")
      const data = await res.json()
      if (data.success) setProveedores(data.data)
    } catch {
      toast.error("Error al cargar proveedores")
    } finally {
      setLoadingProveedores(false)
    }
  }, [])

  const fetchDocumentos = useCallback(async () => {
    setLoadingDocumentos(true)
    try {
      const params = new URLSearchParams()
      if (filtroEstado) params.set("estado", filtroEstado)
      const res = await fetch(`/api/ventas/documentos?${params}`)
      const data = await res.json()
      if (data.success) setDocumentos(data.data)
    } catch {
      toast.error("Error al cargar documentos")
    } finally {
      setLoadingDocumentos(false)
    }
  }, [filtroEstado])

  const fetchAnimales = useCallback(async () => {
    try {
      const res = await fetch("/api/ganado/bovinos?limit=500")
      const data = await res.json()
      if (data.success) {
        setAnimales(
          data.data.map((a: any) => ({
            id: a.id,
            caravanaVisual: a.caravanaVisual || a.tagNumber,
            cuig: a.cuig,
            nombre: a.nombre || a.caravanaVisual || "Sin ID",
            category: a.category || "",
          }))
        )
      }
    } catch {
      /* silenciar error */
    }
  }, [])

  useEffect(() => {
    fetchBajas()
    fetchClientes()
    fetchProveedores()
    fetchDocumentos()
    fetchAnimales()
  }, [fetchBajas, fetchClientes, fetchProveedores, fetchDocumentos, fetchAnimales])

  // ============================================
  // KPIs
  // ============================================

  const kpis = useMemo(() => {
    const now = new Date()
    const mesActual = now.getMonth()
    const anioActual = now.getFullYear()

    const bajasDelMes = bajas.filter((b) => {
      const f = new Date(b.fecha)
      return f.getMonth() === mesActual && f.getFullYear() === anioActual
    })

    const ventasDelMes = bajasDelMes.filter((b) => b.motivo === "venta")

    const ingresosTotal = ventasDelMes.reduce(
      (sum, b) => sum + (b.precioTotal || 0),
      0
    )

    const dtasVigentes = documentos.filter((d) => d.estado === "vigente").length

    return {
      totalVentas: ventasDelMes.length,
      ingresos: ingresosTotal,
      dtasVigentes,
      animalesVendidos: bajasDelMes.length,
    }
  }, [bajas, documentos])

  // ============================================
  // FILTERED DATA
  // ============================================

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

  // ============================================
  // AUTO-CALCULAR PRECIO TOTAL
  // ============================================

  useEffect(() => {
    const peso = parseFloat(bajaForm.pesoVivoKg)
    const pKg = parseFloat(bajaForm.precioKg)
    if (!isNaN(peso) && !isNaN(pKg) && peso > 0 && pKg > 0) {
      setBajaForm((prev) => ({
        ...prev,
        precioTotal: (peso * pKg).toFixed(2),
      }))
    }
  }, [bajaForm.pesoVivoKg, bajaForm.precioKg])

  // ============================================
  // SUBMIT HANDLERS
  // ============================================

  async function handleSubmitBaja() {
    if (!bajaForm.animalId || !bajaForm.motivo) {
      toast.error("Seleccioná un animal y un motivo")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/ventas/bajas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bajaForm),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al registrar baja")
        return
      }
      toast.success("Baja registrada correctamente")
      setBajaDialogOpen(false)
      resetBajaForm()
      fetchBajas()
      fetchAnimales()
    } catch {
      toast.error("Error de conexión")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmitCliente() {
    if (!clienteForm.nombre) {
      toast.error("El nombre es requerido")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/ventas/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clienteForm),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al crear cliente")
        return
      }
      toast.success("Cliente creado correctamente")
      setClienteDialogOpen(false)
      resetClienteForm()
      fetchClientes()
    } catch {
      toast.error("Error de conexión")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmitProveedor() {
    if (!proveedorForm.nombre) {
      toast.error("El nombre es requerido")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/ventas/proveedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proveedorForm),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al crear proveedor")
        return
      }
      toast.success("Proveedor creado correctamente")
      setProveedorDialogOpen(false)
      resetProveedorForm()
      fetchProveedores()
    } catch {
      toast.error("Error de conexión")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmitDocumento() {
    if (
      !documentoForm.numeroDta ||
      !documentoForm.renspaOrigen ||
      !documentoForm.renspaDestino
    ) {
      toast.error("Número DTA, RENSPA origen y destino son requeridos")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/ventas/documentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(documentoForm),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al crear documento")
        return
      }
      toast.success("Documento creado correctamente")
      setDocumentoDialogOpen(false)
      resetDocumentoForm()
      fetchDocumentos()
    } catch {
      toast.error("Error de conexión")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ============================================
  // RESET FORMS
  // ============================================

  function resetBajaForm() {
    setBajaForm({
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
    })
  }

  function resetClienteForm() {
    setClienteForm({
      nombre: "",
      cuit: "",
      tipo: [],
      renspa: "",
      contactoNombre: "",
      contactoTel: "",
      notas: "",
    })
  }

  function resetProveedorForm() {
    setProveedorForm({
      nombre: "",
      cuit: "",
      tipo: [],
      contactoNombre: "",
      contactoTel: "",
      notas: "",
    })
  }

  function resetDocumentoForm() {
    setDocumentoForm({
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
    })
  }

  // ============================================
  // TOGGLE TIPO ARRAY (clientes y proveedores)
  // ============================================

  function toggleClienteTipo(tipo: string) {
    setClienteForm((prev) => ({
      ...prev,
      tipo: prev.tipo.includes(tipo)
        ? prev.tipo.filter((t) => t !== tipo)
        : [...prev.tipo, tipo],
    }))
  }

  function toggleProveedorTipo(tipo: string) {
    setProveedorForm((prev) => ({
      ...prev,
      tipo: prev.tipo.includes(tipo)
        ? prev.tipo.filter((t) => t !== tipo)
        : [...prev.tipo, tipo],
    }))
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-primary" />
            Ventas y Compras
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestión de ventas, clientes, proveedores y documentos de tránsito
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchBajas()
            fetchClientes()
            fetchProveedores()
            fetchDocumentos()
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas del mes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalVentas}</div>
            <p className="text-xs text-muted-foreground">operaciones de venta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(kpis.ingresos)}
            </div>
            <p className="text-xs text-muted-foreground">del mes actual</p>
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Animales dados de baja
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.animalesVendidos}</div>
            <p className="text-xs text-muted-foreground">en el mes actual</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ventas" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Ventas</span>
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="proveedores" className="gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Proveedores</span>
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
        </TabsList>

        {/* ============================== */}
        {/* TAB: VENTAS / BAJAS           */}
        {/* ============================== */}
        <TabsContent value="ventas" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 items-center">
              <Select value={filtroMotivo} onValueChange={(v) => setFiltroMotivo(v === "todos" ? "" : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filtrar motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
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
                      <TableHead className="text-right">Peso</TableHead>
                      <TableHead className="text-right">$/kg</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>DTA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingBajas ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                          Cargando...
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
                        const badge = MOTIVO_BADGE[baja.motivo] || MOTIVO_BADGE.otro
                        return (
                          <TableRow key={baja.id}>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(baja.fecha)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {baja.animal.caravanaVisual || baja.animal.cuig || "S/ID"}
                            </TableCell>
                            <TableCell>
                              <Badge className={badge.className}>
                                {badge.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatWeight(baja.pesoVivoKg)}
                            </TableCell>
                            <TableCell className="text-right">
                              {baja.precioKg ? formatCurrency(baja.precioKg) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(baja.precioTotal)}
                            </TableCell>
                            <TableCell>
                              {baja.cliente?.nombre || "-"}
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

        {/* ============================== */}
        {/* TAB: CLIENTES                  */}
        {/* ============================== */}
        <TabsContent value="clientes" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                className="pl-9"
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
              />
            </div>
            <Button onClick={() => setClienteDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar cliente
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
                      <TableHead className="text-right">Ventas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingClientes ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                          Cargando...
                        </TableCell>
                      </TableRow>
                    ) : clientesFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No hay clientes registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientesFiltrados.map((cliente) => (
                        <TableRow key={cliente.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {cliente.nombre}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {cliente.cuit || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {cliente.tipo.map((t) => (
                                <Badge key={t} variant="outline" className="text-xs">
                                  {t}
                                </Badge>
                              ))}
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

        {/* ============================== */}
        {/* TAB: PROVEEDORES               */}
        {/* ============================== */}
        <TabsContent value="proveedores" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar proveedor..."
                className="pl-9"
                value={busquedaProveedor}
                onChange={(e) => setBusquedaProveedor(e.target.value)}
              />
            </div>
            <Button onClick={() => setProveedorDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar proveedor
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
                      <TableHead className="text-right">Animales</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingProveedores ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                          Cargando...
                        </TableCell>
                      </TableRow>
                    ) : proveedoresFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No hay proveedores registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      proveedoresFiltrados.map((prov) => (
                        <TableRow key={prov.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-muted-foreground" />
                              {prov.nombre}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {prov.cuit || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {prov.tipo.map((t) => (
                                <Badge key={t} variant="outline" className="text-xs">
                                  {t}
                                </Badge>
                              ))}
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

        {/* ============================== */}
        {/* TAB: DOCUMENTOS DE TRÁNSITO    */}
        {/* ============================== */}
        <TabsContent value="documentos" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 items-center">
              <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v === "todos" ? "" : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filtrar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
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
              Crear DTA
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Emisión</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Origen → Destino</TableHead>
                      <TableHead>Especie</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingDocumentos ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                          Cargando...
                        </TableCell>
                      </TableRow>
                    ) : documentos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No hay documentos registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      documentos.map((doc) => {
                        const estadoBadge = ESTADO_BADGE[doc.estado] || ESTADO_BADGE.anulado
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
                            <TableCell className="whitespace-nowrap">
                              {formatDate(doc.fechaVencimiento)}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <span className="font-medium">
                                  {doc.nombreOrigen || doc.renspaOrigen}
                                </span>
                                <span className="text-muted-foreground mx-1">→</span>
                                <span className="font-medium">
                                  {doc.nombreDestino || doc.renspaDestino}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="capitalize">{doc.especie}</TableCell>
                            <TableCell className="text-right font-medium">
                              {doc.cantidadAnimales}
                            </TableCell>
                            <TableCell>
                              {MOTIVO_DTA[doc.motivo] || doc.motivo}
                            </TableCell>
                            <TableCell>
                              <Badge className={estadoBadge.className}>
                                {estadoBadge.label}
                              </Badge>
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

      {/* ============================== */}
      {/* DIALOG: REGISTRAR BAJA / VENTA */}
      {/* ============================== */}
      <Dialog open={bajaDialogOpen} onOpenChange={setBajaDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar baja / venta</DialogTitle>
            <DialogDescription>
              Registrá la salida de un animal del rodeo
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Animal *</Label>
              <Select
                value={bajaForm.animalId}
                onValueChange={(v) =>
                  setBajaForm((prev) => ({ ...prev, animalId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar animal" />
                </SelectTrigger>
                <SelectContent>
                  {animales.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.caravanaVisual || a.cuig || a.nombre}
                      {a.category ? ` (${a.category})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={bajaForm.fecha}
                  onChange={(e) =>
                    setBajaForm((prev) => ({ ...prev, fecha: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Motivo *</Label>
                <Select
                  value={bajaForm.motivo}
                  onValueChange={(v) =>
                    setBajaForm((prev) => ({ ...prev, motivo: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venta">Venta</SelectItem>
                    <SelectItem value="muerte">Muerte</SelectItem>
                    <SelectItem value="faena">Faena</SelectItem>
                    <SelectItem value="descarte">Descarte</SelectItem>
                    <SelectItem value="robo">Robo</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Peso vivo (kg)</Label>
                <Input
                  type="number"
                  placeholder="450"
                  value={bajaForm.pesoVivoKg}
                  onChange={(e) =>
                    setBajaForm((prev) => ({
                      ...prev,
                      pesoVivoKg: e.target.value,
                    }))
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
                    setBajaForm((prev) => ({
                      ...prev,
                      precioKg: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Precio total ($)</Label>
                <Input
                  type="number"
                  placeholder="1125000"
                  value={bajaForm.precioTotal}
                  onChange={(e) =>
                    setBajaForm((prev) => ({
                      ...prev,
                      precioTotal: e.target.value,
                    }))
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
                    setBajaForm((prev) => ({
                      ...prev,
                      dtaNumero: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Nº Factura</Label>
                <Input
                  placeholder="0001-00001234"
                  value={bajaForm.facturaNumero}
                  onChange={(e) =>
                    setBajaForm((prev) => ({
                      ...prev,
                      facturaNumero: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Cliente</Label>
              <Select
                value={bajaForm.clienteId}
                onValueChange={(v) =>
                  setBajaForm((prev) => ({
                    ...prev,
                    clienteId: v === "ninguno" ? "" : v,
                  }))
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

            <div className="grid gap-2">
              <Label>Observaciones</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={bajaForm.observ}
                onChange={(e) =>
                  setBajaForm((prev) => ({ ...prev, observ: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBajaDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmitBaja} disabled={isSubmitting}>
              {isSubmitting ? "Registrando..." : "Registrar baja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================== */}
      {/* DIALOG: CREAR CLIENTE          */}
      {/* ============================== */}
      <Dialog open={clienteDialogOpen} onOpenChange={setClienteDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
            <DialogDescription>
              Agregá un nuevo comprador o consignatario
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre / Razón social *</Label>
              <Input
                placeholder="Ej: Cabaña Don Juan"
                value={clienteForm.nombre}
                onChange={(e) =>
                  setClienteForm((prev) => ({
                    ...prev,
                    nombre: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>CUIT</Label>
                <Input
                  placeholder="20-12345678-9"
                  value={clienteForm.cuit}
                  onChange={(e) =>
                    setClienteForm((prev) => ({
                      ...prev,
                      cuit: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>RENSPA</Label>
                <Input
                  placeholder="01.001.0.00001/00"
                  value={clienteForm.renspa}
                  onChange={(e) =>
                    setClienteForm((prev) => ({
                      ...prev,
                      renspa: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Tipo de cliente</Label>
              <div className="flex flex-wrap gap-2">
                {["invernador", "frigorifico", "consignatario", "particular"].map(
                  (t) => (
                    <Badge
                      key={t}
                      variant={clienteForm.tipo.includes(t) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleClienteTipo(t)}
                    >
                      {t}
                    </Badge>
                  )
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Nombre de contacto</Label>
                <Input
                  placeholder="Juan Pérez"
                  value={clienteForm.contactoNombre}
                  onChange={(e) =>
                    setClienteForm((prev) => ({
                      ...prev,
                      contactoNombre: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input
                  placeholder="+54 11 1234-5678"
                  value={clienteForm.contactoTel}
                  onChange={(e) =>
                    setClienteForm((prev) => ({
                      ...prev,
                      contactoTel: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Información adicional..."
                value={clienteForm.notas}
                onChange={(e) =>
                  setClienteForm((prev) => ({
                    ...prev,
                    notas: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClienteDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmitCliente} disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================== */}
      {/* DIALOG: CREAR PROVEEDOR        */}
      {/* ============================== */}
      <Dialog
        open={proveedorDialogOpen}
        onOpenChange={setProveedorDialogOpen}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
            <DialogDescription>
              Agregá un proveedor de hacienda, insumos o servicios
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre / Razón social *</Label>
              <Input
                placeholder="Ej: Veterinaria del Campo"
                value={proveedorForm.nombre}
                onChange={(e) =>
                  setProveedorForm((prev) => ({
                    ...prev,
                    nombre: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>CUIT</Label>
              <Input
                placeholder="20-12345678-9"
                value={proveedorForm.cuit}
                onChange={(e) =>
                  setProveedorForm((prev) => ({
                    ...prev,
                    cuit: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Tipo de proveedor</Label>
              <div className="flex flex-wrap gap-2">
                {["insumos", "hacienda", "servicios"].map((t) => (
                  <Badge
                    key={t}
                    variant={
                      proveedorForm.tipo.includes(t) ? "default" : "outline"
                    }
                    className="cursor-pointer"
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
                    setProveedorForm((prev) => ({
                      ...prev,
                      contactoNombre: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input
                  placeholder="+54 11 1234-5678"
                  value={proveedorForm.contactoTel}
                  onChange={(e) =>
                    setProveedorForm((prev) => ({
                      ...prev,
                      contactoTel: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Información adicional..."
                value={proveedorForm.notas}
                onChange={(e) =>
                  setProveedorForm((prev) => ({
                    ...prev,
                    notas: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProveedorDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmitProveedor} disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear proveedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================== */}
      {/* DIALOG: CREAR DOCUMENTO DTA    */}
      {/* ============================== */}
      <Dialog
        open={documentoDialogOpen}
        onOpenChange={setDocumentoDialogOpen}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo documento de tránsito</DialogTitle>
            <DialogDescription>
              Registrá un DTA o DTe para movimiento de hacienda
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Número DTA *</Label>
                <Input
                  placeholder="DTA-001234"
                  value={documentoForm.numeroDta}
                  onChange={(e) =>
                    setDocumentoForm((prev) => ({
                      ...prev,
                      numeroDta: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select
                  value={documentoForm.tipo}
                  onValueChange={(v) =>
                    setDocumentoForm((prev) => ({ ...prev, tipo: v }))
                  }
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
                  onValueChange={(v) =>
                    setDocumentoForm((prev) => ({ ...prev, motivo: v }))
                  }
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
                    setDocumentoForm((prev) => ({
                      ...prev,
                      fechaEmision: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Fecha de vencimiento *</Label>
                <Input
                  type="date"
                  value={documentoForm.fechaVencimiento}
                  onChange={(e) =>
                    setDocumentoForm((prev) => ({
                      ...prev,
                      fechaVencimiento: e.target.value,
                    }))
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
                      setDocumentoForm((prev) => ({
                        ...prev,
                        renspaOrigen: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Nombre origen</Label>
                  <Input
                    placeholder="Estancia La Pampa"
                    value={documentoForm.nombreOrigen}
                    onChange={(e) =>
                      setDocumentoForm((prev) => ({
                        ...prev,
                        nombreOrigen: e.target.value,
                      }))
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
                      setDocumentoForm((prev) => ({
                        ...prev,
                        renspaDestino: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Nombre destino</Label>
                  <Input
                    placeholder="Frigorífico Sur"
                    value={documentoForm.nombreDestino}
                    onChange={(e) =>
                      setDocumentoForm((prev) => ({
                        ...prev,
                        nombreDestino: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Hacienda</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Especie</Label>
                  <Select
                    value={documentoForm.especie}
                    onValueChange={(v) =>
                      setDocumentoForm((prev) => ({ ...prev, especie: v }))
                    }
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
                      setDocumentoForm((prev) => ({
                        ...prev,
                        cantidadAnimales: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Categorías</Label>
                  <Input
                    placeholder="Novillos, vacas"
                    value={documentoForm.categorias}
                    onChange={(e) =>
                      setDocumentoForm((prev) => ({
                        ...prev,
                        categorias: e.target.value,
                      }))
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
                      setDocumentoForm((prev) => ({
                        ...prev,
                        patenteCamion: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Transportista</Label>
                  <Input
                    placeholder="Transportes Pampa SRL"
                    value={documentoForm.transportista}
                    onChange={(e) =>
                      setDocumentoForm((prev) => ({
                        ...prev,
                        transportista: e.target.value,
                      }))
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
                  setDocumentoForm((prev) => ({
                    ...prev,
                    observ: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDocumentoDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmitDocumento} disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
