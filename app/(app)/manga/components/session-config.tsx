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
import { hoyArgentina } from "@/lib/inventario/fechas"
import { esSanitario } from "@/lib/inventario/validation"
import { usePermissions } from "@/lib/hooks/use-permissions"
import { ETIQUETA_MOTIVO, ETIQUETA_VIA, MOTIVOS_SANIDAD, VIAS_SANIDAD } from "@/lib/sanidad/validation"

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
  destete: ["peso", "cc", "apartado"],
  señalada: ["registro"],
  recepcion: ["peso", "cc", "registro"],
  general: ["peso", "sanidad", "tacto", "cc", "denticion", "apartado", "registro"],
}

export function SessionConfig({ establecimientoId, onSessionCreated, onCancel }: SessionConfigProps) {
  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState("")
  const [fecha, setFecha] = useState(hoyArgentina())
  const [loteOrigenId, setLoteOrigenId] = useState("")
  const [accionesHabilitadas, setAccionesHabilitadas] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const [lotes, setLotes] = useState<{ id: string; nombre: string; tipo?: string }[]>([])
  const [loadingLotes, setLoadingLotes] = useState(false)

  // Tratamiento de la sesión: lo define quien puede registrar sanidad; en la manga se marca por animal
  const { hasRole } = usePermissions()
  const puedeSanidad = hasRole("admin", "encargado", "vet")
  const [productos, setProductos] = useState<{ id: string; nombre: string; unidad?: string; retiroDias?: number | null }[]>([])
  const [productoId, setProductoId] = useState("")
  const [dosis, setDosis] = useState("")
  const [via, setVia] = useState("")
  const [motivo, setMotivo] = useState<string>("preventivo")
  const [carencia, setCarencia] = useState("")
  const conSanidad = accionesHabilitadas.includes("sanidad")
  const producto = productos.find((p) => p.id === productoId)

  useEffect(() => {
    if (!conSanidad || productos.length) return
    fetch("/api/inventario?limit=500")
      .then((res) => res.json())
      .then((b) => setProductos(((b.data ?? []) as { id: string; nombre: string; tipo: string; activo?: boolean; unidad?: string; retiroDias?: number | null }[])
        .filter((p) => p.activo !== false && esSanitario(p.tipo))))
      .catch(() => setProductos([]))
  }, [conSanidad, productos.length])

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
      // Sin permiso de sanidad no se preselecciona (la sesión no podría definir el producto)
      setAccionesHabilitadas(PRESELECCION_POR_TIPO[tipo].filter((a) => a !== "sanidad" || puedeSanidad))
    }
  }, [tipo, puedeSanidad])

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
    if (conSanidad && !productoId) {
      toast.error("Elegí el producto del tratamiento", { description: "Sin producto, «Aplicar tratamiento» no registraría nada en Sanidad." })
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
          ...(conSanidad
            ? {
                productoSanidadId: productoId,
                dosisSanidad: dosis ? Number(dosis.replace(",", ".")) : null,
                unidadSanidad: "ml",
                viaSanidad: via || null,
                motivoSanidad: motivo || null,
                carenciaSanidad: carencia !== "" ? Number(carencia) : null,
              }
            : {}),
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
            max={hoyArgentina()}
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
                disabled={accion.id === "sanidad" && !puedeSanidad}
                onCheckedChange={() => toggleAccion(accion.id)}
              />
              <span className="text-sm font-medium select-none">{accion.label}</span>
            </label>
          ))}
        </div>
      </div>

      {!puedeSanidad && (
        <p className="text-xs text-muted-foreground">La sanidad la configura un administrador, encargado o veterinario (define el producto y la dosis de la sesión).</p>
      )}

      {conSanidad && puedeSanidad && (
        <div className="grid gap-3 rounded-lg border p-3">
          <p className="text-sm font-semibold">Tratamiento de la sesión</p>
          <p className="text-xs text-muted-foreground">Se aplica a cada animal que marques con «Aplicar tratamiento». Al finalizar queda registrado en Sanidad y se descuenta del stock.</p>
          <div className="grid gap-2">
            <Label>Producto *</Label>
            <Select value={productoId} onValueChange={(v) => { setProductoId(v); const p = productos.find((x) => x.id === v); if (p?.retiroDias != null && carencia === "") setCarencia(String(p.retiroDias)) }}>
              <SelectTrigger className="h-11" aria-label="Producto del tratamiento"><SelectValue placeholder={productos.length ? "Elegí el producto" : "Sin productos sanitarios en Inventario"} /></SelectTrigger>
              <SelectContent>{productos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="ses-dosis">Dosis por animal (ml)</Label>
              <Input id="ses-dosis" type="number" min="0" step="0.1" inputMode="decimal" value={dosis} onChange={(e) => setDosis(e.target.value)} className="h-11" />
            </div>
            <div className="grid gap-2">
              <Label>Vía</Label>
              <Select value={via} onValueChange={setVia}>
                <SelectTrigger className="h-11" aria-label="Vía"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{VIAS_SANIDAD.map((v) => <SelectItem key={v} value={v}>{ETIQUETA_VIA[v]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Motivo</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger className="h-11" aria-label="Motivo"><SelectValue /></SelectTrigger>
                <SelectContent>{MOTIVOS_SANIDAD.map((m) => <SelectItem key={m} value={m}>{ETIQUETA_MOTIVO[m]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ses-carencia">Carencia (días)</Label>
              <Input id="ses-carencia" type="number" min="0" value={carencia} onChange={(e) => setCarencia(e.target.value)} className="h-11" placeholder={producto?.retiroDias != null ? String(producto.retiroDias) : ""} />
            </div>
          </div>
        </div>
      )}

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
