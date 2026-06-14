"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AnimalForm } from "./animal-form"
import { type AnimalFormData } from "@/lib/validations/animal-schema"
import { toast } from "sonner"
import { CheckCircle2, AlertCircle } from "lucide-react"

interface AnimalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  animalId?: string
  initialData?: Partial<AnimalFormData>
  mode?: 'create' | 'edit'
}

export function AnimalDialog({
  open,
  onOpenChange,
  onSuccess,
  animalId,
  initialData,
  mode = 'create'
}: AnimalDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [formData, setFormData] = useState<Partial<AnimalFormData> | undefined>(initialData)

  // Cargar datos del animal si es modo edición
  useEffect(() => {
    if (mode === 'edit' && animalId && open) {
      setIsLoadingData(true)
      fetch(`/api/ganado/bovinos/${animalId}`)
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data) {
            const animal = result.data
            setFormData({
              especieId: animal.especieId || animal.especie?.id || '',
              caravanaVisual: animal.caravanaVisual || '',
              caravanaRfid: animal.caravanaRfid || '',
              cuig: animal.cuig || '',
              otroId: animal.otroId || '',
              razaId: animal.razaId || '',
              categoriaId: animal.categoriaId || '',
              sexo: animal.sexo,
              fechaNacimiento: animal.fechaNacimiento ? new Date(animal.fechaNacimiento).toISOString().split('T')[0] : '',
              origen: animal.origen || 'cria_propia',
              colorManto: animal.colorManto || '',
              estadoCastracion: animal.estadoCastracion || '',
              denticion: animal.denticion || '',
              esCabana: animal.esCabana || false,
              registroCabana: animal.registroCabana || '',
              notas: animal.notas || '',
            })
          }
        })
        .catch(error => {
          console.error('Error loading animal:', error)
          toast.error('Error al cargar datos del animal')
        })
        .finally(() => {
          setIsLoadingData(false)
        })
    }
  }, [mode, animalId, open])

  const handleSubmit = async (data: AnimalFormData) => {
    try {
      setIsSubmitting(true)

      const url = mode === 'edit' && animalId
        ? `/api/ganado/bovinos/${animalId}`
        : '/api/ganado/bovinos'

      const method = mode === 'edit' ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Error al ${mode === 'edit' ? 'actualizar' : 'registrar'} el animal`)
      }

      if (result.success) {
        toast.success(
          mode === 'edit' ? 'Actualización Exitosa' : 'Registro Completado',
          {
            description: (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="font-bold text-slate-900">#{data.caravanaVisual}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {mode === 'edit' 
                    ? 'Los datos del animal han sido actualizados correctamente.' 
                    : 'El animal ha sido agregado exitosamente al rodeo.'}
                </p>
              </div>
            ),
            duration: 5000,
          }
        )
        onOpenChange(false)
        onSuccess()
      } else {
        throw new Error(result.error || `Error al ${mode === 'edit' ? 'actualizar' : 'registrar'} el animal`)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Ocurrió un Problema', {
        description: (
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-slate-900">
                {mode === 'edit' ? 'No se pudo actualizar' : 'No se pudo registrar'}
              </p>
              <p className="text-xs text-slate-500">
                {error instanceof Error ? error.message : 'Error interno del servidor. Intente nuevamente.'}
              </p>
            </div>
          </div>
        ),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {mode === 'edit' ? 'Editar Animal' : 'Registrar Nuevo Animal'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Modifique los datos del animal. Los campos marcados con * son obligatorios.'
              : 'Complete el formulario para agregar un nuevo animal bovino al sistema. Los campos marcados con * son obligatorios.'
            }
          </DialogDescription>
        </DialogHeader>

        {isLoadingData ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando datos del animal...</p>
            </div>
          </div>
        ) : (
          <AnimalForm
            key={`${mode}-${animalId ?? "create"}`}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            initialData={formData}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
