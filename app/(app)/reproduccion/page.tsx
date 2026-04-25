"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Heart,
  Plus,
  Calendar,
  Syringe,
  Baby,
  Milk,
  Activity,
  Loader2,
  Search,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ============================================
// Tipos
// ============================================

interface Torada {
  id: string
  nombre: string
  fechaInicio: string
  fechaFin: string | null
  tipo: string
  cantidadHembras: number | null
  cantidadMachos: number | null
  observ: string | null
  lote: { id: string; nombre: string; establecimiento: { nombre: string } }
  servicios: any[]
}

interface Servicio {
  id: string
  fecha: string
  tipo: string
  toroNombre: string | null
  loteSemen: string | null
  inseminador: string | null
  observ: string | null
  hembra: { id: string; caravanaVisual: string | null; cuig: string | null; categoria?: { nombre: string }; raza?: { nombre: string } }
  macho: { id: string; caravanaVisual: string | null } | null
  torada: { id: string; nombre: string } | null
  tacto: { id: string; resultado: string; mesesGest: number | null; fechaProbableParto: string | null } | null
}

interface Tacto {
  id: string
  fecha: string
  resultado: string
  mesesGest: number | null
  fechaProbableParto: string | null
  metodo: string
  veterinario: string | null
  observ: string | null
  hembra: { id: string; caravanaVisual: string | null; cuig: string | null; categoria?: { nombre: string }; raza?: { nombre: string } }
  servicio: { id: string; fecha: string; tipo: string; toroNombre: string | null } | null
}

interface Paricion {
  id: string
  fecha: string
  resultado: string
  pesoNacerKg: number | null
  tipoParto: string | null
  dificultad: number | null
  sexoCria: string | null
  observ: string | null
  madre: { id: string; caravanaVisual: string | null; cuig: string | null; raza?: { nombre: string } }
  padre: { id: string; caravanaVisual: string | null } | null
  padreExterno: string | null
  nacido: { id: string; caravanaVisual: string | null; sexo: string } | null
}

interface Destete {
  id: string
  fecha: string
  pesoKg: number | null
  edadDias: number | null
  metodo: string | null
  observ: string | null
  animal: { id: string; caravanaVisual: string | null; cuig: string | null; sexo: string; fechaNacimiento: string | null; raza?: { nombre: string }; categoria?: { nombre: string } }
}

interface AnimalOption {
  id: string
  caravanaVisual: string | null
  cuig: string | null
  sexo: string
}

interface LoteOption {
  id: string
  nombre: string
}

// ============================================
// Helpers
// ============================================

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function animalLabel(animal: { caravanaVisual: string | null; cuig?: string | null } | null) {
  if (!animal) return "-"
  return animal.caravanaVisual || animal.cuig || "Sin ID"
}

function resultadoBadge(resultado: string) {
  const map: Record<string, { label: string; className: string }> = {
    preñada: { label: "Preñada", className: "bg-green-100 text-green-800 border-green-200" },
    vacia: { label: "Vacía", className: "bg-red-100 text-red-800 border-red-200" },
    dudosa: { label: "Dudosa", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    absorcion: { label: "Absorción", className: "bg-orange-100 text-orange-800 border-orange-200" },
  }
  const info = map[resultado] || { label: resultado, className: "" }
  return <Badge className={info.className}>{info.label}</Badge>
}

function tipoBadge(tipo: string) {
  const map: Record<string, { label: string; className: string }> = {
    natural: { label: "Natural", className: "bg-blue-100 text-blue-800 border-blue-200" },
    ia: { label: "IA", className: "bg-purple-100 text-purple-800 border-purple-200" },
    iatf: { label: "IATF", className: "bg-violet-100 text-violet-800 border-violet-200" },
    mixto: { label: "Mixto", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  }
  const info = map[tipo] || { label: tipo, className: "" }
  return <Badge className={info.className}>{info.label}</Badge>
}

function partoBadge(resultado: string) {
  if (resultado === "vivo")
    return <Badge className="bg-green-100 text-green-800 border-green-200">Vivo</Badge>
  return <Badge className="bg-red-100 text-red-800 border-red-200">Muerto</Badge>
}

function metodoBadge(metodo: string | null) {
  if (!metodo) return "-"
  const labels: Record<string, string> = {
    tradicional: "Tradicional",
    precoz: "Precoz",
    hiperprecoz: "Hiperprecoz",
    destetador: "Destetador",
  }
  return <Badge variant="secondary">{labels[metodo] || metodo}</Badge>
}

// ============================================
// Componente principal
// ============================================

export default function ReproduccionPage() {
  const [activeTab, setActiveTab] = useState("toradas")
  const [loading, setLoading] = useState(true)

  // Data
  const [toradas, setToradas] = useState<Torada[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [tactos, setTactos] = useState<Tacto[]>([])
  const [pariciones, setPariciones] = useState<Paricion[]>([])
  const [destetes, setDestetes] = useState<Destete[]>([])

  // Opciones para selects
  const [hembras, setHembras] = useState<AnimalOption[]>([])
  const [machos, setMachos] = useState<AnimalOption[]>([])
  const [lotes, setLotes] = useState<LoteOption[]>([])

  // Dialogs
  const [dialogTorada, setDialogTorada] = useState(false)
  const [dialogServicio, setDialogServicio] = useState(false)
  const [dialogTacto, setDialogTacto] = useState(false)
  const [dialogParicion, setDialogParicion] = useState(false)
  const [dialogDestete, setDialogDestete] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form states
  const [formTorada, setFormTorada] = useState({
    nombre: "", fechaInicio: "", fechaFin: "", tipo: "natural",
    cantidadHembras: "", cantidadMachos: "", observ: "", loteId: "",
  })
  const [formServicio, setFormServicio] = useState({
    fecha: "", tipo: "natural", hembraId: "", machoId: "",
    toradaId: "", toroNombre: "", loteSemen: "", inseminador: "", observ: "",
  })
  const [formTacto, setFormTacto] = useState({
    fecha: "", resultado: "preñada", mesesGest: "", fechaProbableParto: "",
    metodo: "palpacion", veterinario: "", hembraId: "", servicioId: "", observ: "",
  })
  const [formParicion, setFormParicion] = useState({
    fecha: "", resultado: "vivo", pesoNacerKg: "", tipoParto: "normal",
    dificultad: "", sexoCria: "", madreId: "", padreId: "", padreExterno: "", observ: "",
  })
  const [formDestete, setFormDestete] = useState({
    fecha: "", pesoKg: "", edadDias: "", metodo: "tradicional",
    animalId: "", observ: "",
  })

  // Búsqueda de animales
  const [searchHembra, setSearchHembra] = useState("")

  // ============================================
  // Fetch data
  // ============================================

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [torRes, srvRes, tacRes, parRes, desRes] = await Promise.all([
        fetch("/api/reproduccion/toradas"),
        fetch("/api/reproduccion/servicios"),
        fetch("/api/reproduccion/tactos"),
        fetch("/api/reproduccion/pariciones"),
        fetch("/api/reproduccion/destetes"),
      ])

      const [torData, srvData, tacData, parData, desData] = await Promise.all([
        torRes.json(), srvRes.json(), tacRes.json(), parRes.json(), desRes.json(),
      ])

      if (torData.success) setToradas(torData.data)
      if (srvData.success) setServicios(srvData.data)
      if (tacData.success) setTactos(tacData.data)
      if (parData.success) setPariciones(parData.data)
      if (desData.success) setDestetes(desData.data)
    } catch {
      toast.error("Error al cargar datos de reproducción")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchOptions = useCallback(async () => {
    try {
      const bovinosRes = await fetch("/api/ganado/bovinos?limit=500")
      const bovinosData = await bovinosRes.json()
      if (bovinosData.success && bovinosData.data) {
        const animales = bovinosData.data as any[]
        setHembras(animales.filter((a: any) => a.sexo === "F").map((a: any) => ({
          id: a.id, caravanaVisual: a.caravanaVisual || a.tagNumber, cuig: a.cuig, sexo: a.sexo,
        })))
        setMachos(animales.filter((a: any) => a.sexo === "M").map((a: any) => ({
          id: a.id, caravanaVisual: a.caravanaVisual || a.tagNumber, cuig: a.cuig, sexo: a.sexo,
        })))
      }
    } catch {
      /* silenciar si no hay datos */
    }

    try {
      const lotesRes = await fetch("/api/establecimientos/" + "all" + "/lotes")
      const lotesData = await lotesRes.json()
      if (lotesData.success && lotesData.data) {
        setLotes(lotesData.data)
      }
    } catch {
      /* silenciar */
    }
  }, [])

  useEffect(() => {
    fetchAll()
    fetchOptions()
  }, [fetchAll, fetchOptions])

  // ============================================
  // KPIs
  // ============================================

  const currentYear = new Date().getFullYear()
  const serviciosAnio = servicios.filter(
    (s) => new Date(s.fecha).getFullYear() === currentYear
  )
  const totalServicios = serviciosAnio.length
  const totalTactos = tactos.length
  const tactosPreñadas = tactos.filter((t) => t.resultado === "preñada").length
  const porcentajePreñez = totalTactos > 0 ? Math.round((tactosPreñadas / totalTactos) * 100) : 0
  const totalPariciones = pariciones.filter(
    (p) => new Date(p.fecha).getFullYear() === currentYear
  ).length
  const totalDestetes = destetes.filter(
    (d) => new Date(d.fecha).getFullYear() === currentYear
  ).length

  // ============================================
  // Submit handlers
  // ============================================

  async function handleSubmitTorada() {
    if (!formTorada.nombre || !formTorada.fechaInicio || !formTorada.loteId) {
      toast.error("Completá los campos requeridos")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/reproduccion/toradas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formTorada),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Torada creada correctamente")
        setDialogTorada(false)
        setFormTorada({ nombre: "", fechaInicio: "", fechaFin: "", tipo: "natural", cantidadHembras: "", cantidadMachos: "", observ: "", loteId: "" })
        fetchAll()
      } else {
        toast.error(data.error || "Error al crear torada")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitServicio() {
    if (!formServicio.fecha || !formServicio.hembraId) {
      toast.error("Completá los campos requeridos")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/reproduccion/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formServicio),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Servicio registrado correctamente")
        setDialogServicio(false)
        setFormServicio({ fecha: "", tipo: "natural", hembraId: "", machoId: "", toradaId: "", toroNombre: "", loteSemen: "", inseminador: "", observ: "" })
        fetchAll()
      } else {
        toast.error(data.error || "Error al registrar servicio")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitTacto() {
    if (!formTacto.fecha || !formTacto.hembraId || !formTacto.resultado) {
      toast.error("Completá los campos requeridos")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/reproduccion/tactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formTacto),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Tacto registrado correctamente")
        setDialogTacto(false)
        setFormTacto({ fecha: "", resultado: "preñada", mesesGest: "", fechaProbableParto: "", metodo: "palpacion", veterinario: "", hembraId: "", servicioId: "", observ: "" })
        fetchAll()
      } else {
        toast.error(data.error || "Error al registrar tacto")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitParicion() {
    if (!formParicion.fecha || !formParicion.madreId || !formParicion.resultado) {
      toast.error("Completá los campos requeridos")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/reproduccion/pariciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formParicion),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Parición registrada correctamente")
        setDialogParicion(false)
        setFormParicion({ fecha: "", resultado: "vivo", pesoNacerKg: "", tipoParto: "normal", dificultad: "", sexoCria: "", madreId: "", padreId: "", padreExterno: "", observ: "" })
        fetchAll()
      } else {
        toast.error(data.error || "Error al registrar parición")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitDestete() {
    if (!formDestete.fecha || !formDestete.animalId) {
      toast.error("Completá los campos requeridos")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/reproduccion/destetes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formDestete),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Destete registrado correctamente")
        setDialogDestete(false)
        setFormDestete({ fecha: "", pesoKg: "", edadDias: "", metodo: "tradicional", animalId: "", observ: "" })
        fetchAll()
      } else {
        toast.error(data.error || "Error al registrar destete")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setSaving(false)
    }
  }

  // Helper para filtrar hembras en selects
  const filteredHembras = searchHembra
    ? hembras.filter(
        (h) =>
          (h.caravanaVisual || "").toLowerCase().includes(searchHembra.toLowerCase()) ||
          (h.cuig || "").toLowerCase().includes(searchHembra.toLowerCase())
      )
    : hembras

  // ============================================
  // Render
  // ============================================

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Heart className="h-8 w-8 text-primary" />
          Reproducción
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestión del ciclo reproductivo: toradas, servicio, tacto, parición y destete
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servicios ({currentYear})</CardTitle>
            <Syringe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalServicios}</div>
            <p className="text-xs text-muted-foreground">registrados este año</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">% Preñez</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalTactos > 0 ? `${porcentajePreñez}%` : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              {tactosPreñadas} preñadas de {totalTactos} tactadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pariciones ({currentYear})</CardTitle>
            <Baby className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPariciones}</div>
            <p className="text-xs text-muted-foreground">nacimientos este año</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Destetes ({currentYear})</CardTitle>
            <Milk className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDestetes}</div>
            <p className="text-xs text-muted-foreground">animales destetados</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="toradas">Toradas</TabsTrigger>
          <TabsTrigger value="servicios">Servicios</TabsTrigger>
          <TabsTrigger value="tactos">Tactos</TabsTrigger>
          <TabsTrigger value="pariciones">Pariciones</TabsTrigger>
          <TabsTrigger value="destetes">Destetes</TabsTrigger>
        </TabsList>

        {/* ==================== TAB TORADAS ==================== */}
        <TabsContent value="toradas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Temporadas de servicio</CardTitle>
              <Button onClick={() => setDialogTorada(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nueva torada
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : toradas.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">
                  No hay toradas registradas. Creá una nueva para comenzar.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Nombre</th>
                        <th className="text-left py-3 px-2 font-medium">Tipo</th>
                        <th className="text-left py-3 px-2 font-medium">Inicio</th>
                        <th className="text-left py-3 px-2 font-medium">Fin</th>
                        <th className="text-left py-3 px-2 font-medium">Lote</th>
                        <th className="text-right py-3 px-2 font-medium">Hembras</th>
                        <th className="text-right py-3 px-2 font-medium">Machos</th>
                        <th className="text-right py-3 px-2 font-medium">Servicios</th>
                      </tr>
                    </thead>
                    <tbody>
                      {toradas.map((t) => (
                        <tr key={t.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2 font-medium">{t.nombre}</td>
                          <td className="py-3 px-2">{tipoBadge(t.tipo)}</td>
                          <td className="py-3 px-2">{formatDate(t.fechaInicio)}</td>
                          <td className="py-3 px-2">
                            {t.fechaFin ? formatDate(t.fechaFin) : (
                              <Badge className="bg-green-100 text-green-800 border-green-200">Activa</Badge>
                            )}
                          </td>
                          <td className="py-3 px-2">{t.lote?.nombre || "-"}</td>
                          <td className="py-3 px-2 text-right">{t.cantidadHembras ?? "-"}</td>
                          <td className="py-3 px-2 text-right">{t.cantidadMachos ?? "-"}</td>
                          <td className="py-3 px-2 text-right">{t.servicios?.length || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB SERVICIOS ==================== */}
        <TabsContent value="servicios">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Servicios realizados</CardTitle>
              <Button onClick={() => setDialogServicio(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nuevo servicio
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : servicios.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">
                  No hay servicios registrados.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Fecha</th>
                        <th className="text-left py-3 px-2 font-medium">Hembra</th>
                        <th className="text-left py-3 px-2 font-medium">Tipo</th>
                        <th className="text-left py-3 px-2 font-medium">Macho / Toro</th>
                        <th className="text-left py-3 px-2 font-medium">Torada</th>
                        <th className="text-left py-3 px-2 font-medium">Inseminador</th>
                        <th className="text-left py-3 px-2 font-medium">Tacto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servicios.map((s) => (
                        <tr key={s.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2">{formatDate(s.fecha)}</td>
                          <td className="py-3 px-2 font-medium">{animalLabel(s.hembra)}</td>
                          <td className="py-3 px-2">{tipoBadge(s.tipo)}</td>
                          <td className="py-3 px-2">
                            {s.macho ? animalLabel(s.macho) : s.toroNombre || "-"}
                          </td>
                          <td className="py-3 px-2">{s.torada?.nombre || "-"}</td>
                          <td className="py-3 px-2">{s.inseminador || "-"}</td>
                          <td className="py-3 px-2">
                            {s.tacto ? resultadoBadge(s.tacto.resultado) : (
                              <span className="text-muted-foreground">Pendiente</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB TACTOS ==================== */}
        <TabsContent value="tactos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Diagnósticos de preñez</CardTitle>
              <Button onClick={() => setDialogTacto(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nuevo tacto
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : tactos.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">
                  No hay tactos registrados.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Fecha</th>
                        <th className="text-left py-3 px-2 font-medium">Hembra</th>
                        <th className="text-left py-3 px-2 font-medium">Resultado</th>
                        <th className="text-left py-3 px-2 font-medium">Meses gest.</th>
                        <th className="text-left py-3 px-2 font-medium">Fecha prob. parto</th>
                        <th className="text-left py-3 px-2 font-medium">Método</th>
                        <th className="text-left py-3 px-2 font-medium">Veterinario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tactos.map((t) => (
                        <tr key={t.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2">{formatDate(t.fecha)}</td>
                          <td className="py-3 px-2 font-medium">{animalLabel(t.hembra)}</td>
                          <td className="py-3 px-2">{resultadoBadge(t.resultado)}</td>
                          <td className="py-3 px-2">{t.mesesGest ?? "-"}</td>
                          <td className="py-3 px-2">
                            {t.fechaProbableParto ? formatDate(t.fechaProbableParto) : "-"}
                          </td>
                          <td className="py-3 px-2">
                            <Badge variant="outline">
                              {t.metodo === "ecografia" ? "Ecografía" : "Palpación"}
                            </Badge>
                          </td>
                          <td className="py-3 px-2">{t.veterinario || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB PARICIONES ==================== */}
        <TabsContent value="pariciones">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pariciones</CardTitle>
              <Button onClick={() => setDialogParicion(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nueva parición
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pariciones.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">
                  No hay pariciones registradas.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Fecha</th>
                        <th className="text-left py-3 px-2 font-medium">Madre</th>
                        <th className="text-left py-3 px-2 font-medium">Resultado</th>
                        <th className="text-right py-3 px-2 font-medium">Peso nacer (kg)</th>
                        <th className="text-left py-3 px-2 font-medium">Tipo parto</th>
                        <th className="text-left py-3 px-2 font-medium">Sexo cría</th>
                        <th className="text-left py-3 px-2 font-medium">Padre</th>
                        <th className="text-left py-3 px-2 font-medium">Cría</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pariciones.map((p) => (
                        <tr key={p.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2">{formatDate(p.fecha)}</td>
                          <td className="py-3 px-2 font-medium">{animalLabel(p.madre)}</td>
                          <td className="py-3 px-2">{partoBadge(p.resultado)}</td>
                          <td className="py-3 px-2 text-right">{p.pesoNacerKg ?? "-"}</td>
                          <td className="py-3 px-2">
                            {p.tipoParto ? (
                              <Badge variant="outline">
                                {p.tipoParto === "normal" ? "Normal" : p.tipoParto === "asistido" ? "Asistido" : "Cesárea"}
                              </Badge>
                            ) : "-"}
                          </td>
                          <td className="py-3 px-2">
                            {p.sexoCria === "M" ? "Macho" : p.sexoCria === "F" ? "Hembra" : p.sexoCria || "-"}
                          </td>
                          <td className="py-3 px-2">
                            {p.padre ? animalLabel(p.padre) : p.padreExterno || "-"}
                          </td>
                          <td className="py-3 px-2">
                            {p.nacido ? animalLabel(p.nacido) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB DESTETES ==================== */}
        <TabsContent value="destetes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Destetes</CardTitle>
              <Button onClick={() => setDialogDestete(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nuevo destete
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : destetes.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">
                  No hay destetes registrados.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Fecha</th>
                        <th className="text-left py-3 px-2 font-medium">Animal</th>
                        <th className="text-left py-3 px-2 font-medium">Raza</th>
                        <th className="text-right py-3 px-2 font-medium">Peso (kg)</th>
                        <th className="text-right py-3 px-2 font-medium">Edad (días)</th>
                        <th className="text-left py-3 px-2 font-medium">Método</th>
                      </tr>
                    </thead>
                    <tbody>
                      {destetes.map((d) => (
                        <tr key={d.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2">{formatDate(d.fecha)}</td>
                          <td className="py-3 px-2 font-medium">{animalLabel(d.animal)}</td>
                          <td className="py-3 px-2">{d.animal.raza?.nombre || "-"}</td>
                          <td className="py-3 px-2 text-right">{d.pesoKg ?? "-"}</td>
                          <td className="py-3 px-2 text-right">{d.edadDias ?? "-"}</td>
                          <td className="py-3 px-2">{metodoBadge(d.metodo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ================================================================ */}
      {/* DIALOGS                                                          */}
      {/* ================================================================ */}

      {/* ---- Dialog Torada ---- */}
      <Dialog open={dialogTorada} onOpenChange={setDialogTorada}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nueva torada</DialogTitle>
            <DialogDescription>Registrá una nueva temporada de servicio</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tor-nombre">Nombre *</Label>
              <Input id="tor-nombre" placeholder="Servicio Otoño 2026" value={formTorada.nombre} onChange={(e) => setFormTorada({ ...formTorada, nombre: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tor-inicio">Fecha inicio *</Label>
                <Input id="tor-inicio" type="date" value={formTorada.fechaInicio} onChange={(e) => setFormTorada({ ...formTorada, fechaInicio: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tor-fin">Fecha fin</Label>
                <Input id="tor-fin" type="date" value={formTorada.fechaFin} onChange={(e) => setFormTorada({ ...formTorada, fechaFin: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Tipo *</Label>
              <Select value={formTorada.tipo} onValueChange={(v) => setFormTorada({ ...formTorada, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural">Natural</SelectItem>
                  <SelectItem value="ia">IA</SelectItem>
                  <SelectItem value="iatf">IATF</SelectItem>
                  <SelectItem value="mixto">Mixto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Lote *</Label>
              <Select value={formTorada.loteId} onValueChange={(v) => setFormTorada({ ...formTorada, loteId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccioná un lote" /></SelectTrigger>
                <SelectContent>
                  {lotes.length === 0 ? (
                    <SelectItem value="__none" disabled>No hay lotes disponibles</SelectItem>
                  ) : (
                    lotes.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tor-hembras">Cantidad hembras</Label>
                <Input id="tor-hembras" type="number" value={formTorada.cantidadHembras} onChange={(e) => setFormTorada({ ...formTorada, cantidadHembras: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tor-machos">Cantidad machos</Label>
                <Input id="tor-machos" type="number" value={formTorada.cantidadMachos} onChange={(e) => setFormTorada({ ...formTorada, cantidadMachos: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tor-obs">Observaciones</Label>
              <Input id="tor-obs" value={formTorada.observ} onChange={(e) => setFormTorada({ ...formTorada, observ: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTorada(false)}>Cancelar</Button>
            <Button onClick={handleSubmitTorada} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear torada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Dialog Servicio ---- */}
      <Dialog open={dialogServicio} onOpenChange={setDialogServicio}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nuevo servicio</DialogTitle>
            <DialogDescription>Registrá un servicio (monta natural o IA)</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="srv-fecha">Fecha *</Label>
                <Input id="srv-fecha" type="date" value={formServicio.fecha} onChange={(e) => setFormServicio({ ...formServicio, fecha: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Tipo *</Label>
                <Select value={formServicio.tipo} onValueChange={(v) => setFormServicio({ ...formServicio, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="natural">Natural</SelectItem>
                    <SelectItem value="ia">IA</SelectItem>
                    <SelectItem value="iatf">IATF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Hembra *</Label>
              <Select value={formServicio.hembraId} onValueChange={(v) => setFormServicio({ ...formServicio, hembraId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccioná hembra" /></SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="flex items-center gap-2 px-1 pb-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Buscar caravana..." value={searchHembra} onChange={(e) => setSearchHembra(e.target.value)} />
                    </div>
                  </div>
                  {filteredHembras.slice(0, 50).map((h) => (
                    <SelectItem key={h.id} value={h.id}>{animalLabel(h)}</SelectItem>
                  ))}
                  {filteredHembras.length === 0 && (
                    <SelectItem value="__none" disabled>No hay hembras</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {formServicio.tipo === "natural" ? (
              <div className="grid gap-2">
                <Label>Macho</Label>
                <Select value={formServicio.machoId} onValueChange={(v) => setFormServicio({ ...formServicio, machoId: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccioná macho (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {machos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{animalLabel(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="srv-toro">Nombre del toro (semen)</Label>
                  <Input id="srv-toro" value={formServicio.toroNombre} onChange={(e) => setFormServicio({ ...formServicio, toroNombre: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="srv-lote">Lote semen</Label>
                    <Input id="srv-lote" value={formServicio.loteSemen} onChange={(e) => setFormServicio({ ...formServicio, loteSemen: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="srv-insem">Inseminador</Label>
                    <Input id="srv-insem" value={formServicio.inseminador} onChange={(e) => setFormServicio({ ...formServicio, inseminador: e.target.value })} />
                  </div>
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label>Torada</Label>
              <Select value={formServicio.toradaId} onValueChange={(v) => setFormServicio({ ...formServicio, toradaId: v })}>
                <SelectTrigger><SelectValue placeholder="Asociar a torada (opcional)" /></SelectTrigger>
                <SelectContent>
                  {toradas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="srv-obs">Observaciones</Label>
              <Input id="srv-obs" value={formServicio.observ} onChange={(e) => setFormServicio({ ...formServicio, observ: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogServicio(false)}>Cancelar</Button>
            <Button onClick={handleSubmitServicio} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar servicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Dialog Tacto ---- */}
      <Dialog open={dialogTacto} onOpenChange={setDialogTacto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nuevo tacto</DialogTitle>
            <DialogDescription>Registrá un diagnóstico de preñez</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tac-fecha">Fecha *</Label>
                <Input id="tac-fecha" type="date" value={formTacto.fecha} onChange={(e) => setFormTacto({ ...formTacto, fecha: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Resultado *</Label>
                <Select value={formTacto.resultado} onValueChange={(v) => setFormTacto({ ...formTacto, resultado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preñada">Preñada</SelectItem>
                    <SelectItem value="vacia">Vacía</SelectItem>
                    <SelectItem value="dudosa">Dudosa</SelectItem>
                    <SelectItem value="absorcion">Absorción</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Hembra *</Label>
              <Select value={formTacto.hembraId} onValueChange={(v) => setFormTacto({ ...formTacto, hembraId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccioná hembra" /></SelectTrigger>
                <SelectContent>
                  {hembras.slice(0, 50).map((h) => (
                    <SelectItem key={h.id} value={h.id}>{animalLabel(h)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Método *</Label>
              <Select value={formTacto.metodo} onValueChange={(v) => setFormTacto({ ...formTacto, metodo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="palpacion">Palpación</SelectItem>
                  <SelectItem value="ecografia">Ecografía</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formTacto.resultado === "preñada" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="tac-meses">Meses gestación</Label>
                  <Input id="tac-meses" type="number" step="0.5" value={formTacto.mesesGest} onChange={(e) => setFormTacto({ ...formTacto, mesesGest: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tac-fpp">Fecha prob. parto</Label>
                  <Input id="tac-fpp" type="date" value={formTacto.fechaProbableParto} onChange={(e) => setFormTacto({ ...formTacto, fechaProbableParto: e.target.value })} />
                </div>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Servicio asociado</Label>
              <Select value={formTacto.servicioId} onValueChange={(v) => setFormTacto({ ...formTacto, servicioId: v })}>
                <SelectTrigger><SelectValue placeholder="Asociar a servicio (opcional)" /></SelectTrigger>
                <SelectContent>
                  {servicios.filter((s) => !s.tacto).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {formatDate(s.fecha)} - {animalLabel(s.hembra)} ({s.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tac-vet">Veterinario</Label>
              <Input id="tac-vet" value={formTacto.veterinario} onChange={(e) => setFormTacto({ ...formTacto, veterinario: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tac-obs">Observaciones</Label>
              <Input id="tac-obs" value={formTacto.observ} onChange={(e) => setFormTacto({ ...formTacto, observ: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTacto(false)}>Cancelar</Button>
            <Button onClick={handleSubmitTacto} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar tacto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Dialog Parición ---- */}
      <Dialog open={dialogParicion} onOpenChange={setDialogParicion}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nueva parición</DialogTitle>
            <DialogDescription>Registrá un nacimiento</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="par-fecha">Fecha *</Label>
                <Input id="par-fecha" type="date" value={formParicion.fecha} onChange={(e) => setFormParicion({ ...formParicion, fecha: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Resultado *</Label>
                <Select value={formParicion.resultado} onValueChange={(v) => setFormParicion({ ...formParicion, resultado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vivo">Vivo</SelectItem>
                    <SelectItem value="muerto">Muerto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Madre *</Label>
              <Select value={formParicion.madreId} onValueChange={(v) => setFormParicion({ ...formParicion, madreId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccioná la madre" /></SelectTrigger>
                <SelectContent>
                  {hembras.slice(0, 50).map((h) => (
                    <SelectItem key={h.id} value={h.id}>{animalLabel(h)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Padre (del rodeo)</Label>
                <Select value={formParicion.padreId} onValueChange={(v) => setFormParicion({ ...formParicion, padreId: v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    {machos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{animalLabel(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="par-padre-ext">Padre externo</Label>
                <Input id="par-padre-ext" placeholder="Nombre toro IA" value={formParicion.padreExterno} onChange={(e) => setFormParicion({ ...formParicion, padreExterno: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="par-peso">Peso nacer (kg)</Label>
                <Input id="par-peso" type="number" step="0.1" value={formParicion.pesoNacerKg} onChange={(e) => setFormParicion({ ...formParicion, pesoNacerKg: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Tipo parto</Label>
                <Select value={formParicion.tipoParto} onValueChange={(v) => setFormParicion({ ...formParicion, tipoParto: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="asistido">Asistido</SelectItem>
                    <SelectItem value="cesarea">Cesárea</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Sexo cría</Label>
                <Select value={formParicion.sexoCria} onValueChange={(v) => setFormParicion({ ...formParicion, sexoCria: v })}>
                  <SelectTrigger><SelectValue placeholder="Sexo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Macho</SelectItem>
                    <SelectItem value="F">Hembra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="par-dif">Dificultad (1-5)</Label>
              <Input id="par-dif" type="number" min="1" max="5" value={formParicion.dificultad} onChange={(e) => setFormParicion({ ...formParicion, dificultad: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="par-obs">Observaciones</Label>
              <Input id="par-obs" value={formParicion.observ} onChange={(e) => setFormParicion({ ...formParicion, observ: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogParicion(false)}>Cancelar</Button>
            <Button onClick={handleSubmitParicion} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar parición
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Dialog Destete ---- */}
      <Dialog open={dialogDestete} onOpenChange={setDialogDestete}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nuevo destete</DialogTitle>
            <DialogDescription>Registrá un destete</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="des-fecha">Fecha *</Label>
              <Input id="des-fecha" type="date" value={formDestete.fecha} onChange={(e) => setFormDestete({ ...formDestete, fecha: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Animal *</Label>
              <Select value={formDestete.animalId} onValueChange={(v) => setFormDestete({ ...formDestete, animalId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccioná el animal" /></SelectTrigger>
                <SelectContent>
                  {[...hembras, ...machos].slice(0, 50).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {animalLabel(a)} ({a.sexo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="des-peso">Peso (kg)</Label>
                <Input id="des-peso" type="number" step="0.1" value={formDestete.pesoKg} onChange={(e) => setFormDestete({ ...formDestete, pesoKg: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="des-edad">Edad (días)</Label>
                <Input id="des-edad" type="number" value={formDestete.edadDias} onChange={(e) => setFormDestete({ ...formDestete, edadDias: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Método</Label>
              <Select value={formDestete.metodo} onValueChange={(v) => setFormDestete({ ...formDestete, metodo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tradicional">Tradicional</SelectItem>
                  <SelectItem value="precoz">Precoz</SelectItem>
                  <SelectItem value="hiperprecoz">Hiperprecoz</SelectItem>
                  <SelectItem value="destetador">Destetador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="des-obs">Observaciones</Label>
              <Input id="des-obs" value={formDestete.observ} onChange={(e) => setFormDestete({ ...formDestete, observ: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogDestete(false)}>Cancelar</Button>
            <Button onClick={handleSubmitDestete} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar destete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
