"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  MapPin,
  Plus,
  ArrowRightLeft,
  Leaf,
  Droplets,
  TreePine,
  Scale,
  LayoutGrid,
  Loader2,
  MoveRight,
  Clock,
  TrendingUp,
  Fence,
} from "lucide-react"

// ============================================
// TIPOS
// ============================================

interface Sector {
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

interface Movimiento {
  id: string
  fecha: string
  motivo: string | null
  observ: string | null
  cantidadAnimales: number | null
  animal: { id: string; caravanaVisual: string | null; otroId: string | null; cuig: string | null } | null
  lote: { id: string; nombre: string } | null
  origenSector: { id: string; nombre: string; tipo: string } | null
  destinoSector: { id: string; nombre: string; tipo: string }
}

interface Pastoreo {
  id: string
  ingreso: string
  egreso: string | null
  animalesPromedio: number | null
  observ: string | null
  lote: { id: string; nombre: string; tipo: string }
  sector: { id: string; nombre: string; tipo: string }
}

interface LoteSimple {
  id: string
  nombre: string
}

// ============================================
// CONSTANTES
// ============================================

const TIPO_SECTOR_OPTIONS = [
  { value: "potrero", label: "Potrero" },
  { value: "corral", label: "Corral" },
  { value: "manga", label: "Manga" },
  { value: "feedlot", label: "Feedlot" },
  { value: "embarcadero", label: "Embarcadero" },
  { value: "enfermeria", label: "Enfermería" },
  { value: "otro", label: "Otro" },
]

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
  otro: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
}

// ============================================
// PÁGINA PRINCIPAL
// ============================================

export default function PotrerosPage() {
  const { establecimientoActivo, isLoading: tenantLoading } = useTenant()

  const [sectores, setSectores] = useState<Sector[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [pastoreos, setPastoreos] = useState<Pastoreo[]>([])
  const [lotes, setLotes] = useState<LoteSimple[]>([])
  const [loading, setLoading] = useState(true)

  const [showSectorDialog, setShowSectorDialog] = useState(false)
  const [showMovimientoDialog, setShowMovimientoDialog] = useState(false)
  const [showPastoreoDialog, setShowPastoreoDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  const estId = establecimientoActivo?.id

  // ---- Fetch helpers ----
  const fetchSectores = useCallback(async () => {
    if (!estId) return
    try {
      const res = await fetch(`/api/sectores?establecimientoId=${estId}`)
      const json = await res.json()
      if (json.success) setSectores(json.data)
    } catch {
      toast.error("Error al cargar sectores")
    }
  }, [estId])

  const fetchMovimientos = useCallback(async () => {
    if (!estId) return
    try {
      const res = await fetch(`/api/movimientos?establecimientoId=${estId}`)
      const json = await res.json()
      if (json.success) setMovimientos(json.data)
    } catch {
      toast.error("Error al cargar movimientos")
    }
  }, [estId])

  const fetchPastoreos = useCallback(async () => {
    if (!estId) return
    try {
      const res = await fetch(`/api/pastoreo?establecimientoId=${estId}`)
      const json = await res.json()
      if (json.success) setPastoreos(json.data)
    } catch {
      toast.error("Error al cargar pastoreos")
    }
  }, [estId])

  const fetchLotes = useCallback(async () => {
    if (!estId) return
    try {
      const res = await fetch(`/api/establecimientos/${estId}/lotes`)
      const json = await res.json()
      if (Array.isArray(json)) setLotes(json)
      else if (json.data) setLotes(json.data)
    } catch {
      /* lotes opcionales */
    }
  }, [estId])

  useEffect(() => {
    if (!estId) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      fetchSectores(),
      fetchMovimientos(),
      fetchPastoreos(),
      fetchLotes(),
    ]).finally(() => setLoading(false))
  }, [estId, fetchSectores, fetchMovimientos, fetchPastoreos, fetchLotes])

  // ---- KPIs ----
  const kpis = useMemo(() => {
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    return {
      totalSectores: sectores.length,
      conPastoreoActivo: sectores.filter((s) => s.pastoreoActivo).length,
      movimientosMes: movimientos.filter(
        (m) => new Date(m.fecha) >= inicioMes
      ).length,
      superficieTotal: sectores.reduce(
        (acc, s) => acc + (s.superficieHa || 0),
        0
      ),
    }
  }, [sectores, movimientos])

  // ---- Handlers ----
  async function handleCrearSector(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch("/api/sectores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: fd.get("nombre"),
          tipo: fd.get("tipo"),
          superficieHa: fd.get("superficieHa") || null,
          uso: fd.get("uso") || null,
          capacidad: fd.get("capacidad") || null,
          tieneAgua: fd.get("tieneAgua") === "on",
          tieneSombra: fd.get("tieneSombra") === "on",
          tieneBalanza: fd.get("tieneBalanza") === "on",
          descripcion: fd.get("descripcion") || null,
          establecimientoId: estId,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Error al crear sector")
      toast.success("Sector creado correctamente")
      setShowSectorDialog(false)
      fetchSectores()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCrearMovimiento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch("/api/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animalId: null,
          loteId: fd.get("loteId") || null,
          cantidadAnimales: fd.get("cantidadAnimales") || null,
          origenSectorId: fd.get("origenSectorId") || null,
          destinoSectorId: fd.get("destinoSectorId"),
          motivo: fd.get("motivo") || null,
          observ: fd.get("observ") || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Error al crear movimiento")
      toast.success("Movimiento registrado")
      setShowMovimientoDialog(false)
      fetchMovimientos()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCrearPastoreo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch("/api/pastoreo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loteId: fd.get("loteId"),
          sectorId: fd.get("sectorId"),
          ingreso: fd.get("ingreso") || new Date().toISOString(),
          animalesPromedio: fd.get("animalesPromedio") || null,
          observ: fd.get("observ") || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Error al crear pastoreo")
      toast.success("Pastoreo registrado")
      setShowPastoreoDialog(false)
      fetchPastoreos()
      fetchSectores()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ---- Renderizado ----
  if (tenantLoading || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!estId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Selecciona un establecimiento para ver los potreros.
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <MapPin className="h-8 w-8 text-primary" />
          Potreros y Movimientos
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestión de sectores, movimientos de hacienda y pastoreo
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Potreros"
          value={kpis.totalSectores}
          icon={<LayoutGrid className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          title="Pastoreo Activo"
          value={kpis.conPastoreoActivo}
          icon={<Leaf className="h-4 w-4 text-green-600" />}
        />
        <KpiCard
          title="Movimientos (mes)"
          value={kpis.movimientosMes}
          icon={<ArrowRightLeft className="h-4 w-4 text-blue-600" />}
        />
        <KpiCard
          title="Superficie Total"
          value={`${kpis.superficieTotal.toLocaleString("es-AR")} ha`}
          icon={<TrendingUp className="h-4 w-4 text-amber-600" />}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="potreros" className="space-y-4">
        <TabsList>
          <TabsTrigger value="potreros" className="gap-1.5">
            <Fence className="h-4 w-4" /> Potreros
          </TabsTrigger>
          <TabsTrigger value="movimientos" className="gap-1.5">
            <ArrowRightLeft className="h-4 w-4" /> Movimientos
          </TabsTrigger>
          <TabsTrigger value="pastoreo" className="gap-1.5">
            <Leaf className="h-4 w-4" /> Pastoreo
          </TabsTrigger>
        </TabsList>

        {/* ========== TAB POTREROS ========== */}
        <TabsContent value="potreros" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowSectorDialog(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo Sector
            </Button>
          </div>

          {sectores.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No hay sectores registrados. Crea el primero.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sectores.map((sector) => (
                <SectorCard key={sector.id} sector={sector} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========== TAB MOVIMIENTOS ========== */}
        <TabsContent value="movimientos" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowMovimientoDialog(true)}>
              <Plus className="mr-2 h-4 w-4" /> Registrar Movimiento
            </Button>
          </div>

          {movimientos.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No hay movimientos registrados aún.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Fecha</th>
                        <th className="px-4 py-3 text-left font-medium">Origen</th>
                        <th className="px-4 py-3 text-left font-medium" />
                        <th className="px-4 py-3 text-left font-medium">Destino</th>
                        <th className="px-4 py-3 text-left font-medium">Animal / Lote</th>
                        <th className="px-4 py-3 text-left font-medium">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.map((m) => (
                        <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 whitespace-nowrap">
                            {new Date(m.fecha).toLocaleDateString("es-AR")}
                          </td>
                          <td className="px-4 py-3">
                            {m.origenSector?.nombre ?? (
                              <span className="text-muted-foreground italic">
                                Externo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-1">
                            <MoveRight className="h-4 w-4 text-muted-foreground" />
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {m.destinoSector.nombre}
                          </td>
                          <td className="px-4 py-3">
                            {m.animal
                              ? m.animal.caravanaVisual ||
                                m.animal.otroId ||
                                m.animal.cuig
                              : m.lote
                                ? `Lote: ${m.lote.nombre}`
                                : m.cantidadAnimales
                                  ? `${m.cantidadAnimales} animales`
                                  : "-"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {m.motivo || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ========== TAB PASTOREO ========== */}
        <TabsContent value="pastoreo" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowPastoreoDialog(true)}>
              <Plus className="mr-2 h-4 w-4" /> Registrar Pastoreo
            </Button>
          </div>

          {pastoreos.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No hay eventos de pastoreo registrados.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Estado</th>
                        <th className="px-4 py-3 text-left font-medium">Ingreso</th>
                        <th className="px-4 py-3 text-left font-medium">Egreso</th>
                        <th className="px-4 py-3 text-left font-medium">Lote</th>
                        <th className="px-4 py-3 text-left font-medium">Sector</th>
                        <th className="px-4 py-3 text-left font-medium">Animales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastoreos.map((p) => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3">
                            {p.egreso ? (
                              <Badge variant="secondary">Finalizado</Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                En curso
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {new Date(p.ingreso).toLocaleDateString("es-AR")}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {p.egreso
                              ? new Date(p.egreso).toLocaleDateString("es-AR")
                              : "-"}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {p.lote.nombre}
                          </td>
                          <td className="px-4 py-3">{p.sector.nombre}</td>
                          <td className="px-4 py-3">
                            {p.animalesPromedio ?? "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ========== DIALOG: NUEVO SECTOR ========== */}
      <Dialog open={showSectorDialog} onOpenChange={setShowSectorDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo Sector</DialogTitle>
            <DialogDescription>
              Crea un potrero, corral u otro sector del establecimiento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCrearSector} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sector-nombre">Nombre *</Label>
                <Input id="sector-nombre" name="nombre" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sector-tipo">Tipo *</Label>
                <select
                  id="sector-tipo"
                  name="tipo"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sector-superficie">Superficie (ha)</Label>
                <Input
                  id="sector-superficie"
                  name="superficieHa"
                  type="number"
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sector-capacidad">Capacidad</Label>
                <Input
                  id="sector-capacidad"
                  name="capacidad"
                  type="number"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sector-uso">Uso</Label>
                <select
                  id="sector-uso"
                  name="uso"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                <input type="checkbox" name="tieneAgua" className="rounded" />
                <Droplets className="h-4 w-4 text-blue-500" /> Agua
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="tieneSombra" className="rounded" />
                <TreePine className="h-4 w-4 text-green-600" /> Sombra
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="tieneBalanza"
                  className="rounded"
                />
                <Scale className="h-4 w-4 text-amber-600" /> Balanza
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sector-descripcion">Descripción</Label>
              <Input id="sector-descripcion" name="descripcion" />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSectorDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Sector
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========== DIALOG: NUEVO MOVIMIENTO ========== */}
      <Dialog
        open={showMovimientoDialog}
        onOpenChange={setShowMovimientoDialog}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Movimiento</DialogTitle>
            <DialogDescription>
              Registra un movimiento de hacienda entre sectores.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCrearMovimiento} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mov-origen">Sector Origen</Label>
                <select
                  id="mov-origen"
                  name="origenSectorId"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Externo / No aplica</option>
                  {sectores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mov-destino">Sector Destino *</Label>
                <select
                  id="mov-destino"
                  name="destinoSectorId"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {sectores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mov-lote">Lote</Label>
                <select
                  id="mov-lote"
                  name="loteId"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Ninguno</option>
                  {lotes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mov-cantidad">Cant. Animales</Label>
                <Input
                  id="mov-cantidad"
                  name="cantidadAnimales"
                  type="number"
                  min="1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mov-motivo">Motivo</Label>
              <Input id="mov-motivo" name="motivo" placeholder="Ej: Rotación de pastoreo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mov-observ">Observaciones</Label>
              <Input id="mov-observ" name="observ" />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowMovimientoDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========== DIALOG: NUEVO PASTOREO ========== */}
      <Dialog open={showPastoreoDialog} onOpenChange={setShowPastoreoDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Pastoreo</DialogTitle>
            <DialogDescription>
              Registra el ingreso de un lote a un sector para pastoreo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCrearPastoreo} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="past-lote">Lote *</Label>
                <select
                  id="past-lote"
                  name="loteId"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {lotes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="past-sector">Sector *</Label>
                <select
                  id="past-sector"
                  name="sectorId"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {sectores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="past-ingreso">Fecha Ingreso *</Label>
                <Input
                  id="past-ingreso"
                  name="ingreso"
                  type="datetime-local"
                  required
                  defaultValue={new Date().toISOString().slice(0, 16)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="past-animales">Animales Promedio</Label>
                <Input
                  id="past-animales"
                  name="animalesPromedio"
                  type="number"
                  min="1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="past-observ">Observaciones</Label>
              <Input id="past-observ" name="observ" />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPastoreoDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// COMPONENTES AUXILIARES
// ============================================

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

function SectorCard({ sector }: { sector: Sector }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{sector.nombre}</CardTitle>
          <Badge className={TIPO_BADGE_COLORS[sector.tipo] ?? TIPO_BADGE_COLORS.otro}>
            {sector.tipo}
          </Badge>
        </div>
        {sector.descripcion && (
          <CardDescription>{sector.descripcion}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {sector.superficieHa != null && (
            <div>
              <span className="text-muted-foreground">Superficie:</span>{" "}
              <span className="font-medium">{sector.superficieHa} ha</span>
            </div>
          )}
          {sector.capacidad != null && (
            <div>
              <span className="text-muted-foreground">Capacidad:</span>{" "}
              <span className="font-medium">{sector.capacidad} cab.</span>
            </div>
          )}
          {sector.uso && (
            <div>
              <span className="text-muted-foreground">Uso:</span>{" "}
              <span className="font-medium capitalize">{sector.uso}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Movimientos:</span>{" "}
            <span className="font-medium">{sector.movimientosRecientes}</span>
          </div>
        </div>

        {/* Iconos de servicios */}
        <div className="flex items-center gap-3">
          {sector.tieneAgua && (
            <span title="Tiene agua" className="flex items-center gap-1 text-xs text-blue-600">
              <Droplets className="h-4 w-4" /> Agua
            </span>
          )}
          {sector.tieneSombra && (
            <span title="Tiene sombra" className="flex items-center gap-1 text-xs text-green-600">
              <TreePine className="h-4 w-4" /> Sombra
            </span>
          )}
          {sector.tieneBalanza && (
            <span title="Tiene balanza" className="flex items-center gap-1 text-xs text-amber-600">
              <Scale className="h-4 w-4" /> Balanza
            </span>
          )}
        </div>

        {/* Pastoreo activo */}
        {sector.pastoreoActivo && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm dark:border-green-800 dark:bg-green-950">
            <div className="flex items-center gap-1.5 font-medium text-green-800 dark:text-green-200">
              <Leaf className="h-3.5 w-3.5" /> Pastoreo activo
            </div>
            <p className="text-green-700 dark:text-green-300 mt-0.5">
              Lote: {sector.pastoreoActivo.lote.nombre}
            </p>
          </div>
        )}

        {/* Última medición */}
        {sector.ultimaMedicion && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Medición:{" "}
            {new Date(sector.ultimaMedicion.fecha).toLocaleDateString("es-AR")}
            {sector.ultimaMedicion.alturaPastoCm != null &&
              ` | ${sector.ultimaMedicion.alturaPastoCm} cm`}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
