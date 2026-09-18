"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Plus,
  Scale,
  Syringe,
  MoreHorizontal,
  Search,
  RefreshCw,
  Download,
} from "lucide-react"
import { toast } from "sonner"
import { useTenant } from "@/lib/context/tenant-context"
import { useGanado } from "@/lib/hooks/use-ganado"
import { GanadoScope } from "@/components/ganado/ganado-scope"
import {
  leerEspecie,
  especieLabels,
  cargarTodosLosAnimales,
  type EspecieFiltro,
  type GanadoQuery,
} from "@/lib/ganado/query"
import { HerdOverview } from "./components/herd-overview"
import { AnimalListTab } from "./components/animal-list-tab"
const ReportsTab = dynamic(
  () => import("./components/reports-tab").then((m) => m.ReportsTab),
  { loading: () => <p role="status">Cargando reportes…</p> },
)
import { ErrorState } from "./components/error-state"
import { RegisterDialog } from "./components/register-dialog"
import { AnimalDialog } from "./components/animal-dialog"
import { QuickWeighForm } from "./components/quick-weigh-form"
import { QuickHealthForm } from "./components/quick-health-form"

type CatalogItem = {
  id: string
  nombre: string
  organizacionId: string
  especie?: { nombre: string }
}

export default function GanadoPage() {
  const { establecimientoActivo, organizacionActiva, isLoading } = useTenant()
  const searchParams = useSearchParams()
  const especie = leerEspecie(searchParams.get("especie"))
  if (!establecimientoActivo || !organizacionActiva)
    return (
      <p className="text-muted-foreground" role="status">
        {isLoading
          ? "Cargando campo…"
          : "Seleccioná un campo para ver su ganado."}
      </p>
    )
  return (
    <GanadoScope.Provider value={especie}>
      <GanadoWorkspace
        key={`${establecimientoActivo.id}:${especie}`}
        establecimientoId={establecimientoActivo.id}
        campo={establecimientoActivo.nombre}
        organizacionId={organizacionActiva.id}
        especie={especie}
      />
    </GanadoScope.Provider>
  )
}

function GanadoWorkspace({
  establecimientoId,
  campo,
  organizacionId,
  especie,
}: {
  establecimientoId: string
  campo: string
  organizacionId: string
  especie: EspecieFiltro
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [categoriaId, setCategoriaId] = useState("")
  const [loteId, setLoteId] = useState("")
  const [estadoVital, setEstadoVital] = useState("activo")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [orderBy, setOrderBy] = useState("caravana")
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("asc")
  const [registerOpen, setRegisterOpen] = useState(false)
  const [editingId, setEditingId] = useState<string>()
  const [management, setManagement] = useState<"peso" | "sanidad" | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportController = useRef<AbortController | null>(null)
  useEffect(() => () => exportController.current?.abort(), [])
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusqueda(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])
  const filters: GanadoQuery = {
    establecimientoId,
    especie,
    busqueda,
    categoriaId,
    loteId,
    estadoVital,
    page,
    limit,
    orderBy,
    orderDirection,
  }
  const { animales, stats, pagination, isLoading, error, refetch } =
    useGanado(filters)
  const { data: catalogs, error: catalogError } = useQuery({
    queryKey: ["ganado-filtros", establecimientoId, organizacionId, especie],
    queryFn: async ({ signal }) => {
      const [catResponse, lotResponse] = await Promise.all([
        fetch("/api/categorias", { signal }),
        fetch(`/api/establecimientos/${establecimientoId}/lotes`, { signal }),
      ])
      if (!catResponse.ok || !lotResponse.ok)
        throw new Error("No se pudieron cargar los filtros de categoría y lote")
      const cat = await catResponse.json()
      const lot = await lotResponse.json()
      const matching = (item: CatalogItem) =>
        especie === "todos" || item.especie?.nombre.toLowerCase() === especie
      return {
        categorias: (cat.data as CatalogItem[]).filter(
          (item) => item.organizacionId === organizacionId && matching(item),
        ),
        lotes: (lot as CatalogItem[]).filter(matching),
      }
    },
  })
  useEffect(() => {
    const editId = searchParams.get("edit")
    if (!editId) return
    setEditingId(editId)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("edit")
    params.set("especie", especie)
    router.replace(`/ganado?${params}`, { scroll: false })
  }, [searchParams, router, especie])

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["ganado-lista"] })
  }
  const openAnimal = (animal: { id: string }) =>
    router.push(`/ganado/${animal.id}?especie=${especie}`)
  const onSort = (field: string) => {
    setPage(1)
    setOrderBy(field)
    setOrderDirection(
      orderBy === field && orderDirection === "asc" ? "desc" : "asc",
    )
  }
  const clearFilters = () => {
    setSearch("")
    setBusqueda("")
    setCategoriaId("")
    setLoteId("")
    setEstadoVital("activo")
    setPage(1)
  }
  const hasFilters =
    !!search || !!categoriaId || !!loteId || estadoVital !== "activo"
  const submitManagement = async (data: any) => {
    setSubmitting(true)
    try {
      const response = await fetch(
        management === "peso"
          ? "/api/ganado/pesos"
          : "/api/ganado/eventos-sanitarios",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, bovinoId: data.animalId }),
        },
      )
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || "No se pudo guardar el registro")
      toast.success(
        management === "peso"
          ? "Pesada registrada"
          : "Evento sanitario registrado",
      )
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar")
      throw error
    } finally {
      setSubmitting(false)
    }
  }
  const exportAll = async (format: "excel" | "pdf") => {
    setExporting(true)
    const controller = new AbortController()
    exportController.current = controller
    try {
      const data = await cargarTodosLosAnimales(filters, controller.signal)
      if (controller.signal.aborted) return
      const filename = `ganado_${especie}_${new Date().toISOString().slice(0, 10)}`
      if (format === "excel") {
        const { exportAnimalsToExcel } = await import(
          "@/lib/utils/export-excel"
        )
        if (!controller.signal.aborted)
          exportAnimalsToExcel(data, `${filename}.xlsx`)
      } else {
        const { exportAnimalsToPDF } = await import("@/lib/utils/export-pdf")
        if (!controller.signal.aborted)
          exportAnimalsToPDF({
            data,
            filename: `${filename}.pdf`,
            title: `Ganado · ${especieLabels[especie]}`,
            subtitle: `${campo} · ${data.length} animales · filtros de la vista actual`,
            includeStats: true,
          })
      }
      toast.success(`${data.length} animales exportados`)
    } catch (error) {
      if (!controller.signal.aborted)
        toast.error(
          error instanceof Error ? error.message : "No se pudo exportar",
        )
    } finally {
      if (!controller.signal.aborted) setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeading
        title="Ganado"
        description="Consultá tus animales y registrá el trabajo del día."
        context={campo}
        actions={
          <>
            <Button
              size="sm"
              className="h-10"
              onClick={() => setRegisterOpen(true)}
            >
              <Plus className="mr-2 hidden h-4 w-4 sm:block" />
              Registrar
            </Button>
            <Button
              size="sm"
              className="h-10"
              variant="outline"
              onClick={() => setManagement("peso")}
            >
              <Scale className="mr-2 hidden h-4 w-4 sm:block" />
              Pesada
            </Button>
            <Button
              size="sm"
              className="h-10"
              variant="outline"
              onClick={() => setManagement("sanidad")}
            >
              <Syringe className="mr-2 hidden h-4 w-4 sm:block" />
              Sanidad
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10"
                  aria-label={
                    exporting ? "Exportando resultados" : "Más acciones"
                  }
                  disabled={exporting}
                >
                  <MoreHorizontal className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">
                    {exporting ? "Exportando…" : "Más"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={isLoading}
                  onClick={() => refetch()}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Actualizar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isLoading || !!error || !stats?.total}
                  onClick={() => exportAll("excel")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exportar resultados a Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isLoading || !!error || !stats?.total}
                  onClick={() => exportAll("pdf")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exportar resultados a PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-lg border bg-muted p-1"
          role="group"
          aria-label="Especie de ganado"
        >
          {(Object.entries(especieLabels) as [EspecieFiltro, string][]).map(
            ([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={especie === value ? "default" : "ghost"}
                aria-pressed={especie === value}
                onClick={() =>
                  router.replace(`/ganado?especie=${value}`, { scroll: false })
                }
              >
                {label}
              </Button>
            ),
          )}
        </div>
        <p className="hidden text-sm text-muted-foreground sm:block">
          {especie === "todos"
            ? "Todas las especies del campo"
            : `${especieLabels[especie]} de este campo`}
        </p>
      </div>
      <Card>
        <CardContent className="space-y-4 p-4">
          <div
            className="flex flex-wrap items-center gap-2"
            role="search"
            aria-label="Filtros de ganado"
          >
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Buscar ganado"
                placeholder="Caravana, RFID o nombre"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              className="sm:hidden"
              aria-expanded={showFilters}
              aria-controls="ganado-filtros-extra"
              onClick={() => setShowFilters((v) => !v)}
            >
              Filtros
              {categoriaId || loteId || estadoVital !== "activo" ? " •" : ""}
            </Button>
            <div
              id="ganado-filtros-extra"
              className={`${showFilters ? "flex" : "hidden"} w-full flex-wrap gap-2 sm:flex sm:w-auto`}
            >
              <Select
                value={categoriaId || "todos"}
                onValueChange={(v) => {
                  setCategoriaId(v === "todos" ? "" : v)
                  setPage(1)
                }}
              >
                <SelectTrigger
                  className="w-full sm:w-44"
                  aria-label="Categoría"
                >
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas las categorías</SelectItem>
                  {catalogs?.categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                      {especie === "todos" ? ` · ${c.especie?.nombre}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={loteId || "todos"}
                onValueChange={(v) => {
                  setLoteId(v === "todos" ? "" : v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full sm:w-44" aria-label="Lote">
                  <SelectValue placeholder="Todos los lotes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los lotes</SelectItem>
                  {catalogs?.lotes.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={estadoVital}
                onValueChange={(v) => {
                  setEstadoVital(v)
                  setPage(1)
                }}
              >
                <SelectTrigger
                  className="w-full sm:w-36"
                  aria-label="Estado del ganado"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="vendido">Vendidos</SelectItem>
                  <SelectItem value="muerto">Muertos</SelectItem>
                  <SelectItem value="baja">Bajas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </div>
          {catalogError && (
            <p className="text-sm text-destructive" role="alert">
              {catalogError.message}
            </p>
          )}
          <HerdOverview
            stats={stats}
            isLoading={isLoading || search !== busqueda}
          />
          {error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : (
            <Tabs defaultValue="lista">
              <TabsList aria-label="Vista de ganado">
                <TabsTrigger value="lista">Animales</TabsTrigger>
                <TabsTrigger value="reportes">Reportes</TabsTrigger>
              </TabsList>
              <TabsContent value="lista" className="mt-4">
                <AnimalListTab
                  animals={animales}
                  isLoading={isLoading || search !== busqueda}
                  pagination={pagination}
                  orderBy={orderBy}
                  orderDirection={orderDirection}
                  onSort={onSort}
                  onPageChange={setPage}
                  onLimitChange={(v) => {
                    setLimit(v)
                    setPage(1)
                  }}
                  onAnimalSelect={openAnimal}
                  onOpenEdit={setEditingId}
                  onRegister={() => setRegisterOpen(true)}
                  hasFilters={hasFilters}
                />
              </TabsContent>
              <TabsContent value="reportes" className="mt-4">
                <ReportsTab
                  stats={stats}
                  isLoading={isLoading || search !== busqueda}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
      <RegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onSuccess={refresh}
      />
      <AnimalDialog
        key={editingId}
        open={!!editingId}
        onOpenChange={(open) => {
          if (!open) setEditingId(undefined)
        }}
        onSuccess={refresh}
        mode="edit"
        animalId={editingId}
      />
      <Dialog
        open={!!management}
        onOpenChange={(open) => {
          if (!open && !submitting) setManagement(null)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {management === "peso" ? "Registrar pesada" : "Registrar sanidad"}
            </DialogTitle>
            <DialogDescription>
              {campo} · {especieLabels[especie]} · animales activos
            </DialogDescription>
          </DialogHeader>
          {management === "peso" ? (
            <QuickWeighForm
              onSubmit={submitManagement}
              isSubmitting={submitting}
            />
          ) : (
            <QuickHealthForm
              onSubmit={submitManagement}
              isSubmitting={submitting}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
