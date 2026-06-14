"use client"

import { useState, useCallback } from "react"
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
  AlertCircle,
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
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
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

interface RegisterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function RegisterDialog({ open, onOpenChange, onSuccess }: RegisterDialogProps) {
  const [activeTab, setActiveTab] = useState<"single" | "batch">("single")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSingleSubmit = useCallback(async (data: any) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/ganado/bovinos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al registrar el animal')
      }

      onSuccess()
      return response.json()
    } catch (error) {
      toast.error('Error de Registro', {
        description: (
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-slate-900">No se pudo registrar</p>
              <p className="text-xs text-slate-500">
                {error instanceof Error ? error.message : 'Error inesperado'}
              </p>
            </div>
          </div>
        ),
      })
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }, [onSuccess])

  const handleClose = useCallback(() => {
    onOpenChange(false)
    onSuccess() // Refrescar lista
  }, [onOpenChange, onSuccess])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b border-slate-100">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            Registrar Animales
          </DialogTitle>
          <DialogDescription>
            Elige el modo de registro según tu necesidad: individual para detalles completos o masivo para registrar varios animales rápidamente.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100 rounded-xl h-14">
            <TabsTrigger 
              value="single" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm h-full"
            >
              <Zap className="h-4 w-4" />
              <div className="text-left">
                <span className="font-semibold">Individual</span>
                <span className="text-xs text-slate-500 ml-2 hidden sm:inline">Registro detallado</span>
              </div>
            </TabsTrigger>
            <TabsTrigger 
              value="batch" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm h-full"
            >
              <Layers className="h-4 w-4" />
              <div className="text-left">
                <span className="font-semibold">Masivo</span>
                <span className="text-xs text-slate-500 ml-2 hidden sm:inline">Varios animales</span>
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-6">
            <IntuitiveRegisterWizard
              onSubmit={handleSingleSubmit}
              onClose={handleClose}
              isSubmitting={isSubmitting}
            />
          </TabsContent>

          <TabsContent value="batch" className="mt-6">
            <BatchRegisterForm onClose={handleClose} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}


