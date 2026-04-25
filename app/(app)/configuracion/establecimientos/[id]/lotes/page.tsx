"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, List, Loader2, ArrowLeft } from "lucide-react"
import { LoteForm } from "@/components/configuracion/lote-form"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Lote {
  id: string
  nombre: string
  tipo: string
  objetivo: string | null
  especieId: string
  cantidadAnimales: number
  especie: {
    id: string
    nombre: string
  }
}

export default function LotesPage() {
  const params = useParams()
  const router = useRouter()
  const establecimientoId = params.id as string
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingLote, setEditingLote] = useState<Lote | null>(null)

  useEffect(() => {
    loadLotes()
  }, [establecimientoId])

  const loadLotes = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/establecimientos/${establecimientoId}/lotes`)
      if (!response.ok) {
        throw new Error("Error al cargar lotes")
      }
      const data = await response.json()
      setLotes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar lotes")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (data: any) => {
    setError(null)
    try {
      const response = await fetch(
        `/api/establecimientos/${establecimientoId}/lotes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Error al crear lote")
      }

      await loadLotes()
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear lote")
      throw err
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/configuracion/establecimientos")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Lotes</h1>
          <p className="text-muted-foreground">
            Gestiona los lotes de este establecimiento
          </p>
        </div>
        <Button onClick={() => {
          setEditingLote(null)
          setShowForm(true)
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Lote
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {lotes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No hay lotes</CardTitle>
            <CardDescription>
              Crea tu primer lote para organizar tu ganado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Lote
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lotes.map((lote) => (
            <Card key={lote.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <List className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{lote.nombre}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><strong>Tipo:</strong> {lote.tipo}</p>
                  <p><strong>Especie:</strong> {lote.especie.nombre}</p>
                  <p><strong>Animales:</strong> {lote.cantidadAnimales}</p>
                  {lote.objetivo && (
                    <p><strong>Objetivo:</strong> {lote.objetivo}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LoteForm
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={handleCreate}
        initialData={editingLote || undefined}
        establecimientoId={establecimientoId}
      />
    </div>
  )
}

