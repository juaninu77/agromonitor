"use client"

import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Copy, ExternalLink, Loader2, MessageCircle, Unlink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Estado {
  configurado: boolean
  vinculado: boolean
  numero: string | null
  desde: string | null
  campo: string | null
  numeroBot: string | null
}
interface Codigo { codigo: string; expira: string; enlace: string | null }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error ?? "No se pudo completar la operación")
  return (b.data ?? b) as T
}

/** Vincular el número de WhatsApp de la persona con el asistente de AgroMonitor. */
export function WhatsappCard() {
  const client = useQueryClient()
  const [codigo, setCodigo] = useState<Codigo | null>(null)
  const [ocupado, setOcupado] = useState(false)
  // Mientras hay un código a la vista, se consulta cada 4 s para enterarse cuando llega el mensaje
  const q = useQuery({ queryKey: ["whatsapp-vinculo"], queryFn: () => api<Estado>("/api/whatsapp/vinculo"), refetchInterval: codigo ? 4000 : false })
  const d = q.data

  useEffect(() => {
    if (!codigo) return
    if (d?.vinculado && d.desde && Date.parse(d.desde) > Date.parse(codigo.expira) - 10 * 60_000) {
      toast.success(`WhatsApp vinculado: ${d.numero}`)
      setCodigo(null)
    }
    const t = setTimeout(() => setCodigo(null), Math.max(0, Date.parse(codigo.expira) - Date.now()))
    return () => clearTimeout(t)
  }, [codigo, d])

  async function generar() {
    setOcupado(true)
    try { setCodigo(await api<Codigo>("/api/whatsapp/vinculo", { method: "POST" })) } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo generar el código") } finally { setOcupado(false) }
  }
  async function desvincular() {
    setOcupado(true)
    try {
      await api("/api/whatsapp/vinculo", { method: "DELETE" })
      toast.success("WhatsApp desvinculado")
      await client.invalidateQueries({ queryKey: ["whatsapp-vinculo"] })
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo desvincular") } finally { setOcupado(false) }
  }
  async function copiar(texto: string) {
    try { await navigator.clipboard.writeText(texto); toast.success("Copiado") } catch { toast.error("No se pudo copiar") }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-4 w-4" />WhatsApp{d?.vinculado && <Badge variant="outline">Vinculado</Badge>}</CardTitle>
        <CardDescription>Consultá stock, hacienda, sanidad, reproducción, tareas y finanzas escribiéndole al asistente de AgroMonitor, con los mismos permisos que tenés en la app.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {q.isPending && <p role="status">Cargando…</p>}
        {q.isError && <p role="alert" className="erp-error">{q.error.message}</p>}
        {d && !d.configurado && <p className="text-muted-foreground">El asistente de WhatsApp todavía no está habilitado en esta instalación.</p>}
        {d?.configurado && (
          <>
            {d.vinculado ? (
              <p>Tu número <strong>{d.numero}</strong> está vinculado{d.desde ? ` desde el ${new Date(d.desde).toLocaleDateString("es-AR")}` : ""}.{d.campo ? <> Campo activo: <strong>{d.campo}</strong>.</> : null}{d.numeroBot ? <> El asistente es el <strong>{d.numeroBot}</strong>.</> : null}</p>
            ) : (
              <p className="text-muted-foreground">Tocá «Vincular WhatsApp» y mandá el código desde tu teléfono. Así el asistente sabe que ese número es tuyo.</p>
            )}
            {codigo && (
              <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50/60 p-3 dark:bg-emerald-950/20" aria-live="polite">
                <p>Mandá este mensaje{d.numeroBot ? <> al <strong>{d.numeroBot}</strong></> : null} desde el WhatsApp que querés vincular:</p>
                <p className="font-mono text-2xl font-semibold tracking-widest">VINCULAR {codigo.codigo}</p>
                <p className="text-xs text-muted-foreground">Vence a las {new Date(codigo.expira).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}. Esta pantalla se actualiza sola cuando llega.</p>
                <div className="flex flex-wrap gap-2">
                  {codigo.enlace && <Button size="sm" asChild><a href={codigo.enlace} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Abrir WhatsApp</a></Button>}
                  <Button size="sm" variant="outline" onClick={() => copiar(`VINCULAR ${codigo.codigo}`)}><Copy className="h-4 w-4" />Copiar mensaje</Button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {!codigo && <Button size="sm" variant={d.vinculado ? "outline" : "default"} disabled={ocupado} onClick={generar}>{ocupado && <Loader2 className="h-4 w-4 animate-spin" />}{d.vinculado ? "Vincular otro número" : "Vincular WhatsApp"}</Button>}
              {d.vinculado && <Button size="sm" variant="outline" disabled={ocupado} onClick={desvincular}><Unlink className="h-4 w-4" />Desvincular</Button>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
