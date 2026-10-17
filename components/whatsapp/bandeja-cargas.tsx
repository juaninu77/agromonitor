"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, Inbox, MessageCircle, Mic, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { Textarea } from "@/components/ui/textarea"
import type { CargaWhatsapp, ResultadoBorrador } from "@/lib/whatsapp/borradores"

interface Bandeja { puedeValidar: boolean; porValidar: CargaWhatsapp[]; recientes: CargaWhatsapp[] }

const CLAVE = ["whatsapp", "borradores"] as const

const ESTADO: Record<string, { texto: string; tono: "neutral" | "success" | "warning" | "danger" }> = {
  por_validar: { texto: "Por validar", tono: "warning" },
  aplicado: { texto: "Registrado", tono: "success" },
  rechazado: { texto: "Rechazado", tono: "danger" },
  error: { texto: "No se pudo registrar", tono: "danger" },
  vencido: { texto: "Venció", tono: "neutral" },
}

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })

/** El resumen viene con el formato de WhatsApp: *negrita* y _cursiva_. */
function Resumen({ texto }: { texto: string }) {
  return (
    <div className="space-y-0.5 text-sm">
      {texto.split("\n").map((linea, i) => (
        <p key={i} className={i === 0 ? "font-medium" : linea.startsWith("_") ? "text-xs italic text-muted-foreground" : "text-muted-foreground"}>
          {linea.replace(/\*/g, "").replace(/^_|_$/g, "")}
        </p>
      ))}
    </div>
  )
}

async function enviar(url: string, body?: unknown): Promise<ResultadoBorrador> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? "No se pudo completar")
  return json.data
}

export function BandejaCargas() {
  const qc = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: CLAVE,
    queryFn: async (): Promise<Bandeja> => {
      const res = await fetch("/api/whatsapp/borradores")
      if (!res.ok) throw new Error("No se pudo cargar")
      return (await res.json()).data
    },
  })
  const [aviso, setAviso] = useState<{ carga: CargaWhatsapp; texto: string } | null>(null)
  const [rechazo, setRechazo] = useState<CargaWhatsapp | null>(null)
  const [motivo, setMotivo] = useState("")

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: CLAVE })
    qc.invalidateQueries({ queryKey: ["whatsapp", "pendientes"] })
    qc.invalidateQueries({ queryKey: ["notificaciones"] })
  }

  const aprobar = useMutation({
    mutationFn: (c: CargaWhatsapp) => enviar(`/api/whatsapp/borradores/${c.id}/aprobar`),
    onSuccess: (r, c) => {
      refrescar()
      setAviso(null)
      if (r.tipo === "confirmar") setAviso({ carga: c, texto: r.texto.replace(/^⚠️\s*/, "") })
      else if (r.tipo === "aplicado") toast.success(r.texto.replace(/^✅\s*/, ""))
      else toast.error(r.texto.replace(/^❌\s*/, ""))
    },
    onError: (e: Error) => { refrescar(); toast.error(e.message) },
  })

  const rechazar = useMutation({
    mutationFn: ({ c, motivo }: { c: CargaWhatsapp; motivo: string }) => enviar(`/api/whatsapp/borradores/${c.id}/rechazar`, { motivo }),
    onSuccess: () => { refrescar(); setRechazo(null); setMotivo(""); toast.success("Carga rechazada: le avisamos a quien la mandó") },
    onError: (e: Error) => toast.error(e.message),
  })

  const ocupado = aprobar.isPending || rechazar.isPending

  return (
    <div className="space-y-6">
      <PageHeading
        icon={MessageCircle}
        context="Asistente de WhatsApp"
        title="Cargas por WhatsApp"
        description="Lo que el equipo carga por WhatsApp (escrito o por audio). Lo de operarios espera acá a que un encargado o administrador del campo lo apruebe; recién ahí se registra."
      />

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>
      ) : isError || !data ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No se pudieron cargar las cargas. Probá recargar la página.</CardContent></Card>
      ) : (
        <>
          {data.puedeValidar && (
            <section className="space-y-3" aria-labelledby="por-validar">
              <h2 id="por-validar" className="text-base font-semibold">Por validar {data.porValidar.length > 0 && <span className="text-muted-foreground">({data.porValidar.length})</span>}</h2>
              {data.porValidar.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                    <Inbox className="h-5 w-5 shrink-0" aria-hidden />No hay cargas esperando validación en tus campos.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {data.porValidar.map((c) => (
                    <Card key={c.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{c.etiqueta} · {c.campo}</CardTitle>
                        <CardDescription>Mandado por {c.autor} el {fechaHora(c.createdAt)}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Resumen texto={c.resumen} />
                        {c.origen && (
                          <blockquote className="flex gap-2 rounded-md border-l-2 bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                            <Mic className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /><span>«{c.origen}»</span>
                          </blockquote>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" disabled={ocupado} onClick={() => aprobar.mutate(c)}><Check className="mr-1.5 h-4 w-4" aria-hidden />Aprobar</Button>
                          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => { setRechazo(c); setMotivo("") }}><X className="mr-1.5 h-4 w-4" aria-hidden />Rechazar</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="space-y-3" aria-labelledby="recientes">
            <h2 id="recientes" className="text-base font-semibold">Últimos 30 días</h2>
            {data.recientes.length === 0 ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">Todavía no hay cargas por WhatsApp. Desde el celular vinculado, mandá por ejemplo «la 1234 pesó 380 kg».</CardContent></Card>
            ) : (
              <Card>
                <ul className="divide-y">
                  {data.recientes.map((c) => {
                    const e = ESTADO[c.estado] ?? { texto: c.estado, tono: "neutral" as const }
                    return (
                      <li key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <Resumen texto={c.resumen.split("\n").filter((l) => !l.startsWith("_")).join("\n")} />
                          <p className="text-xs text-muted-foreground">
                            {c.propio ? "Lo mandaste vos" : `Mandado por ${c.autor}`} · {c.campo} · {fechaHora(c.createdAt)}
                            {c.validadoPor && ` · revisó ${c.validadoPor}`}
                          </p>
                          {c.motivoRechazo && <p className="text-xs text-destructive">Motivo: {c.motivoRechazo}</p>}
                          {c.estado === "error" && c.error && <p className="text-xs text-destructive">{c.error}</p>}
                        </div>
                        <div className="shrink-0"><StatusPill tone={e.tono}>{e.texto}</StatusPill></div>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            )}
          </section>
        </>
      )}

      <Dialog open={!!aviso} onOpenChange={(o) => !o && setAviso(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Antes de aprobar</DialogTitle>
            <DialogDescription className="whitespace-pre-line">{aviso?.texto}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAviso(null)}>Volver</Button>
            <Button disabled={ocupado} onClick={() => aviso && aprobar.mutate(aviso.carga)}>Aprobar igual</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rechazo} onOpenChange={(o) => !o && setRechazo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar carga</DialogTitle>
            <DialogDescription>No se registra nada. A quien la mandó le llega el motivo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-rechazo">Motivo</Label>
            <Textarea id="motivo-rechazo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} placeholder="Ej.: la dosis es 2 ml, mandalo de nuevo" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazo(null)}>Volver</Button>
            <Button variant="destructive" disabled={ocupado || motivo.trim().length < 3} onClick={() => rechazo && rechazar.mutate({ c: rechazo, motivo: motivo.trim() })}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
