"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, 
  Tag, 
  CheckCircle2,
  Plus,
  Trash2,
  Scale,
  AlertCircle,
  Layers,
  Zap,
  Info,
  Download,
  ArrowRight,
  Crown,
  Heart
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface Raza {
  id: string
  nombre: string
}

interface Categoria {
  id: string
  nombre: string
  sexo?: string | null
}

interface AnimalEntry {
  id: string
  caravanaVisual: string
  pesoInicial?: number
  status: 'pending' | 'saving' | 'saved' | 'error'
  error?: string
}

interface BatchRegisterFormProps {
  onClose: () => void
}

export function BatchRegisterForm({ onClose }: BatchRegisterFormProps) {
  const [step, setStep] = useState<'config' | 'entries'>('config')
  const [razas, setRazas] = useState<Raza[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Configuración común
  const [selectedSexo, setSelectedSexo] = useState<"M" | "F">("M")
  const [selectedRaza, setSelectedRaza] = useState("")
  const [selectedCategoria, setSelectedCategoria] = useState("")
  const [origen, setOrigen] = useState<"cria_propia" | "compra" | "otro">("cria_propia")

  // Lista de animales
  const [entries, setEntries] = useState<AnimalEntry[]>([
    { id: crypto.randomUUID(), caravanaVisual: "", status: 'pending' }
  ])

  const lastInputRef = useRef<HTMLInputElement>(null)

  // Cargar datos
  useEffect(() => {
    Promise.all([
      fetch('/api/razas').then(r => r.json()),
      fetch('/api/categorias?especie=bovino').then(r => r.json())
    ]).then(([razasData, categoriasData]) => {
      if (razasData.success) setRazas(razasData.data)
      if (categoriasData.success) setCategorias(categoriasData.data)
    }).finally(() => setLoading(false))
  }, [])

  // Filtrar categorías por sexo
  const categoriasFiltradas = categorias.filter(cat => {
    if (cat.sexo === null) return true
    return cat.sexo === selectedSexo
  })

  // Agregar nueva entrada
  const addEntry = () => {
    const newEntry: AnimalEntry = {
      id: crypto.randomUUID(),
      caravanaVisual: "",
      status: 'pending'
    }
    setEntries(prev => [...prev, newEntry])
    
    // Focus en el nuevo input después de renderizar
    setTimeout(() => {
      lastInputRef.current?.focus()
    }, 50)
  }

  // Eliminar entrada
  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(prev => prev.filter(e => e.id !== id))
    }
  }

  // Actualizar entrada
  const updateEntry = (id: string, field: keyof AnimalEntry, value: any) => {
    setEntries(prev => prev.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ))
  }

  // Manejar Enter en input de caravana
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (index === entries.length - 1) {
        addEntry()
      }
    }
  }

  // Validar configuración
  const isConfigValid = selectedRaza && selectedCategoria

  // Validar entradas
  const validEntries = entries.filter(e => e.caravanaVisual.trim() !== '')
  const hasValidEntries = validEntries.length > 0

  // Guardar todos los animales
  const handleSaveAll = async () => {
    if (!hasValidEntries) return

    setIsSaving(true)
    const entriesToSave = entries.filter(e => e.caravanaVisual.trim() !== '' && e.status !== 'saved')

    let savedCount = 0
    let errorCount = 0

    for (const entry of entriesToSave) {
      // Actualizar estado a "saving"
      setEntries(prev => prev.map(e => 
        e.id === entry.id ? { ...e, status: 'saving' } : e
      ))

      try {
        const response = await fetch('/api/ganado/bovinos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caravanaVisual: entry.caravanaVisual,
            razaId: selectedRaza,
            categoriaId: selectedCategoria,
            sexo: selectedSexo,
            origen,
            pesoInicial: entry.pesoInicial,
          }),
        })

        if (response.ok) {
          setEntries(prev => prev.map(e => 
            e.id === entry.id ? { ...e, status: 'saved' } : e
          ))
          savedCount++
        } else {
          const error = await response.json()
          setEntries(prev => prev.map(e => 
            e.id === entry.id ? { ...e, status: 'error', error: error.error || 'Error desconocido' } : e
          ))
          errorCount++
        }
      } catch (error) {
        setEntries(prev => prev.map(e => 
          e.id === entry.id ? { ...e, status: 'error', error: 'Error de conexión' } : e
        ))
        errorCount++
      }
    }

    setIsSaving(false)

    if (savedCount > 0) {
      toast.success(`${savedCount} animal${savedCount > 1 ? 'es' : ''} registrado${savedCount > 1 ? 's' : ''}`, {
        description: errorCount > 0 
          ? `${errorCount} con errores. Revisa la lista.`
          : 'Todos los animales fueron guardados correctamente.'
      })
    }

    if (errorCount > 0 && savedCount === 0) {
      toast.error('Error al registrar animales', {
        description: 'Ningún animal pudo ser guardado. Revisa los errores.'
      })
    }
  }

  // Contar estados
  const savedCount = entries.filter(e => e.status === 'saved').length
  const errorCount = entries.filter(e => e.status === 'error').length
  const pendingCount = validEntries.length - savedCount

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="mt-3 text-slate-500">Preparando formulario...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 rounded-xl">
          <Layers className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Registro Masivo</h2>
          <p className="text-sm text-slate-500">
            Registra múltiples animales con la misma raza y categoría
          </p>
        </div>
      </div>

      {step === 'config' && (
        <Card className="border-2 border-slate-100">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-5 w-5 text-slate-500" />
              Configuración común para todos los animales
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Sexo */}
            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Sexo</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSexo("M")
                    setSelectedCategoria("")
                  }}
                  className={cn(
                    "flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all",
                    selectedSexo === "M"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 hover:border-slate-300 text-slate-500"
                  )}
                >
                  <Crown className="h-6 w-6" />
                  <span className="font-bold">MACHO</span>
                  {selectedSexo === "M" && <CheckCircle2 className="h-5 w-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSexo("F")
                    setSelectedCategoria("")
                  }}
                  className={cn(
                    "flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all",
                    selectedSexo === "F"
                      ? "border-pink-600 bg-pink-50 text-pink-700"
                      : "border-slate-200 hover:border-slate-300 text-slate-500"
                  )}
                >
                  <Heart className="h-6 w-6" />
                  <span className="font-bold">HEMBRA</span>
                  {selectedSexo === "F" && <CheckCircle2 className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Raza */}
            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Raza</Label>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {razas.map((raza) => (
                  <button
                    key={raza.id}
                    type="button"
                    onClick={() => setSelectedRaza(raza.id)}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all text-sm font-medium",
                      selectedRaza === raza.id
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    )}
                  >
                    {raza.nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* Categoría */}
            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Categoría</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {categoriasFiltradas.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoria(cat.id)}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all font-medium",
                      selectedCategoria === cat.id
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    )}
                  >
                    {cat.nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* Origen */}
            <div className="space-y-3">
              <Label className="font-bold text-slate-700">Origen</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "cria_propia", label: "Cría propia" },
                  { value: "compra", label: "Compra" },
                  { value: "otro", label: "Otro" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOrigen(opt.value as typeof origen)}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all text-sm font-medium",
                      origen === opt.value
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => setStep('entries')}
              disabled={!isConfigValid}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700"
            >
              Continuar a ingresar caravanas
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'entries' && (
        <>
          {/* Resumen de configuración */}
          <Card className="border-2 border-blue-100 bg-blue-50/50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                    {selectedSexo === "M" ? "Machos" : "Hembras"}
                  </Badge>
                  <span className="text-blue-700">
                    <strong>{razas.find(r => r.id === selectedRaza)?.nombre}</strong> - {categorias.find(c => c.id === selectedCategoria)?.nombre}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('config')}
                  className="text-blue-700 hover:bg-blue-100"
                >
                  Cambiar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de entradas */}
          <Card className="border-2 border-slate-100">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-5 w-5 text-slate-500" />
                  Lista de Caravanas
                </CardTitle>
                <div className="flex items-center gap-2">
                  {savedCount > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-700">
                      {savedCount} guardado{savedCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {errorCount > 0 && (
                    <Badge className="bg-red-100 text-red-700">
                      {errorCount} error{errorCount > 1 ? 'es' : ''}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {entries.map((entry, index) => (
                <div 
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 transition-all",
                    entry.status === 'saved' && "bg-emerald-50 border-emerald-200",
                    entry.status === 'error' && "bg-red-50 border-red-200",
                    entry.status === 'saving' && "bg-blue-50 border-blue-200 animate-pulse",
                    entry.status === 'pending' && "border-slate-200"
                  )}
                >
                  <span className="text-sm font-mono text-slate-400 w-8">
                    #{index + 1}
                  </span>
                  
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="relative">
                      <Input
                        ref={index === entries.length - 1 ? lastInputRef : null}
                        value={entry.caravanaVisual}
                        onChange={(e) => updateEntry(entry.id, 'caravanaVisual', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        placeholder="Número de caravana"
                        disabled={entry.status === 'saved' || entry.status === 'saving'}
                        className={cn(
                          "h-10 border-2",
                          entry.status === 'saved' && "bg-emerald-50 border-emerald-300",
                          entry.status === 'error' && "bg-red-50 border-red-300"
                        )}
                      />
                    </div>
                    
                    <Input
                      type="number"
                      step="0.1"
                      value={entry.pesoInicial || ''}
                      onChange={(e) => updateEntry(entry.id, 'pesoInicial', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="Peso (kg) - opcional"
                      disabled={entry.status === 'saved' || entry.status === 'saving'}
                      className="h-10 border-2"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-24 justify-end">
                    {entry.status === 'saved' && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    )}
                    {entry.status === 'error' && (
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      </div>
                    )}
                    {entry.status === 'saving' && (
                      <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                    )}
                    {entry.status === 'pending' && entries.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEntry(entry.id)}
                        className="h-8 w-8 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Mostrar errores */}
              {entries.filter(e => e.status === 'error').map(entry => (
                <p key={`error-${entry.id}`} className="text-xs text-red-600 ml-11">
                  #{entry.caravanaVisual}: {entry.error}
                </p>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addEntry}
                className="w-full h-10 border-2 border-dashed border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar otro animal
              </Button>
              
              <p className="text-xs text-slate-500 text-center">
                Tip: Presiona Enter en el campo de caravana para agregar otro rápidamente
              </p>
            </CardContent>
          </Card>

          {/* Acciones */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setStep('config')}
              disabled={isSaving}
              className="border-2"
            >
              Volver
            </Button>
            
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">
                {validEntries.length} animal{validEntries.length !== 1 ? 'es' : ''} para registrar
              </span>
              <Button
                onClick={handleSaveAll}
                disabled={!hasValidEntries || isSaving || pendingCount === 0}
                className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Guardar {pendingCount > 0 ? `(${pendingCount})` : 'Todo'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}


