"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Play } from "lucide-react"
import { toast } from "sonner"

interface SessionConfigProps {
  establecimientoId: string
  onSessionCreated: (session: any) => void
  onCancel: () => void
}

const TIPOS_SESION = [
  { value: "pesada_rodeo", label: "Pesada de rodeo" },
  { value: "vacunacion", label: "Vacunación / Antiparasitario" },
  { value: "tacto", label: "Tacto" },
  { value: "destete", label: "Destete" },
  { value: "señalada", label: "Señalada" },
  { value: "recepcion", label: "Recepción de hacienda" },
  { value: "general", label: "Trabajo general" },
]

const ACCIONES_DISPONIBLES = [
  { id: "peso", label: "Peso" },
  { id: "sanidad", label: "Sanidad" },
  { id: "tacto", label: "Tacto" },
  { id: "cc", label: "Cond. Corporal" },
  { id: "denticion", label: "Dentición" },
  { id: "apartado", label: "Apartado" },
  { id: "registro", label: "Registro nuevo" },
]

const PRESELECCION_POR_TIPO: Record<string, string[]> = {
  pesada_rodeo: ["peso", "cc"],
  vacunacion: ["sanidad"],
  tacto: ["tacto", "apartado"],
  destete: ["peso", "registro"],
  señalada: ["registro"],
  recepcion: ["peso", "registro", "sanidad"],
  general: ["peso", "sanidad", "tacto", "cc", "denticion", "apartado", "registro"],
}

export function SessionConfig({ establecimientoId, onSessionCreated, onCancel }: SessionConfigProps) {
  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState("")
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])
  const [loteOrigenId, setLoteOrigenId] = useState("")
  const [accionesHabilitadas, setAccionesHabilitadas] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const [lotes, setLotes] = useState<{ id: string; nombre: string; tipo?: string }[]>([])
  const [loadingLotes, setLoadingLotes] = useState(false)

  useEffect(() => {
    if (!establecimientoId) return
    setLoadingLotes(true)
    fetch(`/api/establecimientos/${establecimientoId}/lotes`)
      .then((res) => res.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : data.data || []
        setLotes(items)
      })
      .catch(() => setLotes([]))
      .finally(() => setLoadingLotes(false))
  }, [establecimientoId])

  useEffect(() => {
    if (tipo && PRESELECCION_POR_TIPO[tipo]) {
      setAccionesHabilitadas(PRESELECCION_POR_TIPO[tipo])
    }
  }, [tipo])

  function toggleAccion(accionId: string) {
    setAccionesHabilitadas((prev) =>
      prev.includes(accionId)
        ? prev.filter((a) => a !== accionId)
        : [...prev, accionId]
    )
  }

  async function handleSubmit() {
    if (!nombre.trim()) {
      toast.error("Ingresá un nombre para la sesión")
      return
    }
    if (!tipo) {
      toast.error("Seleccioná el tipo de trabajo")
      return
    }
    if (accionesHabilitadas.length === 0) {
      toast.error("Seleccioná al menos una acción")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/manga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          tipo,
          fecha,
          establecimientoId,
          loteOrigenId: loteOrigenId || null,
          accionesHabilitadas,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al crear la sesión")
      }

      const data = await res.json()
      const session = data.data || data
      toast.success("Sesión creada", { description: `"${nombre}" lista para comenzar` })
      onSessionCreated(session)
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-5 py-2">
      <div className="grid gap-2">
        <Label htmlFor="ses-nombre">Nombre de la sesión *</Label>
        <Input
          id="ses-nombre"
          placeholder="Ej: Pesada terneros lote 3"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="h-11"
        />
      </div>

      <div className="grid gap-2">
        <Label>Tipo de trabajo *</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Seleccioná el tipo" />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_SESION.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="ses-fecha">Fecha</Label>
          <Input
            id="ses-fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="grid gap-2">
          <Label>Lote de origen</Label>
          <Select value={loteOrigenId} onValueChange={setLoteOrigenId}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder={loadingLotes ? "Cargando..." : "Opcional"} />
            </SelectTrigger>
            <SelectContent>
              {lotes.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nombre}
                </SelectItem>
              ))}
              {lotes.length === 0 && !loadingLotes && (
                <SelectItem value="__none" disabled>
                  Sin lotes disponibles
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3">
        <Label>Acciones habilitadas *</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ACCIONES_DISPONIBLES.map((accion) => (
            <label
              key={accion.id}
              className="flex items-center gap-2.5 p-3 rounded-lg border-2 cursor-pointer transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <Checkbox
                checked={accionesHabilitadas.includes(accion.id)}
                onCheckedChange={() => toggleAccion(accion.id)}
              />
              <span className="text-sm font-medium select-none">{accion.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} className="h-11">
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="h-11 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 px-6"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Iniciar Sesión
        </Button>
      </div>
    </div>
  )
}
