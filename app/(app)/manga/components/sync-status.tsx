"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Wifi, WifiOff, RefreshCw, Loader2, Cloud, CloudOff } from "lucide-react"
import { toast } from "sonner"
import {
  getPendingCount,
  syncPendingItems,
  isOnline as checkOnline,
  onOnlineChange,
} from "@/lib/hardware/offline-queue"

interface SyncStatusProps {
  sessionId: string
  onSyncComplete?: () => void
}

export function SyncStatus({ sessionId, onSyncComplete }: SyncStatusProps) {
  const [online, setOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setOnline(checkOnline())
    const unsub = onOnlineChange(setOnline)
    return unsub
  }, [])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    const checkPending = async () => {
      try {
        const count = await getPendingCount()
        setPendingCount(count)
      } catch {}
    }
    checkPending()
    interval = setInterval(checkPending, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (online && pendingCount > 0) {
      handleSync()
    }
  }, [online])

  const handleSync = useCallback(async () => {
    if (syncing || !online) return
    setSyncing(true)
    try {
      const result = await syncPendingItems(sessionId)
      if (result.synced > 0) {
        toast.success(`${result.synced} registros sincronizados`)
        setPendingCount((prev) => Math.max(0, prev - result.synced))
        onSyncComplete?.()
      }
      if (result.failed > 0) {
        toast.warning(`${result.failed} registros no pudieron sincronizarse`)
      }
    } catch {
      toast.error("Error al sincronizar")
    } finally {
      setSyncing(false)
    }
  }, [sessionId, syncing, online, onSyncComplete])

  if (pendingCount === 0 && online) return null

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

      {pendingCount > 0 && (
        <>
          <Badge variant="outline" className="gap-1.5 border-yellow-400 text-yellow-700">
            <CloudOff className="h-3 w-3" />
            {pendingCount} pendientes
          </Badge>
          {online && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="h-7 text-xs"
            >
              {syncing ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Sincronizar
            </Button>
          )}
        </>
      )}
    </div>
  )
}
