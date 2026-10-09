"use client"

import { useEffect, useMemo, useState } from "react"
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
import { AplicacionMasivaDialog } from "@/components/sanidad/aplicacion-masiva-dialog"
import { DatosAplicacion, camposExtra, datosExtraIniciales } from "@/components/sanidad/datos-aplicacion"
import { DescuentoStock, camposDescuento, descuentoInicial, postSanidad, textoStock, type EstadoDescuento } from "@/components/sanidad/descuento-stock"
import { exportarLibroSanitario } from "@/components/sanidad/exportar-libro"
import { AnularTratamientoDialog, EditarTratamientoDialog, type TratamientoEditable } from "@/components/sanidad/tratamiento-acciones"
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
  ChevronDown,
  ChevronUp,
  Loader2,
  FileSpreadsheet,
  FileText,
} from "lucide-react"
import { toast } from "sonner"
import { useTenant } from "@/lib/context/tenant-context"
import { usePermissions } from "@/lib/hooks/use-permissions"
import { traerTodosLosAnimales } from "@/lib/ganado/listado-completo"
import { formatoDia, hoyArgentina } from "@/lib/inventario/fechas"
import { esSanitario } from "@/lib/inventario/validation"
import { ETIQUETA_MOTIVO, ETIQUETA_VIA, MOTIVOS_SANIDAD, VIAS_SANIDAD } from "@/lib/sanidad/validation"

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
  carenciaDias: number | null
  veterinario: string | null
  aplicador: string | null
  costo: number | null
  operacionId: string | null
  anuladoAt: string | null
  motivoAnulacion: string | null
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
    retiroDias: number | null
  }
  loteProducto: { id: string; nroLote: string; vencimiento: string | null } | null
  lote: { id: string; nombre: string } | null
}

interface AnimalOption {
  id: string
  especie?: string | null
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
  organizacionId: string | null
  activo?: boolean
  nombre: string
  tipo: string
  unidad: string
  retiroDias?: number | null
  stockTotal: number
  lotes: {
    id: string
    nroLote: string
    vencimiento: string | null
    saldo: number
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

const VIAS = VIAS_SANIDAD.map((v) => ({ value: v, label: ETIQUETA_VIA[v] }))
const MOTIVOS = MOTIVOS_SANIDAD.map((m) => ({ value: m, label: ETIQUETA_MOTIVO[m] }))
const ESPECIES = [["bovino", "Bovinos"], ["ovino", "Ovinos"], ["equino", "Equinos"], ["caprino", "Caprinos"], ["porcino", "Porcinos"]] as const

const UNIDADES = [
  { value: "ml", label: "ml" },
  { value: "cc", label: "cc" },
  { value: "comprimido", label: "Comprimido" },
]

function animalLabel(a: { caravanaVisual: string | null; cuig: string | null; otroId: string | null }) {
  return a.caravanaVisual || a.cuig || a.otroId || "Sin ID"
}

function todayISO() {
  return hoyArgentina()
}

// ---------------------------------------------------------------------------
// Data-fetching helpers
// ---------------------------------------------------------------------------

interface Resumen {
  mes: string
  tratamientosMes: number
  curativosMes: number
  animalesTratadosMes: number
  topProductos: { productoId: string; nombre: string; cantidad: number }[]
  calendario: { mes: string; dias: { dia: string; cantidad: number }[] }
}

interface PorAnimalFila {
  animal: { id: string; caravanaVisual: string | null; cuig: string | null; otroId: string | null }
  cantidad: number
  ultimaFecha: string | null
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) throw new Error(json.error || "No se pudieron cargar los datos")
  return json as T
}

async function fetchBovinos(estId: string): Promise<AnimalOption[]> {
  const data = await traerTodosLosAnimales<any>({ establecimientoId: estId }).catch(() => [])
  return data.map((a: any) => ({
    id: a.id,
    especie: a.especie?.nombre ?? null,
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

async function fetchInventario(): Promise<InventarioProducto[]> {
  const res = await fetch(`/api/inventario?limit=500`)
  if (!res.ok) return []
  const json = await res.json()
  return json.success ? json.data : []
}

/** Valor que se actualiza recién cuando el usuario deja de escribir. */
function useDiferido<T>(valor: T, ms = 300) {
  const [v, setV] = useState(valor)
  useEffect(() => { const t = setTimeout(() => setV(valor), ms); return () => clearTimeout(t) }, [valor, ms])
  return v
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SanidadPage() {
  const { establecimientoActivo, organizacionActiva } = useTenant()
  const estId = establecimientoActivo?.id ?? ""
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState("historial")
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [motivo, setMotivo] = useState("todos")
  const [mesCalendario, setMesCalendario] = useState(() => hoyArgentina().slice(0, 7))
  const [pageAnimal, setPageAnimal] = useState(1)
  const busqueda = useDiferido(search.trim())
  const LIMIT = 20

  const [tratamientoOpen, setTratamientoOpen] = useState(false)
  const [masivaOpen, setMasivaOpen] = useState(false)
  const [especie, setEspecie] = useState("todas")
  const [verAnulados, setVerAnulados] = useState(false)
  const [editando, setEditando] = useState<TratamientoEditable | null>(null)
  const [anulando, setAnulando] = useState<TratamientoEditable | null>(null)
  const [exportando, setExportando] = useState(false)
  const { hasRole } = usePermissions()
  const puedeEditar = hasRole("admin", "encargado", "vet")
  const puedeAnular = hasRole("admin", "encargado")

  // Al cambiar de campo o de filtros, volver a la primera página
  useEffect(() => { setPage(1) }, [estId, busqueda, motivo, especie, verAnulados])

  // Filtros del historial (los mismos para la lista y la exportación)
  const filtros = useMemo(() => {
    const f: Record<string, string> = { establecimientoId: estId }
    if (busqueda) f.q = busqueda
    if (motivo !== "todos") f.motivo = motivo
    if (especie !== "todas") f.especie = especie
    if (verAnulados) f.anulados = "1"
    return f
  }, [estId, busqueda, motivo, especie, verAnulados])

  async function exportar(formato: "excel" | "pdf") {
    setExportando(true)
    try {
      const n = await exportarLibroSanitario(formato, filtros, establecimientoActivo?.nombre ?? "")
      toast.success(`${n} registros exportados`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar")
    } finally { setExportando(false) }
  }
  useEffect(() => { setPageAnimal(1) }, [estId])

  const eventosQuery = useQuery({
    queryKey: ["sanidad", "eventos", filtros, page],
    queryFn: () => getJson<SanidadResponse>(`/api/sanidad?${new URLSearchParams({ ...filtros, page: String(page), limit: String(LIMIT) })}`),
    enabled: !!estId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const resumenQuery = useQuery({
    queryKey: ["sanidad", "resumen", estId, mesCalendario],
    queryFn: () => getJson<{ data: Resumen }>(`/api/sanidad/resumen?establecimientoId=${estId}&mes=${mesCalendario}`).then((r) => r.data),
    enabled: !!estId,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const porAnimalQuery = useQuery({
    queryKey: ["sanidad", "por-animal", estId, pageAnimal],
    queryFn: () => getJson<{ data: PorAnimalFila[]; pagination: { page: number; totalPages: number; total: number } }>(`/api/sanidad/por-animal?establecimientoId=${estId}&page=${pageAnimal}&limit=${LIMIT}`),
    enabled: !!estId && activeTab === "por-animal",
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const bovinosQuery = useQuery({
    queryKey: ["bovinos", estId],
    queryFn: () => fetchBovinos(estId),
    enabled: !!estId && tratamientoOpen,
    staleTime: 60_000,
  })

  const lotesQuery = useQuery({
    queryKey: ["lotes", estId],
    queryFn: () => fetchLotes(estId),
    enabled: !!estId,
    staleTime: 60_000,
  })

  const inventarioQuery = useQuery({
    queryKey: ["inventario", "sanitarios"],
    queryFn: fetchInventario,
    enabled: !!estId,
    staleTime: 60_000,
  })

  const eventos = eventosQuery.data?.data ?? []
  const pagination = eventosQuery.data?.pagination
  const resumen = resumenQuery.data
  const animales = bovinosQuery.data ?? []
  const lotes = lotesQuery.data ?? []
  // Insumos sanitarios activos de la organización del campo (no combustible, semillas…)
  const productos = useMemo(
    () => (inventarioQuery.data ?? []).filter((p) => esSanitario(p.tipo) && p.activo !== false && (!organizacionActiva || p.organizacionId === organizacionActiva.id)),
    [inventarioQuery.data, organizacionActiva],
  )

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sanidad"] })
    queryClient.invalidateQueries({ queryKey: ["inventario"] })
  }

  // --------------- Guard: no establecimiento ---------------

  if (!estId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <p>Seleccioná un establecimiento para ver la sección de Sanidad.</p>
      </div>
    )
  }

  const kpi = (n: number | undefined) => (resumenQuery.isPending ? "…" : n ?? 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <Syringe className="h-8 w-8 text-purple-600" />
            Sanidad
          </h1>
          <p className="text-muted-foreground mt-1">
            Control sanitario y tratamientos veterinarios · {establecimientoActivo?.nombre}
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

      {/* KPI Cards (mes actual, calculados en el servidor) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Tratamientos (mes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">{kpi(resumen?.tratamientosMes)}</div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Animales tratados (mes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{kpi(resumen?.animalesTratadosMes)}</div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Pill className="h-4 w-4" />
              Productos más usados (mes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resumen?.topProductos.length ? (
              <div className="flex flex-wrap gap-1">
                {resumen.topProductos.map((p) => (
                  <Badge key={p.productoId} variant="outline" className="text-xs">
                    {p.nombre} · {p.cantidad}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Casos curativos (mes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(resumen?.curativosMes ?? 0) > 0 ? "text-orange-600" : "text-green-700"}`}>
              {kpi(resumen?.curativosMes)}
            </div>
          </CardContent>
        </Card>
      </div>

      {(eventosQuery.isError || resumenQuery.isError) && (
        <p role="alert" className="erp-error">
          {(eventosQuery.error ?? resumenQuery.error)?.message}{" "}
          <button className="underline" onClick={() => { eventosQuery.refetch(); resumenQuery.refetch() }}>Reintentar</button>
        </p>
      )}

      {/* Tabs */}
      <Card className="border border-border">
        <CardContent className="p-4 md:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 border border-border">
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
                eventos={eventos}
                loading={eventosQuery.isPending}
                search={search}
                onSearch={setSearch}
                motivo={motivo}
                onMotivo={setMotivo}
                especie={especie}
                onEspecie={setEspecie}
                verAnulados={verAnulados}
                onVerAnulados={setVerAnulados}
                exportando={exportando}
                onExportar={exportar}
                acciones={{ puedeEditar, puedeAnular, onEditar: (e) => setEditando(aEditable(e)), onAnular: (e) => setAnulando(aEditable(e)) }}
                page={page}
                totalPages={pagination?.totalPages ?? 1}
                total={pagination?.total ?? 0}
                limit={LIMIT}
                onPageChange={setPage}
              />
            </TabsContent>

            {/* --- Por Animal Tab --- */}
            <TabsContent value="por-animal" className="mt-6">
              <PorAnimalTab
                estId={estId}
                filas={porAnimalQuery.data?.data ?? []}
                loading={porAnimalQuery.isPending}
                page={pageAnimal}
                totalPages={porAnimalQuery.data?.pagination.totalPages ?? 1}
                onPageChange={setPageAnimal}
              />
            </TabsContent>

            {/* --- Calendario Tab --- */}
            <TabsContent value="calendario" className="mt-6">
              <CalendarioTab
                mes={mesCalendario}
                onMes={setMesCalendario}
                dias={resumen?.calendario.mes === mesCalendario ? resumen.calendario.dias : []}
                loading={resumenQuery.isPending}
              />
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
      <AplicacionMasivaDialog
        open={masivaOpen}
        onOpenChange={setMasivaOpen}
        lotes={lotes}
        productos={productos}
        estId={estId}
        onSuccess={invalidate}
      />
      <EditarTratamientoDialog tratamiento={editando} onOpenChange={(o) => !o && setEditando(null)} onGuardado={invalidate} />
      <AnularTratamientoDialog tratamiento={anulando} onOpenChange={(o) => !o && setAnulando(null)} onAnulado={invalidate} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Historial
// ---------------------------------------------------------------------------

function Paginador({ page, totalPages, onPageChange, texto }: { page: number; totalPages: number; onPageChange: (p: number) => void; texto?: string }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-sm text-muted-foreground">{texto}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex items-center px-3 text-sm">{page} / {totalPages}</span>
        <Button variant="outline" size="sm" aria-label="Página siguiente" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

interface AccionesTabla {
  puedeEditar: boolean
  puedeAnular: boolean
  onEditar: (e: EventoSanidad) => void
  onAnular: (e: EventoSanidad) => void
}

const destinoEvento = (ev: EventoSanidad) => (ev.animal ? animalLabel(ev.animal) : ev.lote ? `Grupo ${ev.lote.nombre}${ev.cantidadAnimales ? ` (${ev.cantidadAnimales})` : ""}` : "—")
const aEditable = (ev: EventoSanidad): TratamientoEditable => ({ ...ev, destino: destinoEvento(ev) })

function TablaEventos({ eventos, conAnimal = true, acciones }: { eventos: EventoSanidad[]; conAnimal?: boolean; acciones?: AccionesTabla }) {
  const conAcciones = !!acciones && (acciones.puedeEditar || acciones.puedeAnular)
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            {conAnimal && <TableHead>Animal o grupo</TableHead>}
            <TableHead>Producto</TableHead>
            <TableHead>Dosis</TableHead>
            <TableHead>Vía</TableHead>
            <TableHead>Motivo</TableHead>
            {conAcciones && <TableHead className="w-24"><span className="sr-only">Acciones</span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {eventos.map((ev) => (
            <TableRow key={ev.id} className={ev.anuladoAt ? "text-muted-foreground" : undefined}>
              <TableCell className="whitespace-nowrap">
                <span className={ev.anuladoAt ? "line-through" : undefined}>{formatoDia(ev.fecha)}</span>
                {ev.anuladoAt && <Badge variant="outline" className="ml-2 border-destructive/40 text-destructive" title={ev.motivoAnulacion ?? undefined}>Anulado</Badge>}
              </TableCell>
              {conAnimal && (
                <TableCell className="font-medium">
                  {destinoEvento(ev)}
                  {ev.operacionId && <span className="block text-xs font-normal text-muted-foreground">Aplicación masiva</span>}
                </TableCell>
              )}
              <TableCell>
                <Badge variant="outline">{ev.producto.nombre}</Badge>
                {ev.loteProducto && <span className="ml-1 text-xs text-muted-foreground">lote {ev.loteProducto.nroLote}</span>}
              </TableCell>
              <TableCell>{ev.dosis != null ? `${ev.dosis.toLocaleString("es-AR")} ${ev.unidad || ""}` : "—"}</TableCell>
              <TableCell>{ev.via ? ETIQUETA_VIA[ev.via as keyof typeof ETIQUETA_VIA] ?? ev.via : "—"}</TableCell>
              <TableCell>{ev.motivo ? ETIQUETA_MOTIVO[ev.motivo as keyof typeof ETIQUETA_MOTIVO] ?? ev.motivo : "—"}</TableCell>
              {conAcciones && (
                <TableCell className="whitespace-nowrap text-right">
                  {!ev.anuladoAt && acciones!.puedeEditar && <Button size="sm" variant="ghost" onClick={() => acciones!.onEditar(ev)}>Editar</Button>}
                  {!ev.anuladoAt && acciones!.puedeAnular && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => acciones!.onAnular(ev)}>Anular</Button>}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function HistorialTab({
  eventos,
  loading,
  search,
  onSearch,
  motivo,
  onMotivo,
  especie,
  onEspecie,
  verAnulados,
  onVerAnulados,
  exportando,
  onExportar,
  acciones,
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
  motivo: string
  onMotivo: (v: string) => void
  especie: string
  onEspecie: (v: string) => void
  verAnulados: boolean
  onVerAnulados: (v: boolean) => void
  exportando: boolean
  onExportar: (f: "excel" | "pdf") => void
  acciones: AccionesTabla
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (p: number) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Buscar en el historial"
            placeholder="Buscar por caravana, grupo o producto..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={motivo} onValueChange={onMotivo}>
          <SelectTrigger className="sm:w-48" aria-label="Filtrar por motivo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los motivos</SelectItem>
            {MOTIVOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={especie} onValueChange={onEspecie}>
          <SelectTrigger className="sm:w-44" aria-label="Filtrar por especie"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las especies</SelectItem>
            {ESPECIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verAnulados} onChange={(e) => onVerAnulados(e.target.checked)} />Ver también los anulados</label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={exportando || !total} onClick={() => onExportar("excel")}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
          <Button variant="outline" size="sm" disabled={exportando || !total} onClick={() => onExportar("pdf")}><FileText className="mr-2 h-4 w-4" />PDF</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : eventos.length === 0 ? (
        <div className="text-center py-12">
          <Syringe className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">{search || motivo !== "todos" || especie !== "todas" ? "Ningún tratamiento coincide con la búsqueda" : "No hay tratamientos registrados en este campo"}</p>
        </div>
      ) : (
        <>
          <TablaEventos eventos={eventos} acciones={acciones} />
          <Paginador page={page} totalPages={totalPages} onPageChange={onPageChange} texto={`${(page - 1) * limit + 1}–${Math.min(page * limit, total)} de ${total}`} />
          {totalPages <= 1 && <p className="text-sm text-muted-foreground">{total} {total === 1 ? "tratamiento" : "tratamientos"}</p>}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Por Animal
// ---------------------------------------------------------------------------

function PorAnimalTab({ estId, filas, loading, page, totalPages, onPageChange }: {
  estId: string
  filas: PorAnimalFila[]
  loading: boolean
  page: number
  totalPages: number
  onPageChange: (p: number) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const detalle = useQuery({
    queryKey: ["sanidad", "animal", estId, expanded],
    queryFn: () => getJson<SanidadResponse>(`/api/sanidad?establecimientoId=${estId}&animalId=${expanded}&limit=100`),
    enabled: !!expanded,
    staleTime: 30_000,
  })

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (filas.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground">No hay tratamientos individuales registrados en este campo</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {filas.map((g) => {
        const isOpen = expanded === g.animal.id
        return (
          <div key={g.animal.id} className="border rounded-lg">
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 text-left"
              aria-expanded={isOpen}
              onClick={() => setExpanded(isOpen ? null : g.animal.id)}
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold">{animalLabel(g.animal)}</span>
                <Badge variant="outline">{g.cantidad} tratamiento{g.cantidad !== 1 && "s"}</Badge>
              </div>
              <div className="flex items-center gap-3">
                {g.ultimaFecha && <span className="text-sm text-muted-foreground">Último: {formatoDia(g.ultimaFecha)}</span>}
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>
            {isOpen && (
              <div className="border-t p-4">
                {detalle.isPending ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-600" /> : <TablaEventos eventos={detalle.data?.data ?? []} conAnimal={false} />}
              </div>
            )}
          </div>
        )
      })}
      <Paginador page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Calendario
// ---------------------------------------------------------------------------

function CalendarioTab({ mes, onMes, dias, loading }: { mes: string; onMes: (m: string) => void; dias: { dia: string; cantidad: number }[]; loading: boolean }) {
  const [year, month] = mes.split("-").map(Number) // month 1-12
  const hoy = hoyArgentina()
  const porDia = new Map(dias.map((d) => [Number(d.dia.slice(8, 10)), d.cantidad]))
  // Días del mes y día de la semana del 1.º, en calendario (UTC), sin zona horaria
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstDayOfWeek = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const monthLabel = new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })
  const mover = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1))
    onMes(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`)
  }

  const dayCells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) dayCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) dayCells.push(d)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" aria-label="Mes anterior" onClick={() => mover(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold capitalize">{monthLabel}{loading && <Loader2 className="ml-2 inline h-4 w-4 animate-spin" />}</h3>
        <Button variant="outline" size="sm" aria-label="Mes siguiente" onClick={() => mover(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
            {d}
          </div>
        ))}
        {dayCells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />
          const count = porDia.get(day) || 0
          const isToday = `${mes}-${String(day).padStart(2, "0")}` === hoy
          return (
            <div
              key={day}
              className={`
                relative flex flex-col items-center justify-center rounded-lg p-2 min-h-[56px]
                border transition-colors
                ${isToday ? "border-purple-400 bg-purple-50" : "border-border"}
                ${count > 0 ? "bg-purple-50/50" : ""}
              `}
            >
              <span className={`text-sm ${isToday ? "font-bold text-purple-700" : "text-foreground"}`}>
                {day}
              </span>
              {count > 0 && (
                <Badge className="mt-1 text-[10px] px-1.5 py-0 bg-purple-600 hover:bg-purple-600" title={`${count} tratamientos`}>
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
  const [descuento, setDescuento] = useState<EstadoDescuento>(descuentoInicial)
  const [extra, setExtra] = useState(datosExtraIniciales)
  const [especieBusqueda, setEspecieBusqueda] = useState("todas")
  const producto = productos.find((p) => p.id === productoId)
  const animalesAplicados = animalId ? 1 : lotes.find((l) => l.id === loteId)?.cantidadAnimales ?? 0
  const especiesPresentes = useMemo(() => [...new Set(animales.map((a) => a.especie).filter(Boolean))] as string[], [animales])

  const reset = () => {
    setDescuento(descuentoInicial)
    setExtra(datosExtraIniciales)
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
      .filter((a) => especieBusqueda === "todas" || a.especie?.toLowerCase() === especieBusqueda)
      .filter(
        (a) =>
          a.caravanaVisual?.toLowerCase().includes(q) ||
          a.cuig?.toLowerCase().includes(q) ||
          a.otroId?.toLowerCase().includes(q)
      )
      .slice(0, 10)
  }, [busqueda, animales, especieBusqueda])

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
        ...camposExtra(extra),
        ...camposDescuento(descuento),
      }
      if (animalId) payload.animalId = animalId
      if (loteId) {
        payload.loteId = loteId
        if (animalesAplicados) payload.cantidadAnimales = animalesAplicados
      }
      return postSanidad(payload)
    },
    onSuccess: (json) => {
      toast.success(`Tratamiento registrado correctamente${textoStock(json?.data?.stock)}`)
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
            <div className="flex items-end justify-between gap-2">
              <Label>Animal (buscar por caravana)</Label>
              {especiesPresentes.length > 1 && (
                <select aria-label="Especie del animal" className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={especieBusqueda} onChange={(e) => setEspecieBusqueda(e.target.value)}>
                  <option value="todas">Todas las especies</option>
                  {especiesPresentes.map((e) => <option key={e} value={e.toLowerCase()}>{e}</option>)}
                </select>
              )}
            </div>
            <div className="relative mt-1.5">
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
              <div className="mt-1 border rounded-lg max-h-40 overflow-y-auto bg-card shadow-sm">
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
                    {animalLabel(a)}{a.especie && <span className="ml-2 text-xs text-muted-foreground">{a.especie}</span>}
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

          <DescuentoStock
            producto={producto}
            dosis={dosis}
            unidadDosis={unidad}
            animales={animalesAplicados}
            valor={descuento}
            onChange={setDescuento}
          />

          <DatosAplicacion valor={extra} onChange={setExtra} retiroDias={producto?.retiroDias} />

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
              <Input type="date" max={todayISO()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
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
