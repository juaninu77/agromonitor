"use client"

import { useGanadoScope } from "@/components/ganado/ganado-scope"
import { especieLabels } from "@/lib/ganado/query"

import { useState, useCallback, useEffect } from "react"
import dynamic from "next/dynamic"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  Zap,
  Layers,
  FileSpreadsheet,
  Sparkles,
  Loader2,
} from "lucide-react"

const IntuitiveRegisterWizard = dynamic(
  () =>
    import("./intuitive-register-wizard").then((m) => ({
      default: m.IntuitiveRegisterWizard,
    })),
  {
    loading: () => (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-slate-500">Cargando asistente de registro…</p>
      </div>
    ),
  }
)

const BatchRegisterForm = dynamic(
  () =>
    import("./batch-register-form").then((m) => ({
      default: m.BatchRegisterForm,
    })),
  {
    loading: () => (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-slate-600" />
        <p className="text-sm text-slate-500">Cargando registro masivo…</p>
      </div>
    ),
  }
)

const ImportAnimalesForm = dynamic(
  () =>
    import("./import-animales-form").then((m) => ({
      default: m.ImportAnimalesForm,
    })),
  {
    loading: () => (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-slate-600" />
        <p className="text-sm text-slate-500">Cargando importación…</p>
      </div>
    ),
  }
)

interface RegisterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function RegisterDialog({ open, onOpenChange, onSuccess }: RegisterDialogProps) {
  const { establecimientoId, especie } = useGanadoScope()
  const [activeTab, setActiveTab] = useState<"single" | "batch" | "import">("single")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [huboAltas, setHuboAltas] = useState(false)
  const busy = isSubmitting || batchBusy

  // Al reabrir, volver al estado inicial
  useEffect(() => {
    if (open) {
      setDirty(false)
      setHuboAltas(false)
    }
  }, [open])

  const marcarAlta = useCallback(() => {
    setHuboAltas(true)
    onSuccess()
  }, [onSuccess])

  const handleSingleSubmit = useCallback(async (data: Record<string, unknown>) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/ganado/bovinos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, establecimientoId }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Error al registrar el animal')
      }
      marcarAlta()
      return result
    } catch (error) {
      toast.error('No se pudo registrar el animal', {
        description: error instanceof Error ? error.message : 'Error inesperado',
      })
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }, [marcarAlta, establecimientoId])

  const cerrar = useCallback(() => {
    onOpenChange(false)
    if (huboAltas) onSuccess()
  }, [onOpenChange, onSuccess, huboAltas])

  const intentarCerrar = useCallback((next: boolean) => {
    if (next) return onOpenChange(true)
    if (busy) return
    if (dirty && !window.confirm("Tenés animales cargados sin guardar. ¿Cerrar y descartarlos?")) return
    cerrar()
  }, [busy, dirty, cerrar, onOpenChange])

  const cambiarTab = (v: string) => {
    if (busy) return
    if (dirty && !window.confirm("Si cambiás de pestaña se pierde lo que cargaste. ¿Continuar?")) return
    setDirty(false)
    setActiveTab(v as typeof activeTab)
  }

  return (
    <Dialog open={open} onOpenChange={intentarCerrar}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b border-slate-100">
          <DialogTitle className="text-xl font-semibold flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            Registrar animales · {especieLabels[especie]}
          </DialogTitle>
          <DialogDescription>
            Individual para un animal, masivo para varios de la misma categoría o importación desde una planilla.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={cambiarTab}>
          <TabsList className="grid w-full grid-cols-3 p-1 bg-slate-100 rounded-xl h-11">
            <TabsTrigger
              value="single"
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm h-full"
            >
              <Zap className="h-4 w-4" />
              <div className="text-left">
                <span className="font-semibold">Individual</span>
                <span className="text-xs text-slate-500 ml-2 hidden sm:inline">Registro detallado</span>
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="batch"
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm h-full"
            >
              <Layers className="h-4 w-4" />
              <div className="text-left">
                <span className="font-semibold">Masivo</span>
                <span className="text-xs text-slate-500 ml-2 hidden sm:inline">Varios animales</span>
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="import"
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm h-full"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <div className="text-left">
                <span className="font-semibold">Importar</span>
                <span className="text-xs text-slate-500 ml-2 hidden sm:inline">Desde Excel</span>
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-6">
            <IntuitiveRegisterWizard
              onSubmit={handleSingleSubmit}
              onClose={cerrar}
              isSubmitting={isSubmitting}
              onDirtyChange={setDirty}
            />
          </TabsContent>

          <TabsContent value="batch" className="mt-6">
            <BatchRegisterForm onClose={cerrar} onSuccess={marcarAlta} onBusyChange={setBatchBusy} onDirtyChange={setDirty} />
          </TabsContent>

          <TabsContent value="import" className="mt-6">
            <ImportAnimalesForm onClose={cerrar} onSuccess={marcarAlta} onBusyChange={setBatchBusy} onDirtyChange={setDirty} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
