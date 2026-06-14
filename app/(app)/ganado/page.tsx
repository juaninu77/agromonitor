"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  RefreshCw,
  Database,
  Download,
  Radio,
  Plus,
  Scale,
  Syringe,
  Zap,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"

import { useGanado } from "@/lib/hooks/use-ganado"
import { useTenant } from "@/lib/context/tenant-context"
import { exportAnimalsToExcel } from "@/lib/utils/export-excel"
import { exportAnimalsToPDF } from "@/lib/utils/export-pdf"

import { HerdOverview } from "./components/herd-overview"
import { AnimalListTab } from "./components/animal-list-tab"
import { AnimalDetailTab } from "./components/animal-detail-tab"
import { ReportsTab } from "./components/reports-tab"
import { ErrorState } from "./components/error-state"
import { AnimalDialog } from "./components/animal-dialog"
import { RegisterDialog } from "./components/register-dialog"
import { QuickRegisterForm } from "./components/quick-register-form"
import { QuickWeighForm } from "./components/quick-weigh-form"
import { QuickHealthForm } from "./components/quick-health-form"

type TabValue = "lista" | "detalle" | "reportes"

export default function GanadoPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const editHandledRef = useRef<string | null>(null)

  const [selectedTab, setSelectedTab] = useState<TabValue>("lista")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAnimalId, setEditingAnimalId] = useState<string | undefined>(undefined)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false)
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false)
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false)
  const [quickWeighOpen, setQuickWeighOpen] = useState(false)
  const [isWeighSubmitting, setIsWeighSubmitting] = useState(false)
  const [quickHealthOpen, setQuickHealthOpen] = useState(false)
  const [isHealthSubmitting, setIsHealthSubmitting] = useState(false)

  const {
    animales,
    stats,
    pagination,
    isLoading,
    error,
    refetch,
    setPage,
    setLimit,
    setOrderBy,
    setOrderDirection,
    orderBy,
    orderDirection,
  } = useGanado()

  const { establecimientos } = useTenant()
  const [totalLotes, setTotalLotes] = useState(0)

  useEffect(() => {
    const countLotes = async () => {
      if (establecimientos.length === 0) {
        setTotalLotes(0)
        return
      }
      try {
        const lotesPromises = establecimientos.map(async (est) => {
          const response = await fetch(`/api/establecimientos/${est.id}/lotes`)
          if (response.ok) {
            const data = await response.json()
            return data.length || 0
          }
          return 0
        })
        const lotesCounts = await Promise.all(lotesPromises)
        setTotalLotes(lotesCounts.reduce((acc, count) => acc + count, 0))
      } catch {
        setTotalLotes(0)
      }
    }
    countLotes()
  }, [establecimientos])

  const dataSource = useMemo(() => {
    return {
      animals: animales.map((a) => ({
        ...a,
        name: a.nombre || a.name || a.caravanaVisual || "Sin nombre",
        tagNumber: a.caravanaVisual || a.tagNumber || "",
        breed: a.raza?.nombre || a.breed || "",
        category: a.categoria?.nombre || a.category || "",
        birthDate: a.fechaNacimiento || a.birthDate || "",
        age: a.edad || a.age || "",
        reproductiveStatus: a.reproductiveStatus || "N/A",
        offspring: a.offspring || 0,
        expectedProgeny: a.expectedProgeny || 0,
        geneticValue: a.geneticValue || 0,
        feedEfficiency: a.feedEfficiency || 0,
        lastVaccination: a.lastVaccination || "",
        nextVaccination: a.nextVaccination || "",
      })),
      herdOverview: {
        totalAnimals: stats?.total || 0,
        breedingCows: stats?.porCategoria?.["vaca"] || 0,
        averageWeight: stats?.pesoPromedio || 0,
        averageDailyGain: 0,
        calvingRate: 0,
      },
    }
  }, [animales, stats])

  const [selectedAnimal, setSelectedAnimal] = useState<any>(null)

  useEffect(() => {
    if (dataSource.animals.length > 0 && !selectedAnimal) {
      setSelectedAnimal(dataSource.animals[0])
    } else if (dataSource.animals.length === 0) {
      setSelectedAnimal(null)
    }
  }, [dataSource.animals])

  const handleAnimalSelect = useCallback((animal: any) => {
    setSelectedAnimal(animal)
    setSelectedTab("detalle")
  }, [])

  const handleSort = useCallback(
    (field: string) => {
      if (orderBy === field) {
        setOrderDirection(orderDirection === "asc" ? "desc" : "asc")
      } else {
        setOrderBy(field)
        setOrderDirection("asc")
      }
    },
    [orderBy, orderDirection, setOrderBy, setOrderDirection]
  )

  const handleAnimalCreated = useCallback(() => {
    refetch()
    setEditingAnimalId(undefined)
    setDialogMode("create")
  }, [refetch])

  const handleOpenCreate = useCallback(() => {
    setDialogMode("create")
    setEditingAnimalId(undefined)
    setDialogOpen(true)
  }, [])

  const handleOpenEdit = useCallback((animalId: string) => {
    setDialogMode("edit")
    setEditingAnimalId(animalId)
    setDialogOpen(true)
  }, [])

  useEffect(() => {
    const editId = searchParams.get("edit")
    if (!editId || editHandledRef.current === editId) return
    editHandledRef.current = editId
    handleOpenEdit(editId)
    router.replace("/ganado", { scroll: false })
  }, [searchParams, router, handleOpenEdit])

  const handleQuickRegister = useCallback(
    async (data: any) => {
      setIsQuickSubmitting(true)
      try {
        const response = await fetch("/api/ganado/bovinos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || "Error al registrar el animal")
        }
        toast.success("Registro Exitoso", {
          description: `Animal #${data.caravanaVisual} registrado correctamente.`,
        })
        refetch()
      } catch (err: any) {
        toast.error("Error de Registro", { description: err.message || "Error inesperado" })
        throw err
      } finally {
        setIsQuickSubmitting(false)
      }
    },
    [refetch]
  )

  const handleQuickWeigh = useCallback(
    async (data: any) => {
      setIsWeighSubmitting(true)
      try {
        const response = await fetch("/api/ganado/pesos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bovinoId: data.animalId,
            peso: data.peso,
            fecha: data.fecha,
            notas: data.notas,
          }),
        })
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || "Error al registrar la pesada")
        }
        toast.success("Peso Registrado", { description: `${data.peso} kg guardado en el historial.` })
        refetch()
      } catch (err: any) {
        toast.error("Error de Pesada", { description: err.message || "Error inesperado" })
        throw err
      } finally {
        setIsWeighSubmitting(false)
      }
    },
    [refetch]
  )

  const handleQuickHealth = useCallback(
    async (data: any) => {
      setIsHealthSubmitting(true)
      try {
        const response = await fetch("/api/ganado/eventos-sanitarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bovinoId: data.animalId,
            tipoEvento: data.tipoEvento,
            descripcion: data.descripcion,
            fecha: data.fecha,
            producto: data.producto,
            dosis: data.dosis,
            veterinario: data.veterinario,
          }),
        })
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || "Error al registrar el evento sanitario")
        }
        toast.success("Evento Sanitario Guardado", { description: `${data.descripcion} registrado correctamente.` })
        refetch()
      } catch (err: any) {
        toast.error("Error Sanitario", { description: err.message || "Error inesperado" })
        throw err
      } finally {
        setIsHealthSubmitting(false)
      }
    },
    [refetch]
  )

  const handleExportExcel = useCallback(
    (filtered: boolean) => {
      const data = filtered ? dataSource.animals : animales
      exportAnimalsToExcel(data, `ganado_${filtered ? "filtrado" : "completo"}_${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success("Exportación completa", { description: `Se exportaron ${data.length} animales a Excel.` })
    },
    [dataSource.animals, animales]
  )

  const handleExportPDF = useCallback(
    (filtered: boolean) => {
      const data = filtered ? dataSource.animals : animales
      exportAnimalsToPDF({
        data,
        filename: `ganado_${filtered ? "filtrado" : "completo"}_${new Date().toISOString().split("T")[0]}.pdf`,
        title: filtered ? "Reporte de Ganado Bovino" : "Reporte Completo de Ganado Bovino",
        subtitle: `${data.length} animales`,
        includeStats: true,
      })
      toast.success("PDF generado", { description: `Se generó el reporte con ${data.length} animales.` })
    },
    [dataSource.animals, animales]
  )

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestión de Ganado Bovino</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-600">Producción de carne y manejo reproductivo integral</p>
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
              <Database className="h-3 w-3 mr-1" />
              Base de datos
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="border-2" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-2">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-2 py-1.5 text-sm font-semibold text-gray-700">Exportar a Excel</div>
              <DropdownMenuItem onClick={() => handleExportExcel(true)}>
                <Download className="h-4 w-4 mr-2" />
                Vista actual ({dataSource.animals.length})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportExcel(false)}>
                <Download className="h-4 w-4 mr-2" />
                Todos ({animales.length})
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-sm font-semibold text-gray-700">Exportar a PDF</div>
              <DropdownMenuItem onClick={() => handleExportPDF(true)}>
                <Download className="h-4 w-4 mr-2" />
                Vista actual ({dataSource.animals.length})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportPDF(false)}>
                <Download className="h-4 w-4 mr-2" />
                Todos ({animales.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setRegisterDialogOpen(true)} className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 border-0 shadow-lg shadow-emerald-100">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Animal
          </Button>
          <Button onClick={() => setQuickWeighOpen(true)} variant="outline" className="border-2 border-blue-600 text-blue-700 hover:bg-blue-50">
            <Scale className="h-4 w-4 mr-2" />
            Pesada
          </Button>
          <Button onClick={() => setQuickHealthOpen(true)} variant="outline" className="border-2 border-purple-600 text-purple-700 hover:bg-purple-50">
            <Syringe className="h-4 w-4 mr-2" />
            Sanidad
          </Button>
        </div>
      </div>

      {error && !isLoading && <ErrorState error={error} onRetry={refetch} />}

      {!error && (
        <HerdOverview data={dataSource.herdOverview} isLoading={isLoading} />
      )}

      {/* Tabs principales */}
      <Card className="border-2 border-gray-200">
        <CardContent className="p-4 md:p-6">
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as TabValue)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 border-2 border-gray-200">
              <TabsTrigger value="lista" className="border-r-2 border-gray-200">Lista de Animales</TabsTrigger>
              <TabsTrigger value="detalle" className="border-r-2 border-gray-200">Detalle Individual</TabsTrigger>
              <TabsTrigger value="reportes">Reportes</TabsTrigger>
            </TabsList>

            <TabsContent value="lista" className="mt-6">
              <AnimalListTab
                animals={dataSource.animals}
                isLoading={isLoading}
                pagination={pagination}
                orderBy={orderBy}
                orderDirection={orderDirection}
                totalLotes={totalLotes}
                onAnimalSelect={handleAnimalSelect}
                onOpenEdit={handleOpenEdit}
                onSort={handleSort}
                onPageChange={setPage}
                onLimitChange={setLimit}
              />
            </TabsContent>

            <TabsContent value="detalle" className="mt-6">
              <AnimalDetailTab
                selectedAnimal={selectedAnimal}
                totalAnimals={dataSource.animals.length}
                onOpenCreate={handleOpenCreate}
              />
            </TabsContent>

            <TabsContent value="reportes" className="mt-6">
              <ReportsTab animals={dataSource.animals} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AnimalDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={handleAnimalCreated} mode={dialogMode} animalId={editingAnimalId} />
      <RegisterDialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen} onSuccess={refetch} />

      <Dialog open={quickRegisterOpen} onOpenChange={setQuickRegisterOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-green-600" />
              Registro Rápido de Animal
            </DialogTitle>
            <DialogDescription>Completa solo los campos esenciales. Podrás agregar más detalles después.</DialogDescription>
          </DialogHeader>
          <QuickRegisterForm onSubmit={handleQuickRegister} isSubmitting={isQuickSubmitting} />
        </DialogContent>
      </Dialog>

      <Dialog open={quickWeighOpen} onOpenChange={setQuickWeighOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-green-600" />
              Pesada Rápida
            </DialogTitle>
            <DialogDescription>Registra el peso actual de un animal de forma rápida</DialogDescription>
          </DialogHeader>
          <QuickWeighForm onSubmit={handleQuickWeigh} isSubmitting={isWeighSubmitting} />
        </DialogContent>
      </Dialog>

      <Dialog open={quickHealthOpen} onOpenChange={setQuickHealthOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Syringe className="h-5 w-5 text-purple-600" />
              Evento Sanitario Rápido
            </DialogTitle>
            <DialogDescription>Registra vacunaciones, tratamientos o curaciones de forma rápida</DialogDescription>
          </DialogHeader>
          <QuickHealthForm onSubmit={handleQuickHealth} isSubmitting={isHealthSubmitting} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
