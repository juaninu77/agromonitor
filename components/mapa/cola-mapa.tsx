"use client"

import { useCallback, useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { colaIndexedDB, EVENTO_COLA, reintentar, sincronizar, type OperacionPendiente } from "@/lib/mapa/cola-offline"

const CLAVES_A_REFRESCAR = ["sector-ficha", "mapa", "sectores", "ganado-lista", "pastoreos-activos", "mediciones", "pastoreos-sector"]
const hora = (s: string) => new Date(s).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

/** Operaciones cargadas sin conexión: estado, envío automático al volver la señal y revisión de conflictos. */
export function ColaMapa({ online }: { online: boolean }) {
  const client = useQueryClient()
  const [ops, setOps] = useState<OperacionPendiente[]>([])
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    try { setOps(await colaIndexedDB.listar()) } catch { setOps([]) }
  }, [])

  const enviar = useCallback(async (manual = false) => {
    setEnviando(true)
    try {
      const r = await sincronizar()
      if (r.enviadas) {
        await Promise.all(CLAVES_A_REFRESCAR.map((k) => client.invalidateQueries({ queryKey: [k] })))
        toast.success(`${r.enviadas} ${r.enviadas === 1 ? "registro enviado" : "registros enviados"} desde este dispositivo`)
      }
      if (r.conflictos && (manual || r.enviadas)) toast.warning(`${r.conflictos} ${r.conflictos === 1 ? "registro necesita" : "registros necesitan"} revisión`)
      if (manual && r.sinConexion) toast.error("Todavía no hay conexión")
    } catch {
      if (manual) toast.error("No se pudo enviar")
    } finally {
      setEnviando(false); void cargar()
    }
  }, [client, cargar])

  useEffect(() => {
    void cargar()
    const alCambiar = () => void cargar()
    window.addEventListener(EVENTO_COLA, alCambiar)
    return () => window.removeEventListener(EVENTO_COLA, alCambiar)
  }, [cargar])

  // Al abrir el mapa con conexión y cada vez que vuelve la señal; reintento periódico si quedan pendientes
  const pendientes = ops.filter((o) => o.estado === "pendiente").length
  useEffect(() => { if (online) void enviar() }, [online, enviar])
  useEffect(() => {
    if (!online || !pendientes) return
    const t = setInterval(() => void enviar(), 60000)
    return () => clearInterval(t)
  }, [online, pendientes, enviar])

  const conflictos = ops.filter((o) => o.estado === "conflicto")
  if (online && !ops.length) return null

  async function descartar(op: OperacionPendiente) {
    if (!window.confirm(`¿Descartar «${op.etiqueta}»? No se registrará en el sistema.`)) return
    await colaIndexedDB.borrar(op.clave)
  }

  return (
    <div className="map-floating map-offline-queue flex items-center gap-2 px-3 py-2 text-xs" role="status" aria-live="polite">
      {!online ? <CloudOff className="h-4 w-4 shrink-0 text-amber-700" aria-hidden /> : conflictos.length ? <TriangleAlert className="h-4 w-4 shrink-0 text-amber-700" aria-hidden /> : <RefreshCw className={`h-4 w-4 shrink-0 ${enviando ? "animate-spin" : ""}`} aria-hidden />}
      <span className="min-w-0 flex-1">
        {!online && <strong>Sin conexión. </strong>}
        {!online && !ops.length && "Los movimientos, registros y mediciones se guardan en este dispositivo."}
        {pendientes > 0 && <>{pendientes} {pendientes === 1 ? "registro" : "registros"} sin enviar{online ? (enviando ? " · enviando…" : "") : " · se enviarán al volver la señal"}. </>}
        {conflictos.length > 0 && <>{conflictos.length} para revisar.</>}
      </span>
      {ops.length > 0 && (
        <Popover>
          <PopoverTrigger asChild><Button size="sm" variant="outline" className="h-7 px-2 text-xs">Revisar</Button></PopoverTrigger>
          <PopoverContent align="start" className="w-[min(380px,calc(100vw-24px))] p-0">
            <div className="flex items-center justify-between gap-2 border-b p-3">
              <h2 className="text-sm font-semibold">Guardado en este dispositivo</h2>
              <Button size="sm" disabled={!online || enviando || !pendientes} onClick={() => enviar(true)}>{enviando ? "Enviando…" : "Enviar ahora"}</Button>
            </div>
            <ul className="max-h-[50vh] divide-y overflow-y-auto text-sm">
              {ops.map((op) => (
                <li key={op.clave} className="space-y-1 p-3">
                  <p className="font-medium">{op.etiqueta}</p>
                  <p className="text-xs text-muted-foreground">Cargado {hora(op.creadaAt)} · {op.estado === "conflicto" ? "rechazado por el sistema" : "pendiente de envío"}</p>
                  {op.error && <p className={`text-xs ${op.estado === "conflicto" ? "text-destructive" : "text-muted-foreground"}`}>{op.error}</p>}
                  {op.estado === "conflicto" && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" disabled={!online || enviando} onClick={async () => { await reintentar(op); await enviar(true) }}>Reintentar</Button>
                      <Button size="sm" variant="ghost" onClick={() => descartar(op)}>Descartar</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="border-t p-3 text-[11px] text-muted-foreground">Un registro se rechaza cuando el dato cambió mientras no había señal (por ejemplo, los animales ya se movieron desde otro equipo). Revisá la ficha y reintentá o descartalo.</p>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
