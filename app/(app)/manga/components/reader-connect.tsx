"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Bluetooth,
  BluetoothOff,
  BluetoothConnected,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

interface ReaderConnectProps {
  onEIDRead: (eid: string) => void
}

type ReaderStatus = "unsupported" | "disconnected" | "connecting" | "connected" | "reading" | "error"

export function ReaderConnect({ onEIDRead }: ReaderConnectProps) {
  const [status, setStatus] = useState<ReaderStatus>("disconnected")
  const [lastEid, setLastEid] = useState<string | null>(null)
  const readerRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window !== "undefined" && !("serial" in navigator)) {
      setStatus("unsupported")
    }
    return () => {
      readerRef.current?.disconnect?.()
    }
  }, [])

  const handleConnect = useCallback(async () => {
    try {
      setStatus("connecting")

      const { EIDReaderService } = await import("@/lib/hardware/serial-reader")

      if (!EIDReaderService.isSupported()) {
        setStatus("unsupported")
        toast.error("Tu navegador no soporta Web Serial API. Usá Chrome o Edge.")
        return
      }

      const reader = new EIDReaderService()
      readerRef.current = reader

      reader.onStatusChange((newStatus: string) => {
        setStatus(newStatus as ReaderStatus)
      })

      await reader.connect()
      setStatus("connected")
      toast.success("Bastón conectado por Bluetooth")

      reader.startReading(
        (eid: string) => {
          setLastEid(eid)
          onEIDRead(eid)
        },
        (error: Error) => {
          console.error("Error de lectura:", error)
          toast.error("Error de lectura del bastón")
        }
      )
      setStatus("reading")
    } catch (err: any) {
      setStatus("error")
      if (err?.name === "NotFoundError") {
        toast.info("No se seleccionó ningún dispositivo")
        setStatus("disconnected")
      } else {
        toast.error("Error al conectar: " + (err?.message || "Desconocido"))
      }
    }
  }, [onEIDRead])

  const handleDisconnect = useCallback(async () => {
    try {
      await readerRef.current?.disconnect?.()
      readerRef.current = null
      setStatus("disconnected")
      setLastEid(null)
      toast.info("Bastón desconectado")
    } catch {
      setStatus("disconnected")
    }
  }, [])

  if (status === "unsupported") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BluetoothOff className="h-4 w-4" />
        <span>Bluetooth no disponible</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {status === "disconnected" || status === "error" ? (
        <Button variant="outline" size="sm" onClick={handleConnect} className="gap-2 border-2">
          <Bluetooth className="h-4 w-4" />
          Conectar bastón
        </Button>
      ) : status === "connecting" ? (
        <Button variant="outline" size="sm" disabled className="gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Conectando...
        </Button>
      ) : (
        <>
          <Badge variant="default" className="gap-1.5 bg-green-600">
            <BluetoothConnected className="h-3 w-3" />
            {status === "reading" ? "Leyendo" : "Conectado"}
          </Badge>
          {lastEid && (
            <span className="text-xs font-mono text-muted-foreground">
              Último: {lastEid}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-xs">
            Desconectar
          </Button>
        </>
      )}
    </div>
  )
}
