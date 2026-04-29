"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ScanBarcode,
  Square,
  Clock,
  Search,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"

import { AnimalQuickCard } from "./animal-quick-card"
import { ActionPanel } from "./action-panel"
import { ReaderConnect } from "./reader-connect"
import { CsvUpload } from "./csv-upload"
import { SyncStatus } from "./sync-status"

interface MangaWorkspaceProps {
  session: any
  onFinalize: () => void
  onRefresh: () => void
}

function useElapsedTime(startDate: string) {
  const [elapsed, setElapsed] = useState("")

  useEffect(() => {
    function update() {
      const start = new Date(startDate).getTime()
      const now = Date.now()
      const diffSec = Math.floor((now - start) / 1000)
      const hrs = Math.floor(diffSec / 3600)
      const mins = Math.floor((diffSec % 3600) / 60)
      const secs = diffSec % 60
      setElapsed(
        `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
      )
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [startDate])

  return elapsed
}

const TIPO_LABELS: Record<string, string> = {
  pesada_rodeo: "Pesada de rodeo",
  vacunacion: "Vacunación",
  tacto: "Tacto",
  destete: "Destete",
  señalada: "Señalada",
  recepcion: "Recepción",
  general: "Trabajo general",
}

export function MangaWorkspace({ session, onFinalize, onRefresh }: MangaWorkspaceProps) {
  const [eidInput, setEidInput] = useState("")
  const [currentEid, setCurrentEid] = useState("")
  const [currentAnimal, setCurrentAnimal] = useState<any | null>(null)
  const [isAnimalNew, setIsAnimalNew] = useState(false)
  const [searching, setSearching] = useState(false)
  const [confirmingFinalize, setConfirmingFinalize] = useState(false)
  const eidRef = useRef<HTMLInputElement>(null)

  const elapsed = useElapsedTime(session.iniciadaAt || session.fecha || new Date().toISOString())
  const items: any[] = session.items || []
  const accionesHabilitadas: string[] = session.accionesHabilitadas || []

  useEffect(() => {
    eidRef.current?.focus()
  }, [])

  const focusEid = useCallback(() => {
    setTimeout(() => eidRef.current?.focus(), 100)
  }, [])

  const handleReaderEID = useCallback((eid: string) => {
    setEidInput("")
    searchAnimal(eid)
  }, [searchAnimal])

  const searchAnimal = useCallback(async (eid: string) => {
    if (!eid.trim()) return
    setSearching(true)
    setCurrentAnimal(null)
    setIsAnimalNew(false)
    setCurrentEid(eid.trim())

    try {
      const res = await fetch(
        `/api/ganado/bovinos?busqueda=${encodeURIComponent(eid.trim())}`
      )
      if (!res.ok) throw new Error("Error buscando animal")

      const data = await res.json()
      const animales = data.data || data || []

      if (Array.isArray(animales) && animales.length > 0) {
        setCurrentAnimal(animales[0])
        setIsAnimalNew(false)
      } else {
        setCurrentAnimal(null)
        setIsAnimalNew(true)
      }
    } catch {
      toast.error("Error al buscar el animal")
      setIsAnimalNew(true)
    } finally {
      setSearching(false)
    }
  }, [])

  function handleEidSubmit() {
    if (eidInput.trim()) {
      searchAnimal(eidInput.trim())
      setEidInput("")
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      handleEidSubmit()
    }
  }

  function handleItemSaved() {
    setCurrentEid("")
    setCurrentAnimal(null)
    setIsAnimalNew(false)
    onRefresh()
    focusEid()
  }

  async function handleFinalize() {
    if (!confirmingFinalize) {
      setConfirmingFinalize(true)
      return
    }

    try {
      const res = await fetch(`/api/manga/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "finalizada" }),
      })
      if (!res.ok) throw new Error("Error al finalizar")
      toast.success("Sesión finalizada")
      onFinalize()
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    }
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <Card className="border-2 border-emerald-200 bg-emerald-50/30">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <ScanBarcode className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-lg truncate">{session.nombre}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                    {TIPO_LABELS[session.tipo] || session.tipo}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {items.length} animales
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <ReaderConnect onEIDRead={handleReaderEID} />
              <SyncStatus sessionId={session.id} onSyncComplete={onRefresh} />
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-white/80 px-3 py-1.5 rounded-lg border">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-mono">{elapsed}</span>
              </div>
              {confirmingFinalize ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleFinalize}
                    className="h-10"
                  >
                    <Square className="h-4 w-4 mr-1" />
                    Confirmar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmingFinalize(false)}
                    className="h-10"
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFinalize}
                  className="h-10 border-red-300 text-red-700 hover:bg-red-50"
                >
                  <Square className="h-4 w-4 mr-1" />
                  Finalizar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* EID input - focal point */}
      <Card className="border-2 border-primary/30">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                ref={eidRef}
                placeholder="Escanear o ingresar EID..."
                value={eidInput}
                onChange={(e) => setEidInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-14 pl-11 text-lg font-mono border-2 focus-visible:ring-primary"
                autoComplete="off"
              />
            </div>
            <Button
              onClick={handleEidSubmit}
              disabled={!eidInput.trim() || searching}
              className="h-14 px-6 text-base"
            >
              {searching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
              <span className="ml-2 hidden sm:inline">Buscar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main content: animal card + action panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          {searching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Buscando animal...</span>
            </div>
          )}

          {!searching && currentEid && (
            <AnimalQuickCard
              animal={currentAnimal}
              eid={currentEid}
              isNew={isAnimalNew}
            />
          )}

          {/* Processed items list */}
          {items.length > 0 && (
            <Card className="border-2 border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Animales procesados ({items.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[300px] overflow-y-auto">
                  {[...items].reverse().map((item: any, idx: number) => (
                    <div
                      key={item.id || idx}
                      className="flex items-center gap-3 px-4 py-2.5 border-t first:border-t-0 text-sm hover:bg-muted/30"
                    >
                      <span className="text-muted-foreground font-mono text-xs w-6 text-right shrink-0">
                        {items.length - idx}
                      </span>
                      <span className="font-mono font-medium truncate min-w-0 flex-1">
                        {item.eid || item.eidLeido}
                      </span>
                      {(item.peso != null || item.pesoKg != null) && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {item.peso || item.pesoKg} kg
                        </Badge>
                      )}
                      {(item.sanidadAplicada || item.accionSanidad) && (
                        <Badge className="bg-purple-100 text-purple-700 text-xs shrink-0">
                          San
                        </Badge>
                      )}
                      {(item.tactoResultado || item.resultadoTacto) && (
                        <Badge
                          className={
                            (item.tactoResultado || item.resultadoTacto) === "preñada"
                              ? "bg-green-100 text-green-700 text-xs shrink-0"
                              : "bg-red-100 text-red-700 text-xs shrink-0"
                          }
                        >
                          {(item.tactoResultado || item.resultadoTacto) === "preñada" ? "P" : "V"}
                        </Badge>
                      )}
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <ActionPanel
            sessionId={session.id}
            accionesHabilitadas={accionesHabilitadas}
            currentEid={currentEid}
            currentAnimal={currentAnimal}
            onItemSaved={handleItemSaved}
            productoSanidadId={session.productoSanidadId}
          />
          <CsvUpload sessionId={session.id} onImportComplete={onRefresh} />
        </div>
      </div>
    </div>
  )
}
