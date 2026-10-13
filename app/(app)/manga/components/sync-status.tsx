"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Wifi, WifiOff, RefreshCw, Loader2, CloudOff, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import {
  comoLectura,
  esConflicto,
  getPendingItems,
  reintentarPendiente,
  removePendingItem,
  resumenLectura,
  syncPendingItems,
  updatePendingItem,
  isOnline as checkOnline,
  onOnlineChange,
  type PendingItem,
} from "@/lib/hardware/offline-queue"

interface SyncStatusProps {
  sessionId: string
  onSyncComplete?: () => void
}

const hora = (s: string) => new Date(s).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

/**
 * Lecturas de esta sesión guardadas en el dispositivo: se envían solas al volver la señal.
 * Las que el sistema rechazó quedan «para revisar»: reintentar, guardar como lectura o descartar.
 */
export function SyncStatus({ sessionId, onSyncComplete }: SyncStatusProps) {
  const [online, setOnline] = useState(true)
  const [items, setItems] = useState<PendingItem[]>([])
  const [syncing, setSyncing] = useState(false)
  const syncingRef = useRef(false)

  const cargar = useCallback(async () => {
    try {
      setItems(await getPendingItems(sessionId))
    } catch {
      setItems([])
    }
  }, [sessionId])

  useEffect(() => {
    setOnline(checkOnline())
    return onOnlineChange(setOnline)
  }, [])

  useEffect(() => {
    void cargar()
    const interval = setInterval(() => void cargar(), 5000)
    return () => clearInterval(interval)
  }, [cargar])

  const pendientes = items.filter((i) => !esConflicto(i)).length
  const conflictos = items.filter(esConflicto)

  const handleSync = useCallback(async (manual = false) => {
    if (syncingRef.current || !checkOnline()) {
      if (manual && !checkOnline()) toast.error("Todavía no hay conexión")
      return
    }
    syncingRef.current = true
    setSyncing(true)
    try {
      const result = await syncPendingItems(sessionId)
      if (result.synced > 0) {
        toast.success(`${result.synced} ${result.synced === 1 ? "lectura sincronizada" : "lecturas sincronizadas"}`)
        onSyncComplete?.()
      }
      if (result.conflictos > 0 && (manual || result.synced > 0)) {
        toast.warning(`${result.conflictos} ${result.conflictos === 1 ? "lectura rechazada para revisar" : "lecturas rechazadas para revisar"}`)
      }
      if (manual && result.sinConexion) toast.error("Todavía no hay conexión")
    } catch {
      if (manual) toast.error("Error al sincronizar")
    } finally {
      syncingRef.current = false
      setSyncing(false)
      void cargar()
    }
  }, [sessionId, onSyncComplete, cargar])

  // Al volver la señal, y cada minuto mientras queden pendientes
  useEffect(() => {
    if (online && pendientes > 0) void handleSync()
  }, [online, pendientes > 0]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!online || !pendientes) return
    const t = setInterval(() => void handleSync(), 60000)
    return () => clearInterval(t)
  }, [online, pendientes, handleSync])

  async function reintentar(item: PendingItem) {
    await reintentarPendiente(item)
    await handleSync(true)
  }

  async function guardarComoLectura(item: PendingItem) {
    await updatePendingItem(comoLectura(item))
    await handleSync(true)
  }

  async function descartar(item: PendingItem) {
    if (item.id == null) return
    if (!window.confirm(`¿Descartar la lectura ${item.eidLeido}? No se registrará en la sesión.`)) return
    await removePendingItem(item.id)
    await cargar()
  }

  if (!items.length && online) return null

  return (
    <div className="flex items-center gap-2 text-sm">
      {!online ? (
        <Badge variant="destructive" className="gap-1.5">
          <WifiOff className="h-3 w-3" />
          Sin conexión
        </Badge>
      ) : (
        <Badge variant="secondary" className="gap-1.5">
          <Wifi className="h-3 w-3" />
          Conectado
        </Badge>
      )}

      {pendientes > 0 && (
        <>
          <Badge variant="outline" className="gap-1.5 border-yellow-400 text-yellow-700">
            <CloudOff className="h-3 w-3" />
            {pendientes} pendientes
          </Badge>
          {online && (
            <Button variant="ghost" size="sm" onClick={() => handleSync(true)} disabled={syncing} className="h-7 text-xs">
              {syncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Sincronizar
            </Button>
          )}
        </>
      )}

      {conflictos.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 border-red-300 text-xs text-red-700 hover:bg-red-50">
              <TriangleAlert className="h-3 w-3" aria-hidden />
              {conflictos.length} para revisar
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(400px,calc(100vw-24px))] p-0">
            <div className="border-b p-3">
              <h2 className="text-sm font-semibold">Lecturas rechazadas</h2>
              <p className="text-xs text-muted-foreground">Se cargaron sin señal y el sistema no las aceptó. Hasta revisarlas no se puede finalizar la sesión.</p>
            </div>
            <ul className="max-h-[50vh] divide-y overflow-y-auto text-sm">
              {conflictos.map((item) => (
                <li key={item.id ?? item.clave} className="space-y-1 p-3">
                  <p className="font-mono font-medium">{item.eidLeido}</p>
                  <p className="text-xs text-muted-foreground">{resumenLectura(item)} · cargada {hora(item.createdAt)}</p>
                  {item.error && <p className="text-xs text-destructive">{item.error}</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" disabled={!online || syncing} onClick={() => reintentar(item)}>Reintentar</Button>
                    {(item.esNuevoRegistro || item.animalId) && (
                      <Button size="sm" variant="outline" disabled={!online || syncing} onClick={() => guardarComoLectura(item)}>Guardar como lectura</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => descartar(item)}>Descartar</Button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t p-3 text-[11px] text-muted-foreground">
              «Guardar como lectura» la registra sin el alta: si el EID ya está en el rodeo (por ejemplo, otro equipo lo dio de alta), se vincula con ese animal y conserva el peso y lo demás.
            </p>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
