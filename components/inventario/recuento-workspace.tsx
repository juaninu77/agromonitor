"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft, ClipboardCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { hoyArgentina } from "@/lib/inventario/fechas"
import { etiquetaTipo } from "@/lib/inventario/validation"

interface Producto { id: string; organizacionId: string | null; nombre: string; tipo: string; unidad: string; porUbicacion: Record<string, number> }
interface Inventario { data: Producto[]; ubicaciones: { id: string; nombre: string; campo: string }[]; organizacionesEditables: string[] }
interface Resultado { ubicacion: string; ajustados: number; items: { productoId: string; nombre: string; unidad: string; sistema: number; contado: number; diferencia: number }[] }

const SIN = "sin"
const num = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 3 })
const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

/**
 * Recuento físico de una ubicación: se carga lo contado y el sistema registra un ajuste
 * por cada diferencia (faltantes descontados del lote que vence antes).
 */
export function RecuentoWorkspace() {
  const q = useQuery({
    queryKey: ["inventario-recuento"],
    queryFn: async () => { const r = await fetch("/api/inventario?limit=500"); const b = await r.json(); if (!r.ok) throw new Error(b.error ?? "No se pudo cargar"); return b as Inventario },
  })
  const [ubic, setUbic] = useState(SIN)
  const [todos, setTodos] = useState(false)
  const [contado, setContado] = useState<Record<string, string>>({})
  const [fecha, setFecha] = useState(hoyArgentina())
  const [motivo, setMotivo] = useState("")
  const [clave, setClave] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  useEffect(() => { setContado({}); setResultado(null); setClave(crypto.randomUUID()) }, [ubic])

  const editables = useMemo(() => (q.data?.data ?? []).filter((p) => p.organizacionId && q.data!.organizacionesEditables.includes(p.organizacionId)), [q.data])
  const visibles = editables.filter((p) => todos || (p.porUbicacion[ubic] ?? 0) !== 0 || contado[p.id])
  const cargados = editables.filter((p) => contado[p.id] !== undefined && contado[p.id] !== "")
  const conDiferencia = cargados.filter((p) => Number(contado[p.id]) !== (p.porUbicacion[ubic] ?? 0))
  const nombreUbic = ubic === SIN ? "Sin galpón asignado" : q.data?.ubicaciones.find((u) => u.id === ubic)?.nombre ?? "Galpón"

  async function confirmar() {
    if (!cargados.length) return
    if (!window.confirm(`Se registrarán ${conDiferencia.length} ajustes por diferencias en ${nombreUbic}. ¿Confirmar el recuento?`)) return
    setEnviando(true)
    try {
      const r = await fetch("/api/inventario/recuentos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectorId: ubic === SIN ? null : ubic, fecha, motivo: motivo || null, clave, items: cargados.map((p) => ({ productoId: p.id, contado: contado[p.id] })) }),
      })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error ?? "No se pudo registrar el recuento")
      setResultado(b.data); setContado({}); setClave(crypto.randomUUID()); void q.refetch()
      toast.success(b.data.ajustados ? `Recuento registrado: ${b.data.ajustados} ajustes` : "Recuento registrado: sin diferencias")
    } catch (e) { toast.error(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sin conexión: no se registró") } finally { setEnviando(false) }
  }

  if (q.isPending) return <p role="status">Cargando inventario…</p>
  if (q.isError) return <p role="alert" className="erp-error">{q.error.message} <button className="underline" onClick={() => q.refetch()}>Reintentar</button></p>
  if (!q.data.organizacionesEditables.length) return <p>Solo un administrador o encargado puede registrar recuentos. <Link className="underline" href="/inventario">Volver</Link></p>

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2"><Link href="/inventario"><ArrowLeft className="h-4 w-4" />Inventario</Link></Button>
      <PageHeading title="Recuento físico" icon={ClipboardCheck} description="Contá lo que hay en un galpón (o lo que no tiene galpón asignado) y cargalo. Se registra un ajuste por cada diferencia; lo que coincide no genera movimientos." />

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-[1fr_180px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="rec-ubic">Ubicación contada</Label>
            <select id="rec-ubic" className={selectClass} value={ubic} onChange={(e) => setUbic(e.target.value)}>
              <option value={SIN}>Sin galpón asignado</option>
              {q.data.ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre} · {u.campo}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="rec-fecha">Fecha</Label><Input id="rec-fecha" type="date" max={hoyArgentina()} value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="rec-motivo">Observaciones (opcional)</Label><Input id="rec-motivo" maxLength={300} placeholder="Ej.: cierre de mes" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div><CardTitle className="text-base">{nombreUbic}</CardTitle><CardDescription>Dejá vacío lo que no contaste: no se modifica.</CardDescription></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />Mostrar también productos sin stock acá</label>
        </CardHeader>
        <CardContent>
          {!visibles.length ? <p className="text-sm text-muted-foreground">No hay productos con stock en esta ubicación. Marcá «Mostrar también…» para contar algo que apareció.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 font-normal">Producto</th><th className="text-right font-normal">Sistema</th><th className="w-40 font-normal">Contado</th><th className="text-right font-normal">Diferencia</th></tr></thead>
                <tbody>
                  {visibles.map((p) => {
                    const sistema = p.porUbicacion[ubic] ?? 0
                    const c = contado[p.id]
                    const dif = c === undefined || c === "" ? null : Number(c) - sistema
                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2">{p.nombre}<span className="block text-xs text-muted-foreground">{etiquetaTipo(p.tipo)} · {p.unidad}</span></td>
                        <td className="text-right tabular-nums">{num(sistema)}</td>
                        <td className="px-2"><Input aria-label={`Contado de ${p.nombre}`} type="number" min="0" step="0.001" inputMode="decimal" value={c ?? ""} onChange={(e) => setContado({ ...contado, [p.id]: e.target.value })} /></td>
                        <td className={`text-right tabular-nums ${dif == null ? "text-muted-foreground" : dif < 0 ? "text-destructive" : dif > 0 ? "text-emerald-700" : ""}`}>{dif == null ? "—" : dif === 0 ? "OK" : `${dif > 0 ? "+" : "−"}${num(Math.abs(dif))}`}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{cargados.length} contados · {conDiferencia.length} con diferencia</p>
            <Button disabled={!cargados.length || enviando} onClick={confirmar}>{enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar recuento</Button>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <Card className="border-emerald-300">
          <CardHeader><CardTitle className="text-base">Recuento registrado · {resultado.ubicacion}</CardTitle><CardDescription>{resultado.ajustados ? `${resultado.ajustados} ajustes registrados` : "Todo coincidía: no hubo ajustes"}</CardDescription></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">{resultado.items.map((i) => <li key={i.productoId}>{i.nombre}: sistema {num(i.sistema)}, contado {num(i.contado)} {i.unidad}{i.diferencia ? ` → ajuste ${i.diferencia > 0 ? "+" : "−"}${num(Math.abs(i.diferencia))}` : " ✓"}</li>)}</ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
