"use client"
import type { MapSector } from "@/lib/mapa/types"
import { isParcel, livestockTypes, sectorState, waterLabel } from "@/lib/mapa/sector-state"

import { useState, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import MapWorkspace from "@/components/mapa/map-workspace"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SECTOR_TYPES } from "@/lib/mapa/geometry"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/lib/context/tenant-context"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MapPin,
  Plus,
  Leaf,
  Droplets,
  TreePine,
  Scale,
  LayoutGrid,
  Loader2,
  Clock,
  TrendingUp,
  Fence,
  Ruler,
  MoreVertical,
  Pencil,
  Eye,
  AlertCircle,
} from "lucide-react"

// ─── Tipos ───────────────────────────────────────────────

interface Sector extends MapSector {
  version: number
  id: string
  nombre: string
  tipo: string
  superficieHa: number | null
  uso: string | null
  capacidad: number | null
  tieneAgua: boolean
  tieneSombra: boolean
  tieneBalanza: boolean
  descripcion: string | null
  activo: boolean
  movimientosRecientes: number
  pastoreoActivo: {
    id: string
    lote: { id: string; nombre: string }
  } | null
  ultimaMedicion: {
    fecha: string
    alturaPastoCm: number | null
    msKgHa: number | null
    coberturaPct: number | null
  } | null
}

interface Pastoreo {
  id: string
  ingreso: string
  egreso: string | null
  lote: { id: string; nombre: string }
  sector: { id: string; nombre: string }
}

interface LoteSimple {
  id: string
  nombre: string
}

// ─── Constantes ──────────────────────────────────────────

const TIPO_SECTOR_OPTIONS = SECTOR_TYPES.map(([value, label]) => ({ value, label }))

const USO_OPTIONS = [
  { value: "pastoreo", label: "Pastoreo" },
  { value: "encierre", label: "Encierre" },
  { value: "manejo", label: "Manejo" },
  { value: "engorde", label: "Engorde" },
]

const TIPO_BADGE_COLORS: Record<string, string> = {
  potrero: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  corral: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  manga: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  feedlot: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  embarcadero: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  enfermeria: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  otro: "bg-gray-100 text-foreground dark:bg-gray-900 dark:text-gray-200",
}

// ─── Fetchers ────────────────────────────────────────────

async function fetchSectores(estId: string): Promise<Sector[]> {
  const res = await fetch(`/api/sectores?establecimientoId=${estId}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || "Error al cargar sectores")
  return json.data
}

async function fetchPastoreos(estId: string): Promise<Pastoreo[]> {
  const res = await fetch(`/api/pastoreo?establecimientoId=${estId}&activos=true`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || "Error al cargar pastoreos")
  return json.data
}

async function fetchLotes(estId: string): Promise<LoteSimple[]> {
  const res = await fetch(`/api/establecimientos/${estId}/lotes`)
  if (!res.ok) return []
  const json = await res.json()
  return Array.isArray(json) ? json : json.data ?? []
}

// ─── Página principal ────────────────────────────────────

export default function PotrerosPage() {
  const { establecimientoActivo } = useTenant()
  return <PotrerosWorkspace key={establecimientoActivo?.id ?? "sin-campo"} />
}
function PotrerosWorkspace() {
  const router = useRouter()
  const params = useSearchParams()
  const view = params.get("vista") === "lista" ? "lista" : "mapa"
  const setView = (value: string) => router.replace(`/potreros?vista=${value}`, { scroll: false })
  const { establecimientoActivo, isLoading: tenantLoading } = useTenant()
  const queryClient = useQueryClient()
  const estId = establecimientoActivo?.id ?? ""

  const { data: permissions } = useQuery<{ puedeEditar: boolean }>({ queryKey: ["campo-catalogos", estId], enabled: !!estId && view === "lista", queryFn: async () => { const r = await fetch(`/api/campo/catalogos?establecimientoId=${estId}`); if (!r.ok) throw Error("No se pudieron cargar los permisos"); return r.json() } })
  const canEdit = permissions?.puedeEditar ?? false
  const [showSectorDialog, setShowSectorDialog] = useState(false)
  const [editingSector, setEditingSector] = useState<Sector | null>(null)
  const [showMedicionDialog, setShowMedicionDialog] = useState(false)
  const [medicionSectorId, setMedicionSectorId] = useState<string | null>(null)
  const [showAsignarDialog, setShowAsignarDialog] = useState(false)
  const [asignarSectorId, setAsignarSectorId] = useState<string | null>(null)

  // ─── Queries ────────────────

  const {
    data: sectores = [],
    isLoading: loadingSectores,
    error: errorSectores,
  } = useQuery({
    queryKey: ["sectores", estId],
    queryFn: () => fetchSectores(estId),
    enabled: !!estId && view === "lista",
  })

  const { data: pastoreos = [] } = useQuery({
    queryKey: ["pastoreos-activos", estId],
    queryFn: () => fetchPastoreos(estId),
    enabled: !!estId && view === "lista",
  })

  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", estId],
    queryFn: () => fetchLotes(estId),
    enabled: !!estId && view === "lista",
  })

  // ─── Mutations ──────────────

  const crearSectorMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(editingSector ? `/api/sectores/${editingSector.id}` : "/api/sectores", {
        method: editingSector ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, establecimientoId: estId, ...(editingSector ? { version: editingSector.version } : {}) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Error al crear sector")
      return json.data
    },
    onSuccess: () => {
      toast.success(editingSector ? "Sector actualizado" : "Sector creado correctamente")
      queryClient.invalidateQueries({ queryKey: ["sectores", estId] })
      queryClient.invalidateQueries({ queryKey: ["mapa", estId] })
      setShowSectorDialog(false)
      setEditingSector(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const medicionMutation = useMutation({
    mutationFn: async ({
      sectorId,
      ...data
    }: Record<string, unknown> & { sectorId: string }) => {
      const res = await fetch(`/api/sectores/${sectorId}/mediciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Error al registrar medición")
      return json.data
    },
    onSuccess: () => {
      toast.success("Medición registrada correctamente")
      queryClient.invalidateQueries({ queryKey: ["sectores", estId] })
      setShowMedicionDialog(false)
      setMedicionSectorId(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const asignarLoteMutation = useMutation({
    mutationFn: async (data: { loteId: string; sectorId: string }) => {
      const res = await fetch("/api/pastoreo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loteId: data.loteId,
          sectorId: data.sectorId,
          ingreso: new Date().toISOString(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Error al asignar lote")
      return json.data
    },
    onSuccess: () => {
      toast.success("Grupo ubicado en el sector; historial actualizado")
      queryClient.invalidateQueries({ queryKey: ["sectores", estId] })
      queryClient.invalidateQueries({ queryKey: ["pastoreos-activos", estId] })
      queryClient.invalidateQueries({ queryKey: ["mapa", estId] })
      queryClient.invalidateQueries({ queryKey: ["ganado-lista"] })
      setShowAsignarDialog(false)
      setAsignarSectorId(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // ─── KPIs ───────────────────

  const kpis = useMemo(() => {
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    const medicionesEsteMes = sectores.filter(
      (s) =>
        s.ultimaMedicion && new Date(s.ultimaMedicion.fecha) >= inicioMes
    ).length

    return {
      totalSectores: sectores.length,
      superficieTotal: sectores.filter(s => isParcel(s.tipo)).reduce(
        (acc, s) => acc + (s.superficieHa || 0),
        0
      ),
      ocupados: sectores.filter(s => isParcel(s.tipo) && s.bovinos + s.ovinos > 0).length,
      medicionesMes: medicionesEsteMes,
    }
  }, [sectores])

  // ─── Handlers para abrir diálogos ───

  function openMedicion(sectorId: string) {
    setMedicionSectorId(sectorId)
    setShowMedicionDialog(true)
  }

  function openAsignarLote(sectorId: string) {
    setAsignarSectorId(sectorId)
    setShowAsignarDialog(true)
  }

  function openEditSector(sector: Sector) {
    setEditingSector(sector)
    setShowSectorDialog(true)
  }

  function openNewSector() {
    setEditingSector(null)
    setShowSectorDialog(true)
  }

  // ─── Loading / error states ───

  if (tenantLoading || loadingSectores) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!estId) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <MapPin className="h-12 w-12" />
        <p className="text-lg">Seleccioná un establecimiento para ver los potreros.</p>
      </div>
    )
  }

  if (errorSectores) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg text-destructive">Error al cargar sectores</p>
        <Button
          variant="outline"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["sectores", estId] })
          }
        >
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Encabezado ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight md:text-3xl">
            <MapPin className="h-7 w-7 text-primary md:h-8 md:w-8" />
            Potreros y mapa
          </h1>
          <p className="mt-1 text-muted-foreground">
            Ubicá potreros, cultivos e instalaciones y organizá el trabajo del campo.
          </p>
        </div>
        {view === "lista" && <Button onClick={openNewSector} disabled={!canEdit}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo sector
        </Button>}
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList aria-label="Vista de potreros"><TabsTrigger value="mapa">Mapa del campo</TabsTrigger><TabsTrigger value="lista">Sectores y pastoreo</TabsTrigger></TabsList>
        <TabsContent value="mapa"><MapWorkspace fieldId={estId} onList={() => setView("lista")} /></TabsContent>
        <TabsContent value="lista" className="space-y-6">
      {/* ── KPI cards ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total sectores"
          value={kpis.totalSectores}
          icon={<LayoutGrid className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          title="Ha declaradas de parcelas"
          value={`${kpis.superficieTotal.toLocaleString("es-AR", { maximumFractionDigits: 1 })} ha`}
          icon={<TrendingUp className="h-4 w-4 text-amber-600" />}
        />
        <KpiCard
          title="Parcelas con ganado"
          value={kpis.ocupados}
          icon={<Leaf className="h-4 w-4 text-green-600" />}
        />
        <KpiCard
          title="Parcelas medidas este mes"
          value={kpis.medicionesMes}
          icon={<Ruler className="h-4 w-4 text-primary" />}
        />
      </div>

      {/* ── Grid de sectores ── */}
      {sectores.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Fence className="h-12 w-12" />
            <p className="text-lg">No hay sectores registrados.</p>
            <Button onClick={openNewSector} disabled={!canEdit}>
              <Plus className="mr-2 h-4 w-4" /> Crear el primero
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sectores.map((sector) => (
            <SectorCard
              key={sector.id}
              sector={sector}
              onMedir={() => openMedicion(sector.id)}
              onAsignar={() => openAsignarLote(sector.id)}
              onEditar={() => openEditSector(sector)}
              canEdit={canEdit}
              onVer={() => router.replace(`/potreros?vista=mapa&sector=${sector.id}`, { scroll: false })}
            />
          ))}
        </div>
      )}

        </TabsContent>
      </Tabs>
      {/* ── Dialog: Crear / Editar sector ── */}
      <SectorFormDialog
        open={showSectorDialog}
        onOpenChange={(open) => {
          setShowSectorDialog(open)
          if (!open) setEditingSector(null)
        }}
        sector={editingSector}
        saving={crearSectorMutation.isPending}
        onSubmit={(data) => crearSectorMutation.mutate(data)}
      />

      {/* ── Dialog: Medir pasto ── */}
      <MedicionDialog
        open={showMedicionDialog}
        onOpenChange={(open) => {
          setShowMedicionDialog(open)
          if (!open) setMedicionSectorId(null)
        }}
        sectorId={medicionSectorId}
        saving={medicionMutation.isPending}
        onSubmit={(data) => medicionMutation.mutate(data)}
      />

      {/* ── Dialog: Ingresar grupo ── */}
      <AsignarLoteDialog
        open={showAsignarDialog}
        onOpenChange={(open) => {
          setShowAsignarDialog(open)
          if (!open) setAsignarSectorId(null)
        }}
        sectorId={asignarSectorId}
        lotes={lotes}
        saving={asignarLoteMutation.isPending}
        onSubmit={(data) => asignarLoteMutation.mutate(data)}
      />
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string
  value: string | number
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

// ─── Sector Card ─────────────────────────────────────────

function SectorCard({ sector, onMedir, onAsignar, onEditar, onVer, canEdit }: { sector: Sector; onMedir: () => void; onAsignar: () => void; onEditar: () => void; onVer: () => void; canEdit: boolean }) {
  return <Card className="flex flex-col"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><CardTitle className="text-lg">{sector.nombre}</CardTitle><CardDescription>{TIPO_SECTOR_OPTIONS.find(t => t.value === sector.tipo)?.label}</CardDescription></div><Button size="icon" variant="ghost" aria-label={`Editar datos de ${sector.nombre}`} onClick={onEditar} disabled={!canEdit}><Pencil className="h-4 w-4"/></Button></div></CardHeader><CardContent className="space-y-3">
    <p className="text-sm font-medium" style={{color:sectorState(sector).color}}>{sectorState(sector).label}</p>
    {livestockTypes.has(sector.tipo) && <p className="text-sm">{sector.bovinos} bovinos · {sector.ovinos} ovinos</p>}
    {sector.superficieHa != null && <p className="text-sm">{sector.superficieHa} ha declaradas</p>}
    <p className="text-xs text-muted-foreground">{waterLabel(sector.agua)}{sector.agua ? ` · ${new Date(sector.agua.fecha).toLocaleDateString("es-AR")}` : ""}</p>
    {sector.pendientes > 0 && <p className="text-sm text-amber-700">{sector.pendientes} tareas pendientes</p>}
    {sector.ultimaMedicion && <p className="text-xs text-muted-foreground">Última medición: {sector.ultimaMedicion.fecha.slice(0,10)} · {sector.ultimaMedicion.alturaPastoCm ?? "—"} cm</p>}
    <div className="flex flex-wrap gap-2 border-t pt-3"><Button size="sm" variant="outline" onClick={onVer}>Ver en mapa</Button>{isParcel(sector.tipo) && <Button size="sm" variant="outline" onClick={onMedir} disabled={!canEdit}>Medir pasto</Button>}{livestockTypes.has(sector.tipo) && <Button size="sm" onClick={onAsignar} disabled={!canEdit}>Ingresar grupo</Button>}</div>
  </CardContent></Card>
}

function SectorFormDialog({
  open,
  onOpenChange,
  sector,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sector: Sector | null
  saving: boolean
  onSubmit: (data: Record<string, unknown>) => void
}) {
  const isEdit = !!sector

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    onSubmit({
      nombre: fd.get("nombre"),
      tipo: fd.get("tipo"),
      superficieHa: fd.get("superficieHa") || null,
      uso: fd.get("uso") || null,
      capacidad: fd.get("capacidad") || null,
      tieneAgua: fd.get("tieneAgua") === "on",
      tieneSombra: fd.get("tieneSombra") === "on",
      tieneBalanza: fd.get("tieneBalanza") === "on",
      descripcion: fd.get("descripcion") || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Sector" : "Nuevo Sector"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modificá los datos del sector."
              : "Creá un potrero, corral u otro sector del establecimiento."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sec-nombre">Nombre *</Label>
              <Input
                id="sec-nombre"
                name="nombre"
                required
                defaultValue={sector?.nombre ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sec-tipo">Tipo *</Label>
              <select
                id="sec-tipo"
                name="tipo"
                required
                defaultValue={sector?.tipo ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Seleccionar...</option>
                {TIPO_SECTOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sec-sup">Superficie (ha)</Label>
              <Input
                id="sec-sup"
                name="superficieHa"
                type="number"
                step="0.01"
                min="0"
                defaultValue={sector?.superficieHa ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sec-cap">Capacidad</Label>
              <Input
                id="sec-cap"
                name="capacidad"
                type="number"
                min="0"
                defaultValue={sector?.capacidad ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sec-uso">Uso</Label>
              <select
                id="sec-uso"
                name="uso"
                defaultValue={sector?.uso ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Ninguno</option>
                {USO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="tieneAgua"
                defaultChecked={sector?.tieneAgua}
                className="rounded"
              />
              <Droplets className="h-4 w-4 text-blue-500" /> Agua
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="tieneSombra"
                defaultChecked={sector?.tieneSombra}
                className="rounded"
              />
              <TreePine className="h-4 w-4 text-green-600" /> Sombra
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="tieneBalanza"
                defaultChecked={sector?.tieneBalanza}
                className="rounded"
              />
              <Scale className="h-4 w-4 text-amber-600" /> Balanza
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sec-desc">Descripción</Label>
            <Textarea
              id="sec-desc"
              name="descripcion"
              rows={2}
              defaultValue={sector?.descripcion ?? ""}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear Sector"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dialog: Medir pasto ─────────────────────────────────

function MedicionDialog({
  open,
  onOpenChange,
  sectorId,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sectorId: string | null
  saving: boolean
  onSubmit: (data: Record<string, unknown> & { sectorId: string }) => void
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!sectorId) return
    const fd = new FormData(e.currentTarget)
    onSubmit({
      sectorId,
      fecha: fd.get("fecha") || new Date().toISOString().split("T")[0],
      alturaPastoCm: fd.get("alturaPastoCm") || null,
      msKgHa: fd.get("msKgHa") || null,
      coberturaPct: fd.get("coberturaPct") || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Medir pasto</DialogTitle>
          <DialogDescription>
            Registrá una medición de pasto para este sector.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="med-fecha">Fecha</Label>
            <Input
              id="med-fecha"
              name="fecha"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="med-altura">Altura de pasto (cm) *</Label>
            <Input
              id="med-altura"
              name="alturaPastoCm"
              type="number"
              step="0.1"
              min="0"
              required
              placeholder="Ej: 15.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="med-ms">MS (kg/ha)</Label>
              <Input
                id="med-ms"
                name="msKgHa"
                type="number"
                step="0.1"
                min="0"
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="med-cob">Cobertura (%)</Label>
              <Input
                id="med-cob"
                name="coberturaPct"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="0–100"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar medición
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dialog: Ingresar grupo ────────────────────────────────

function AsignarLoteDialog({
  open,
  onOpenChange,
  sectorId,
  lotes,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sectorId: string | null
  lotes: LoteSimple[]
  saving: boolean
  onSubmit: (data: { loteId: string; sectorId: string }) => void
}) {
  const [selectedLoteId, setSelectedLoteId] = useState("")

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!sectorId || !selectedLoteId) return
    onSubmit({ loteId: selectedLoteId, sectorId })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) setSelectedLoteId("")
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ingresar grupo de animales</DialogTitle>
          <DialogDescription>
            Confirma el ingreso de todos los animales activos del grupo. Actualiza su ubicación y, en parcelas, inicia el pastoreo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Grupo de animales *</Label>
            {lotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay grupos de animales disponibles en este campo.
              </p>
            ) : (
              <Select
                value={selectedLoteId}
                onValueChange={setSelectedLoteId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar grupo..." />
                </SelectTrigger>
                <SelectContent>
                  {lotes.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !selectedLoteId || lotes.length === 0}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ingresar grupo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
