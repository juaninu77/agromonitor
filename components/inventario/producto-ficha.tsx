"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft, Ban, Package, Pencil, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { IngresarLoteDialog } from "./producto-dialogs"
import { EditarLoteDialog, ProductoFormDialog, type ProductoEditable } from "./producto-form-dialog"
import { formatoDia, textoVencimiento } from "@/lib/inventario/fechas"
import { textoValores, type Valores } from "@/lib/inventario/formato-valor"
import { esSanitario, etiquetaTipo } from "@/lib/inventario/validation"

interface Lote { id: string; nroLote: string; vencimiento: string | null; proveedor: string | null; costo: number | null; moneda: string; cantidadInicial: number | null; saldo: number; vencido: boolean; diasRestantes: number | null }
interface Fila { id: string; tipo: string; cantidad: number; motivo: string | null; fecha: string; lote: string | null; galpon: string | null; saldo: number; operacionId: string | null; esAnulacion: boolean; anulado: boolean }
interface Ficha {
  producto: ProductoEditable & { esGlobal: boolean; organizacionId: string | null }
  puedeEditar: boolean
  valorizacion: { valores: Valores; sinCosto: number } | null
  stock: number
  sinLote: number
  lotes: Lote[]
  ubicaciones: { nombre: string; saldo: number }[]
  kardex: { total: number; page: number; totalPages: number; filas: Fila[] }
  aplicaciones: { total: number; ultimas: { id: string; fecha: string; dosis: number | null; unidad: string | null; destino: string }[] }
}

const num = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 3 })
const fechaHora = (s: string) => new Date(s).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
const TIPO_MOV: Record<string, string> = { entrada: "Entrada", salida: "Salida", ajuste: "Ajuste" }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error ?? "No se pudo completar la operación")
  return b.data as T
}

/** Ficha del producto: stock por lote y galpón, kardex con saldo acumulado y anulación de movimientos. */
export function ProductoFicha({ id }: { id: string }) {
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const q = useQuery({ queryKey: ["producto-ficha", id, page], queryFn: () => api<Ficha>(`/api/productos/${id}?page=${page}`) })
  const [editando, setEditando] = useState(false)
  const [ingresando, setIngresando] = useState(false)
  const [loteEditado, setLoteEditado] = useState<Lote | null>(null)
  const [anulando, setAnulando] = useState<Fila | null>(null)
  const recargar = () => client.invalidateQueries({ queryKey: ["producto-ficha", id] })

  if (q.isPending) return <p role="status">Cargando producto…</p>
  if (q.isError) return <p role="alert" className="erp-error">{q.error.message} <button className="underline" onClick={() => q.refetch()}>Reintentar</button> · <Link className="underline" href="/inventario">Volver</Link></p>
  const d = q.data, p = d.producto
  const bajo = p.stockMinimo != null && d.stock <= p.stockMinimo

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2"><Link href="/inventario"><ArrowLeft className="h-4 w-4" />Inventario</Link></Button>
      <PageHeading title={p.nombre} icon={Package} context={`${etiquetaTipo(p.tipo)}${p.laboratorio ? ` · ${p.laboratorio}` : ""}`}
        description={[p.principioActivo, p.dosisReferencia && `Dosis: ${p.dosisReferencia}`, esSanitario(p.tipo) && p.retiroDias ? `Retiro: ${p.retiroDias} días` : null, p.notas].filter(Boolean).join(" · ") || "Sin datos adicionales."}
        actions={d.puedeEditar && <>
          <Button variant="outline" onClick={() => setEditando(true)}><Pencil className="h-4 w-4" />Editar</Button>
          {p.activo && <Button onClick={() => setIngresando(true)}><Plus className="h-4 w-4" />Ingresar lote</Button>}
        </>} />
      {!p.activo && <p className="erp-notice">Producto archivado: no se ofrece en movimientos ni aplicaciones.</p>}
      {p.esGlobal && <p className="erp-notice">Producto del catálogo general (solo referencia): para llevar stock, cargalo en tu organización.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-1"><CardDescription>Stock</CardDescription><CardTitle className={bajo ? "text-destructive" : ""}>{num(d.stock)} <span className="text-sm font-normal text-muted-foreground">{p.unidad}</span></CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{p.stockMinimo != null ? `Mínimo ${num(p.stockMinimo)}${bajo ? " · reponer" : ""}` : "Sin stock mínimo"}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardDescription>Lotes con saldo</CardDescription><CardTitle>{d.lotes.filter((l) => l.saldo > 0).length}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{d.sinLote ? `${num(d.sinLote)} ${p.unidad} sin lote` : "Todo el stock tiene lote"}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardDescription>Valor del stock</CardDescription><CardTitle>{d.valorizacion ? textoValores(d.valorizacion.valores) : "—"}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{p.costoReferencia != null ? `Costo de referencia ${p.monedaCosto} ${num(p.costoReferencia)} por ${p.unidad}` : "Por costo de cada lote"}{d.valorizacion?.sinCosto ? ` · ${num(d.valorizacion.sinCosto)} ${p.unidad} sin costo` : ""}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardDescription>Aplicaciones en Sanidad</CardDescription><CardTitle>{d.aplicaciones.total}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{d.aplicaciones.ultimas[0] ? `Última: ${formatoDia(d.aplicaciones.ultimas[0].fecha)}` : "Sin aplicaciones"}</CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Lotes</CardTitle><CardDescription>Las salidas sin lote elegido descuentan primero del que vence antes.</CardDescription></CardHeader>
          <CardContent>
            {!d.lotes.length ? <p className="text-sm text-muted-foreground">Sin lotes cargados.</p> : (
              <ul className="divide-y text-sm">
                {d.lotes.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <strong>{l.nroLote}</strong>{l.vencimiento && <> · vence {formatoDia(l.vencimiento)}{l.diasRestantes != null && l.saldo > 0 && <span className={l.vencido ? "text-destructive" : "text-muted-foreground"}> ({textoVencimiento(l.diasRestantes)})</span>}</>}
                      {(l.proveedor || l.costo != null) && <span className="block text-xs text-muted-foreground">{[l.proveedor, l.costo != null && `${l.moneda} ${num(l.costo)} por ${p.unidad}`].filter(Boolean).join(" · ")}</span>}
                    </span>
                    <span className="flex items-center gap-2"><span className="tabular-nums">{num(l.saldo)} {p.unidad}</span>{d.puedeEditar && <Button size="sm" variant="ghost" onClick={() => setLoteEditado(l)}>Editar</Button>}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Dónde está</CardTitle><CardDescription>Saldo por galpón del mapa.</CardDescription></CardHeader>
          <CardContent>
            {!d.ubicaciones.length ? <p className="text-sm text-muted-foreground">Sin stock.</p> : (
              <ul className="divide-y text-sm">{d.ubicaciones.map((u) => <li key={u.nombre} className="flex justify-between py-2"><span>{u.nombre}</span><span className="tabular-nums">{num(u.saldo)} {p.unidad}</span></li>)}</ul>
            )}
            {d.aplicaciones.ultimas.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-1 text-sm font-medium">Últimas aplicaciones</h3>
                <ul className="space-y-1 text-xs text-muted-foreground">{d.aplicaciones.ultimas.map((a) => <li key={a.id}>{formatoDia(a.fecha)} · {a.destino}{a.dosis != null ? ` · ${a.dosis} ${a.unidad ?? ""}` : ""}</li>)}</ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Kardex</CardTitle><CardDescription>Todos los movimientos con el saldo después de cada uno. Un error se corrige anulándolo: queda registrado el contramovimiento.</CardDescription></CardHeader>
        <CardContent>
          {!d.kardex.filas.length ? <p className="text-sm text-muted-foreground">Sin movimientos.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 font-normal">Fecha</th><th className="font-normal">Movimiento</th><th className="font-normal">Detalle</th><th className="text-right font-normal">Cantidad</th><th className="text-right font-normal">Saldo</th><th /></tr></thead>
                <tbody>
                  {d.kardex.filas.map((f) => (
                    <tr key={f.id} className={`border-b last:border-0 ${f.anulado ? "text-muted-foreground line-through decoration-1" : ""}`}>
                      <td className="py-2 align-top">{fechaHora(f.fecha)}</td>
                      <td className="align-top">{TIPO_MOV[f.tipo] ?? f.tipo}{f.esAnulacion && <Badge variant="outline" className="ml-1">anulación</Badge>}{f.anulado && <Badge variant="outline" className="ml-1 no-underline">anulado</Badge>}</td>
                      <td className="align-top">{f.motivo ?? "—"}<span className="block text-xs text-muted-foreground">{[f.lote && `Lote ${f.lote}`, f.galpon].filter(Boolean).join(" · ")}</span></td>
                      <td className="text-right align-top tabular-nums">{f.tipo === "salida" || f.cantidad < 0 ? "−" : "+"}{num(Math.abs(f.cantidad))}</td>
                      <td className="text-right align-top tabular-nums">{num(f.saldo)}</td>
                      <td className="text-right align-top">{d.puedeEditar && !f.anulado && !f.esAnulacion && <Button size="sm" variant="ghost" title="Anular" onClick={() => setAnulando(f)}><Ban className="h-4 w-4" /><span className="sr-only">Anular</span></Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {d.kardex.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Página {d.kardex.page} de {d.kardex.totalPages} · {d.kardex.total} movimientos</span>
              <span className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>Más nuevos</Button><Button size="sm" variant="outline" disabled={page >= d.kardex.totalPages} onClick={() => setPage((x) => x + 1)}>Más viejos</Button></span>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductoFormDialog abierto={editando} producto={p} organizaciones={[]} onOpenChange={setEditando} onGuardado={recargar} />
      <IngresarLoteDialog producto={ingresando ? { ...p, stockTotal: d.stock } : null} onOpenChange={(o) => !o && setIngresando(false)} onGuardado={recargar} />
      <EditarLoteDialog productoId={p.id} lote={loteEditado} onOpenChange={(o) => !o && setLoteEditado(null)} onGuardado={recargar} />
      <AnularDialog fila={anulando} unidad={p.unidad} onClose={() => setAnulando(null)} onListo={() => { setAnulando(null); recargar() }} />
    </div>
  )
}

function AnularDialog({ fila, unidad, onClose, onListo }: { fila: Fila | null; unidad: string; onClose: () => void; onListo: () => void }) {
  const [motivo, setMotivo] = useState(""), [guardando, setGuardando] = useState(false), [error, setError] = useState("")
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!fila) return
    setGuardando(true); setError("")
    try {
      const r = await api<{ anulados: number }>(`/api/inventario/movimientos/${fila.id}/anular`, { method: "POST", body: JSON.stringify({ motivo }) })
      toast.success(r.anulados > 1 ? `Operación anulada (${r.anulados} movimientos)` : "Movimiento anulado"); setMotivo(""); onListo()
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo anular") } finally { setGuardando(false) }
  }
  return (
    <Dialog open={!!fila} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anular movimiento</DialogTitle>
          <DialogDescription>
            {fila && <>{TIPO_MOV[fila.tipo]} de {num(Math.abs(fila.cantidad))} {unidad} del {fechaHora(fila.fecha)}. Se registra el movimiento inverso; el original queda en el historial.{fila.operacionId && " Es parte de una salida repartida entre lotes: se anula completa."}</>}
          </DialogDescription>
        </DialogHeader>
        <form id="anular" onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="anular-motivo">Motivo</Label><Input id="anular-motivo" required minLength={3} maxLength={500} autoFocus placeholder="Ej.: cargado dos veces" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button><Button type="submit" form="anular" variant="destructive" disabled={guardando}>Anular</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
