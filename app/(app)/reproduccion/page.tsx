"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Heart,
  Plus,
  Syringe,
  Baby,
  Activity,
  Loader2,
  Search,
  TrendingUp,
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
import { Skeleton } from "@/components/ui/skeleton"

import { useTenant } from "@/lib/context/tenant-context"

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

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
  hembra: {
    id: string
    caravanaVisual: string | null
    cuig: string | null
    categoria?: { nombre: string }
    raza?: { nombre: string }
  }
  macho: { id: string; caravanaVisual: string | null } | null
  torada: { id: string; nombre: string } | null
  tacto: {
    id: string
    resultado: string
    mesesGest: number | null
    fechaProbableParto: string | null
  } | null
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
  hembra: {
    id: string
    caravanaVisual: string | null
    cuig: string | null
    categoria?: { nombre: string }
    raza?: { nombre: string }
  }
  servicio: {
    id: string
    fecha: string
    tipo: string
    toroNombre: string | null
  } | null
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
  madre: {
    id: string
    caravanaVisual: string | null
    cuig: string | null
    raza?: { nombre: string }
  }
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
  animal: {
    id: string
    caravanaVisual: string | null
    cuig: string | null
    sexo: string
    fechaNacimiento: string | null
    raza?: { nombre: string }
    categoria?: { nombre: string }
  }
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

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function label(a: { caravanaVisual: string | null; cuig?: string | null } | null) {
  if (!a) return "-"
  return a.caravanaVisual || a.cuig || "Sin ID"
}

function ResultadoBadge({ resultado }: { resultado: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    preñada: { text: "Preñada", cls: "bg-green-100 text-green-800 border-green-200" },
    vacia: { text: "Vacía", cls: "bg-red-100 text-red-800 border-red-200" },
    dudosa: { text: "Dudosa", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    absorcion: { text: "Absorción", cls: "bg-orange-100 text-orange-800 border-orange-200" },
  }
  const info = map[resultado] || { text: resultado, cls: "" }
  return <Badge className={info.cls}>{info.text}</Badge>
}

function TipoBadge({ tipo }: { tipo: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    natural: { text: "Natural", cls: "bg-blue-100 text-blue-800 border-blue-200" },
    ia: { text: "IA", cls: "bg-purple-100 text-purple-800 border-purple-200" },
    iatf: { text: "IATF", cls: "bg-violet-100 text-violet-800 border-violet-200" },
    mixto: { text: "Mixto", cls: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  }
  const info = map[tipo] || { text: tipo, cls: "" }
  return <Badge className={info.cls}>{info.text}</Badge>
}

function PartoBadge({ resultado }: { resultado: string }) {
  if (resultado === "vivo")
    return <Badge className="bg-green-100 text-green-800 border-green-200">Vivo</Badge>
  return <Badge className="bg-red-100 text-red-800 border-red-200">Muerto</Badge>
}

function MetodoBadge({ metodo }: { metodo: string | null }) {
  if (!metodo) return <span className="text-muted-foreground">-</span>
  const labels: Record<string, string> = {
    tradicional: "Tradicional",
    precoz: "Precoz",
    hiperprecoz: "Hiperprecoz",
    destetador: "Destetador",
  }
  return <Badge variant="secondary">{labels[metodo] || metodo}</Badge>
}

// ────────────────────────────────────────────
// Fetchers
// ────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Error de red")
  const json = await res.json()
  if (json.success) return json.data
  throw new Error(json.error || "Error al cargar datos")
}

async function postJson(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error || "Error al guardar")
  return json.data
}

// ────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────

export default function ReproduccionPage() {
  const { establecimientoActivo, isLoading: tenantLoading } = useTenant()
  const queryClient = useQueryClient()
  const estId = establecimientoActivo?.id || ""

  const [activeTab, setActiveTab] = useState("servicios")

  const [dialogServicio, setDialogServicio] = useState(false)
  const [dialogTacto, setDialogTacto] = useState(false)
  const [dialogParicion, setDialogParicion] = useState(false)
  const [dialogDestete, setDialogDestete] = useState(false)
  const [dialogTorada, setDialogTorada] = useState(false)

  // ── Queries ──

  const { data: toradas = [], isLoading: loadToradas } = useQuery({
    queryKey: ["repro-toradas", estId],
    queryFn: () => fetchJson<Torada>(`/api/reproduccion/toradas${estId ? `?establecimientoId=${estId}` : ""}`),
    enabled: !!estId,
  })

  const { data: servicios = [], isLoading: loadServicios } = useQuery({
    queryKey: ["repro-servicios", estId],
    queryFn: () => fetchJson<Servicio>(`/api/reproduccion/servicios${estId ? `?establecimientoId=${estId}` : ""}`),
    enabled: !!estId,
  })

  const { data: tactos = [], isLoading: loadTactos } = useQuery({
    queryKey: ["repro-tactos", estId],
    queryFn: () => fetchJson<Tacto>(`/api/reproduccion/tactos${estId ? `?establecimientoId=${estId}` : ""}`),
    enabled: !!estId,
  })

  const { data: pariciones = [], isLoading: loadPariciones } = useQuery({
    queryKey: ["repro-pariciones", estId],
    queryFn: () => fetchJson<Paricion>(`/api/reproduccion/pariciones${estId ? `?establecimientoId=${estId}` : ""}`),
    enabled: !!estId,
  })

  const { data: destetes = [], isLoading: loadDestetes } = useQuery({
    queryKey: ["repro-destetes", estId],
    queryFn: () => fetchJson<Destete>(`/api/reproduccion/destetes${estId ? `?establecimientoId=${estId}` : ""}`),
    enabled: !!estId,
  })

  const { data: animalesRaw = [] } = useQuery({
    queryKey: ["repro-bovinos", estId],
    queryFn: async () => {
      const res = await fetch(`/api/ganado/bovinos?limit=500${estId ? `&establecimientoId=${estId}` : ""}`)
      const json = await res.json()
      if (json.success) return json.data as any[]
      return []
    },
    enabled: !!estId,
  })

  const { data: lotes = [] } = useQuery({
    queryKey: ["repro-lotes", estId],
    queryFn: async () => {
      if (!estId) return []
      const res = await fetch(`/api/establecimientos/${estId}/lotes`)
      const json = await res.json()
      if (json.success && json.data) return json.data as LoteOption[]
      if (Array.isArray(json)) return json as LoteOption[]
      return []
    },
    enabled: !!estId,
  })

  const hembras: AnimalOption[] = animalesRaw
    .filter((a: any) => a.sexo === "F")
    .map((a: any) => ({ id: a.id, caravanaVisual: a.caravanaVisual || a.tagNumber, cuig: a.cuig, sexo: a.sexo }))

  const machos: AnimalOption[] = animalesRaw
    .filter((a: any) => a.sexo === "M")
    .map((a: any) => ({ id: a.id, caravanaVisual: a.caravanaVisual || a.tagNumber, cuig: a.cuig, sexo: a.sexo }))

  const allAnimals: AnimalOption[] = animalesRaw
    .map((a: any) => ({ id: a.id, caravanaVisual: a.caravanaVisual || a.tagNumber, cuig: a.cuig, sexo: a.sexo }))

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["repro-toradas", estId] })
    queryClient.invalidateQueries({ queryKey: ["repro-servicios", estId] })
    queryClient.invalidateQueries({ queryKey: ["repro-tactos", estId] })
    queryClient.invalidateQueries({ queryKey: ["repro-pariciones", estId] })
    queryClient.invalidateQueries({ queryKey: ["repro-destetes", estId] })
  }

  // ── KPIs ──

  const currentYear = new Date().getFullYear()
  const vientresEnServicio = servicios.filter((s) => !s.tacto).length
  const prenezConfirmada = tactos.filter((t) => t.resultado === "preñada").length
  const partosAnio = pariciones.filter((p) => new Date(p.fecha).getFullYear() === currentYear).length
  const totalTactos = tactos.length
  const porcentajePreñez = totalTactos > 0 ? Math.round((prenezConfirmada / totalTactos) * 100) : 0

  const loading = loadToradas || loadServicios || loadTactos || loadPariciones || loadDestetes

  // ── Tenant guard ──

  if (tenantLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!establecimientoActivo) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <Heart className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sin establecimiento seleccionado</h2>
        <p className="text-muted-foreground max-w-md">
          Seleccioná un establecimiento desde el menú superior para ver los datos reproductivos.
        </p>
      </div>
    )
  }

  // ── Render ──

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Heart className="h-8 w-8 text-primary" />
            Reproducción
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestión del ciclo reproductivo: toradas, servicio, tacto, parición y destete
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => { setActiveTab("servicios"); setDialogServicio(true) }}>
            <Syringe className="h-4 w-4 mr-2" />
            Nuevo servicio
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setActiveTab("tactos"); setDialogTacto(true) }}>
            <Activity className="h-4 w-4 mr-2" />
            Registrar tacto
          </Button>
          <Button size="sm" onClick={() => { setActiveTab("pariciones"); setDialogParicion(true) }}>
            <Baby className="h-4 w-4 mr-2" />
            Registrar parto
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vientres en servicio</CardTitle>
            <Syringe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : vientresEnServicio}</div>
            <p className="text-xs text-muted-foreground">sin tacto registrado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preñez confirmada</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : prenezConfirmada}</div>
            <p className="text-xs text-muted-foreground">tactos positivos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partos ({currentYear})</CardTitle>
            <Baby className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : partosAnio}</div>
            <p className="text-xs text-muted-foreground">nacimientos este año</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">% Preñez</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : totalTactos > 0 ? `${porcentajePreñez}%` : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              {prenezConfirmada} preñadas de {totalTactos} tactadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="servicios">Servicios</TabsTrigger>
          <TabsTrigger value="tactos">Tactos</TabsTrigger>
          <TabsTrigger value="pariciones">Pariciones</TabsTrigger>
          <TabsTrigger value="destetes">Destetes</TabsTrigger>
          <TabsTrigger value="toradas">Toradas</TabsTrigger>
        </TabsList>

        {/* ─── TAB: Servicios ─── */}
        <TabsContent value="servicios">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Servicios realizados</CardTitle>
              <Button onClick={() => setDialogServicio(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nuevo servicio
              </Button>
            </CardHeader>
            <CardContent>
              {loadServicios ? (
                <LoadingSpinner />
              ) : servicios.length === 0 ? (
                <EmptyState text="No hay servicios registrados." />
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
                          <td className="py-3 px-2">{fmt(s.fecha)}</td>
                          <td className="py-3 px-2 font-medium">{label(s.hembra)}</td>
                          <td className="py-3 px-2"><TipoBadge tipo={s.tipo} /></td>
                          <td className="py-3 px-2">{s.macho ? label(s.macho) : s.toroNombre || "-"}</td>
                          <td className="py-3 px-2">{s.torada?.nombre || "-"}</td>
                          <td className="py-3 px-2">{s.inseminador || "-"}</td>
                          <td className="py-3 px-2">
                            {s.tacto ? <ResultadoBadge resultado={s.tacto.resultado} /> : (
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

        {/* ─── TAB: Tactos ─── */}
        <TabsContent value="tactos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Diagnósticos de preñez</CardTitle>
              <Button onClick={() => setDialogTacto(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nuevo tacto
              </Button>
            </CardHeader>
            <CardContent>
              {loadTactos ? (
                <LoadingSpinner />
              ) : tactos.length === 0 ? (
                <EmptyState text="No hay tactos registrados." />
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
                          <td className="py-3 px-2">{fmt(t.fecha)}</td>
                          <td className="py-3 px-2 font-medium">{label(t.hembra)}</td>
                          <td className="py-3 px-2"><ResultadoBadge resultado={t.resultado} /></td>
                          <td className="py-3 px-2">{t.mesesGest ?? "-"}</td>
                          <td className="py-3 px-2">{t.fechaProbableParto ? fmt(t.fechaProbableParto) : "-"}</td>
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

        {/* ─── TAB: Pariciones ─── */}
        <TabsContent value="pariciones">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pariciones</CardTitle>
              <Button onClick={() => setDialogParicion(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nueva parición
              </Button>
            </CardHeader>
            <CardContent>
              {loadPariciones ? (
                <LoadingSpinner />
              ) : pariciones.length === 0 ? (
                <EmptyState text="No hay pariciones registradas." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Fecha</th>
                        <th className="text-left py-3 px-2 font-medium">Madre</th>
                        <th className="text-left py-3 px-2 font-medium">Resultado</th>
                        <th className="text-right py-3 px-2 font-medium">Peso (kg)</th>
                        <th className="text-left py-3 px-2 font-medium">Tipo parto</th>
                        <th className="text-left py-3 px-2 font-medium">Sexo cría</th>
                        <th className="text-left py-3 px-2 font-medium">Padre</th>
                        <th className="text-left py-3 px-2 font-medium">Cría</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pariciones.map((p) => (
                        <tr key={p.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2">{fmt(p.fecha)}</td>
                          <td className="py-3 px-2 font-medium">{label(p.madre)}</td>
                          <td className="py-3 px-2"><PartoBadge resultado={p.resultado} /></td>
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
                          <td className="py-3 px-2">{p.padre ? label(p.padre) : p.padreExterno || "-"}</td>
                          <td className="py-3 px-2">{p.nacido ? label(p.nacido) : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB: Destetes ─── */}
        <TabsContent value="destetes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Destetes</CardTitle>
              <Button onClick={() => setDialogDestete(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nuevo destete
              </Button>
            </CardHeader>
            <CardContent>
              {loadDestetes ? (
                <LoadingSpinner />
              ) : destetes.length === 0 ? (
                <EmptyState text="No hay destetes registrados." />
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
                          <td className="py-3 px-2">{fmt(d.fecha)}</td>
                          <td className="py-3 px-2 font-medium">{label(d.animal)}</td>
                          <td className="py-3 px-2">{d.animal.raza?.nombre || "-"}</td>
                          <td className="py-3 px-2 text-right">{d.pesoKg ?? "-"}</td>
                          <td className="py-3 px-2 text-right">{d.edadDias ?? "-"}</td>
                          <td className="py-3 px-2"><MetodoBadge metodo={d.metodo} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB: Toradas ─── */}
        <TabsContent value="toradas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Temporadas de servicio</CardTitle>
              <Button onClick={() => setDialogTorada(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nueva torada
              </Button>
            </CardHeader>
            <CardContent>
              {loadToradas ? (
                <LoadingSpinner />
              ) : toradas.length === 0 ? (
                <EmptyState text="No hay toradas registradas. Creá una nueva para comenzar." />
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
                          <td className="py-3 px-2"><TipoBadge tipo={t.tipo} /></td>
                          <td className="py-3 px-2">{fmt(t.fechaInicio)}</td>
                          <td className="py-3 px-2">
                            {t.fechaFin ? fmt(t.fechaFin) : (
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
      </Tabs>

      {/* ─── Dialogs ─── */}

      <ServicioDialog
        open={dialogServicio}
        onOpenChange={setDialogServicio}
        hembras={hembras}
        machos={machos}
        toradas={toradas}
        servicios={servicios}
        onSuccess={invalidateAll}
      />

      <TactoDialog
        open={dialogTacto}
        onOpenChange={setDialogTacto}
        hembras={hembras}
        servicios={servicios}
        onSuccess={invalidateAll}
      />

      <ParicionDialog
        open={dialogParicion}
        onOpenChange={setDialogParicion}
        hembras={hembras}
        machos={machos}
        onSuccess={invalidateAll}
      />

      <DesteteDialog
        open={dialogDestete}
        onOpenChange={setDialogDestete}
        animales={allAnimals}
        lotes={lotes}
        onSuccess={invalidateAll}
      />

      <ToradaDialog
        open={dialogTorada}
        onOpenChange={setDialogTorada}
        lotes={lotes}
        onSuccess={invalidateAll}
      />
    </div>
  )
}

// ────────────────────────────────────────────
// Shared small components
// ────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-center py-12 text-muted-foreground">{text}</p>
}

// ────────────────────────────────────────────
// Animal search select (reusable)
// ────────────────────────────────────────────

function AnimalSelect({
  value,
  onChange,
  animals,
  placeholder,
}: {
  value: string
  onChange: (id: string) => void
  animals: AnimalOption[]
  placeholder: string
}) {
  const [search, setSearch] = useState("")
  const filtered = search
    ? animals.filter(
        (a) =>
          (a.caravanaVisual || "").toLowerCase().includes(search.toLowerCase()) ||
          (a.cuig || "").toLowerCase().includes(search.toLowerCase())
      )
    : animals

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <div className="p-2">
          <div className="flex items-center gap-2 px-1 pb-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Buscar caravana..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {filtered.length === 0 && (
          <SelectItem value="__none" disabled>Sin resultados</SelectItem>
        )}
        {filtered.slice(0, 50).map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {label(a)} {a.sexo === "M" ? "(M)" : a.sexo === "F" ? "(H)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ────────────────────────────────────────────
// Dialog: Servicio
// ────────────────────────────────────────────

function ServicioDialog({
  open,
  onOpenChange,
  hembras,
  machos,
  toradas,
  servicios,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  hembras: AnimalOption[]
  machos: AnimalOption[]
  toradas: Torada[]
  servicios: Servicio[]
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    fecha: "", tipo: "natural", hembraId: "", machoId: "",
    toradaId: "", toroNombre: "", loteSemen: "", inseminador: "", observ: "",
  })

  const reset = () => setForm({
    fecha: "", tipo: "natural", hembraId: "", machoId: "",
    toradaId: "", toroNombre: "", loteSemen: "", inseminador: "", observ: "",
  })

  const mutation = useMutation({
    mutationFn: () => postJson("/api/reproduccion/servicios", form),
    onSuccess: () => {
      toast.success("Servicio registrado correctamente")
      reset()
      onOpenChange(false)
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function submit() {
    if (!form.fecha || !form.hembraId) {
      toast.error("Completá los campos requeridos")
      return
    }
    mutation.mutate()
  }

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }))

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo servicio</DialogTitle>
          <DialogDescription>Registrá un servicio (monta natural o IA)</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Fecha *</Label>
              <Input type="date" value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => set({ tipo: v })}>
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
            <AnimalSelect value={form.hembraId} onChange={(v) => set({ hembraId: v })} animals={hembras} placeholder="Seleccioná hembra" />
          </div>
          {form.tipo === "natural" ? (
            <div className="grid gap-2">
              <Label>Macho</Label>
              <AnimalSelect value={form.machoId} onChange={(v) => set({ machoId: v })} animals={machos} placeholder="Seleccioná macho (opcional)" />
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <Label>Nombre del toro (semen)</Label>
                <Input value={form.toroNombre} onChange={(e) => set({ toroNombre: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Lote semen</Label>
                  <Input value={form.loteSemen} onChange={(e) => set({ loteSemen: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Inseminador</Label>
                  <Input value={form.inseminador} onChange={(e) => set({ inseminador: e.target.value })} />
                </div>
              </div>
            </>
          )}
          <div className="grid gap-2">
            <Label>Torada</Label>
            <Select value={form.toradaId} onValueChange={(v) => set({ toradaId: v })}>
              <SelectTrigger><SelectValue placeholder="Asociar a torada (opcional)" /></SelectTrigger>
              <SelectContent>
                {toradas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Observaciones</Label>
            <Input value={form.observ} onChange={(e) => set({ observ: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar servicio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ────────────────────────────────────────────
// Dialog: Tacto
// ────────────────────────────────────────────

function TactoDialog({
  open,
  onOpenChange,
  hembras,
  servicios,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  hembras: AnimalOption[]
  servicios: Servicio[]
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    fecha: "", resultado: "preñada", mesesGest: "", fechaProbableParto: "",
    metodo: "palpacion", veterinario: "", hembraId: "", servicioId: "", observ: "",
  })

  const reset = () => setForm({
    fecha: "", resultado: "preñada", mesesGest: "", fechaProbableParto: "",
    metodo: "palpacion", veterinario: "", hembraId: "", servicioId: "", observ: "",
  })

  const mutation = useMutation({
    mutationFn: () => postJson("/api/reproduccion/tactos", form),
    onSuccess: () => {
      toast.success("Tacto registrado correctamente")
      reset()
      onOpenChange(false)
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function submit() {
    if (!form.fecha || !form.hembraId || !form.resultado) {
      toast.error("Completá los campos requeridos")
      return
    }
    mutation.mutate()
  }

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }))

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo tacto</DialogTitle>
          <DialogDescription>Registrá un diagnóstico de preñez</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Fecha *</Label>
              <Input type="date" value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Resultado *</Label>
              <Select value={form.resultado} onValueChange={(v) => set({ resultado: v })}>
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
            <AnimalSelect value={form.hembraId} onChange={(v) => set({ hembraId: v })} animals={hembras} placeholder="Seleccioná hembra" />
          </div>
          <div className="grid gap-2">
            <Label>Método *</Label>
            <Select value={form.metodo} onValueChange={(v) => set({ metodo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="palpacion">Palpación</SelectItem>
                <SelectItem value="ecografia">Ecografía</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.resultado === "preñada" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Meses gestación</Label>
                <Input type="number" step="0.5" value={form.mesesGest} onChange={(e) => set({ mesesGest: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Fecha prob. parto</Label>
                <Input type="date" value={form.fechaProbableParto} onChange={(e) => set({ fechaProbableParto: e.target.value })} />
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Servicio asociado</Label>
            <Select value={form.servicioId} onValueChange={(v) => set({ servicioId: v })}>
              <SelectTrigger><SelectValue placeholder="Asociar a servicio (opcional)" /></SelectTrigger>
              <SelectContent>
                {servicios.filter((s) => !s.tacto).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {fmt(s.fecha)} - {label(s.hembra)} ({s.tipo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Veterinario</Label>
            <Input value={form.veterinario} onChange={(e) => set({ veterinario: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Observaciones</Label>
            <Input value={form.observ} onChange={(e) => set({ observ: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar tacto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ────────────────────────────────────────────
// Dialog: Parición
// ────────────────────────────────────────────

function ParicionDialog({
  open,
  onOpenChange,
  hembras,
  machos,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  hembras: AnimalOption[]
  machos: AnimalOption[]
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    fecha: "", resultado: "vivo", pesoNacerKg: "", tipoParto: "normal",
    dificultad: "", sexoCria: "", madreId: "", padreId: "", padreExterno: "", observ: "",
  })

  const reset = () => setForm({
    fecha: "", resultado: "vivo", pesoNacerKg: "", tipoParto: "normal",
    dificultad: "", sexoCria: "", madreId: "", padreId: "", padreExterno: "", observ: "",
  })

  const mutation = useMutation({
    mutationFn: () => postJson("/api/reproduccion/pariciones", form),
    onSuccess: () => {
      toast.success("Parición registrada correctamente")
      reset()
      onOpenChange(false)
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function submit() {
    if (!form.fecha || !form.madreId || !form.resultado) {
      toast.error("Completá los campos requeridos")
      return
    }
    mutation.mutate()
  }

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }))

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva parición</DialogTitle>
          <DialogDescription>Registrá un nacimiento</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Fecha *</Label>
              <Input type="date" value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Resultado *</Label>
              <Select value={form.resultado} onValueChange={(v) => set({ resultado: v })}>
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
            <AnimalSelect value={form.madreId} onChange={(v) => set({ madreId: v })} animals={hembras} placeholder="Seleccioná la madre" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Padre (del rodeo)</Label>
              <AnimalSelect value={form.padreId} onChange={(v) => set({ padreId: v })} animals={machos} placeholder="Opcional" />
            </div>
            <div className="grid gap-2">
              <Label>Padre externo</Label>
              <Input placeholder="Nombre toro IA" value={form.padreExterno} onChange={(e) => set({ padreExterno: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Peso nacer (kg)</Label>
              <Input type="number" step="0.1" value={form.pesoNacerKg} onChange={(e) => set({ pesoNacerKg: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Tipo parto</Label>
              <Select value={form.tipoParto} onValueChange={(v) => set({ tipoParto: v })}>
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
              <Select value={form.sexoCria} onValueChange={(v) => set({ sexoCria: v })}>
                <SelectTrigger><SelectValue placeholder="Sexo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Macho</SelectItem>
                  <SelectItem value="F">Hembra</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Dificultad (1-5)</Label>
            <Input type="number" min="1" max="5" value={form.dificultad} onChange={(e) => set({ dificultad: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Observaciones</Label>
            <Input value={form.observ} onChange={(e) => set({ observ: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar parición
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ────────────────────────────────────────────
// Dialog: Destete
// ────────────────────────────────────────────

function DesteteDialog({
  open,
  onOpenChange,
  animales,
  lotes,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  animales: AnimalOption[]
  lotes: LoteOption[]
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    fecha: "", pesoKg: "", edadDias: "", metodo: "tradicional",
    animalId: "", loteDesteteId: "", observ: "",
  })

  const reset = () => setForm({
    fecha: "", pesoKg: "", edadDias: "", metodo: "tradicional",
    animalId: "", loteDesteteId: "", observ: "",
  })

  const mutation = useMutation({
    mutationFn: () => postJson("/api/reproduccion/destetes", form),
    onSuccess: () => {
      toast.success("Destete registrado correctamente")
      reset()
      onOpenChange(false)
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function submit() {
    if (!form.fecha || !form.animalId) {
      toast.error("Completá los campos requeridos")
      return
    }
    mutation.mutate()
  }

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }))

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo destete</DialogTitle>
          <DialogDescription>Registrá un destete</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Fecha *</Label>
            <Input type="date" value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Animal *</Label>
            <AnimalSelect value={form.animalId} onChange={(v) => set({ animalId: v })} animals={animales} placeholder="Seleccioná el animal" />
          </div>
          <div className="grid gap-2">
            <Label>Lote destino</Label>
            <Select value={form.loteDesteteId} onValueChange={(v) => set({ loteDesteteId: v })}>
              <SelectTrigger><SelectValue placeholder="Seleccioná lote destino (opcional)" /></SelectTrigger>
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
              <Label>Peso (kg)</Label>
              <Input type="number" step="0.1" value={form.pesoKg} onChange={(e) => set({ pesoKg: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Edad (días)</Label>
              <Input type="number" value={form.edadDias} onChange={(e) => set({ edadDias: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Método</Label>
            <Select value={form.metodo} onValueChange={(v) => set({ metodo: v })}>
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
            <Label>Observaciones</Label>
            <Input value={form.observ} onChange={(e) => set({ observ: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar destete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ────────────────────────────────────────────
// Dialog: Torada
// ────────────────────────────────────────────

function ToradaDialog({
  open,
  onOpenChange,
  lotes,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  lotes: LoteOption[]
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    nombre: "", fechaInicio: "", fechaFin: "", tipo: "natural",
    cantidadHembras: "", cantidadMachos: "", observ: "", loteId: "",
  })

  const reset = () => setForm({
    nombre: "", fechaInicio: "", fechaFin: "", tipo: "natural",
    cantidadHembras: "", cantidadMachos: "", observ: "", loteId: "",
  })

  const mutation = useMutation({
    mutationFn: () => postJson("/api/reproduccion/toradas", form),
    onSuccess: () => {
      toast.success("Torada creada correctamente")
      reset()
      onOpenChange(false)
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function submit() {
    if (!form.nombre || !form.fechaInicio || !form.loteId) {
      toast.error("Completá los campos requeridos")
      return
    }
    mutation.mutate()
  }

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }))

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva torada</DialogTitle>
          <DialogDescription>Registrá una nueva temporada de servicio</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Nombre *</Label>
            <Input placeholder="Servicio Otoño 2026" value={form.nombre} onChange={(e) => set({ nombre: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Fecha inicio *</Label>
              <Input type="date" value={form.fechaInicio} onChange={(e) => set({ fechaInicio: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Fecha fin</Label>
              <Input type="date" value={form.fechaFin} onChange={(e) => set({ fechaFin: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Tipo *</Label>
            <Select value={form.tipo} onValueChange={(v) => set({ tipo: v })}>
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
            <Select value={form.loteId} onValueChange={(v) => set({ loteId: v })}>
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
              <Label>Cantidad hembras</Label>
              <Input type="number" value={form.cantidadHembras} onChange={(e) => set({ cantidadHembras: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Cantidad machos</Label>
              <Input type="number" value={form.cantidadMachos} onChange={(e) => set({ cantidadMachos: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Observaciones</Label>
            <Input value={form.observ} onChange={(e) => set({ observ: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear torada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
