"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useTenant } from "@/lib/context/tenant-context"
import { tipos, estados, modulos, type Modulo } from "@/lib/administracion/validation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Paperclip, Download, Pencil, Search, Building2, Receipt, FolderOpen, ClipboardList } from "lucide-react"

const config = {
  patrimonio: { label: "Patrimonio", icon: Building2, description: "Maquinaria, vehículos, instalaciones y otros bienes de tu campo." },
  comprobantes: { label: "Comprobantes", icon: Receipt, description: "Registrá facturas, recibos y pagos. Este registro no emite facturas fiscales ni reemplaza la contabilidad." },
  tramites: { label: "Trámites SENASA", icon: ClipboardList, description: "Organizá referencias, estados y vencimientos. La presentación oficial se realiza en SENASA." },
  documentos: { label: "Documentos", icon: FolderOpen, description: "Archivo privado del campo. Adjuntá PDF, JPG o PNG de hasta 2 MB; límite inicial de 100 MB por organización." },
}
const labels: Record<string, string> = { vehiculo: "Vehículo", instalacion: "Instalación", maquinaria: "Maquinaria", inmueble: "Inmueble", herramienta: "Herramienta", otro: "Otro", factura: "Factura", recibo: "Recibo", nota_credito: "Nota de crédito", nota_debito: "Nota de débito", comprobante_pago: "Comprobante de pago", renspa: "RENSPA", dte: "DT-e", vacunacion: "Vacunación", habilitacion: "Habilitación", escritura: "Escritura", contrato: "Contrato", comprobante: "Comprobante", senasa: "SENASA", animal: "Animal" }
const label = (v: string) => labels[v] ?? v.charAt(0).toUpperCase() + v.slice(1).replaceAll("_", " ")
type Row = { id: string; titulo: string; tipo: string; estado: string; referencia?: string | null; fecha?: string | null; vencimiento?: string | null;
  importe?: string | null; moneda?: string; notas?: string | null; contraparte?: string; cuit?: string | null; sentido?: string;
  version: number; nombreArchivo?: string; activoId?: string | null; comprobanteId?: string | null; tramiteId?: string | null; animalId?: string | null;
  activo?: { titulo: string } | null; comprobante?: { titulo: string } | null; tramite?: { titulo: string } | null; animal?: { caravanaVisual: string | null; caravanaRfid: string | null } | null }
type Draft = Record<string, string>
const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` }
function initialDraft(modulo: Modulo): Draft {
  return { titulo: "", tipo: tipos[modulo][0], estado: estados[modulo][0], referencia: "", notas: "", fecha: localToday(), vencimiento: "", importe: "", moneda: "ARS", contraparte: "", cuit: "", sentido: "egreso", activoId: "", comprobanteId: "", tramiteId: "", animalId: "" }
}
function payload(modulo: Modulo, draft: Draft, campo: string) {
  const base = { establecimientoId: campo, titulo: draft.titulo, tipo: draft.tipo, estado: draft.estado, referencia: draft.referencia, notas: draft.notas, fecha: draft.fecha }
  if (modulo === "patrimonio") return { ...base, importe: draft.importe, moneda: draft.moneda }
  if (modulo === "comprobantes") return { ...base, vencimiento: draft.vencimiento, importe: draft.importe, moneda: draft.moneda, contraparte: draft.contraparte, cuit: draft.cuit, sentido: draft.sentido }
  if (modulo === "tramites") return { ...base, vencimiento: draft.vencimiento }
  return { ...base, vencimiento: draft.vencimiento, activoId: draft.activoId, comprobanteId: draft.comprobanteId, tramiteId: draft.tramiteId, animalId: draft.animalId }
}
export function AdministracionPanel({ initialModulo }: { initialModulo: Modulo }) {
  const { establecimientoActivo, isLoading } = useTenant()
  if (isLoading) return <p className="p-6">Cargando campos…</p>
  if (!establecimientoActivo) return <p className="p-6">Seleccioná o creá un campo en Configuración para comenzar.</p>
  return <Workspace key={establecimientoActivo.id} campo={establecimientoActivo.id} nombreCampo={establecimientoActivo.nombre} initialModulo={initialModulo} />
}
function Workspace({ campo, nombreCampo, initialModulo }: { campo: string; nombreCampo: string; initialModulo: Modulo }) {
  const [modulo, setModulo] = useState<Modulo>(initialModulo)
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [refresh, setRefresh] = useState(0)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [draft, setDraft] = useState<Draft>(() => initialDraft(initialModulo))
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [linkType, setLinkType] = useState("")
  const [linkQuery, setLinkQuery] = useState("")
  const [linkOptions, setLinkOptions] = useState<{ id: string; titulo: string }[]>([])
  const [linkError, setLinkError] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError("")
    fetch(`/api/administracion/${modulo}?establecimientoId=${campo}&page=${page}&q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error); return body })
      .then(body => { if (!controller.signal.aborted) { setRows(body.data); setTotal(body.total) } })
      .catch(e => { if (!controller.signal.aborted) { setError(e.message); setRows([]) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [campo, modulo, page, query, refresh])
  useEffect(() => {
    if (!open || modulo !== "documentos" || !linkType) { setLinkOptions([]); return }
    const controller = new AbortController()
    const target = { activoId: "patrimonio", comprobanteId: "comprobantes", tramiteId: "tramites" }[linkType]
    const url = linkType === "animalId" ? `/api/ganado/bovinos?establecimientoId=${campo}&busqueda=${encodeURIComponent(linkQuery)}&limit=25`
      : `/api/administracion/${target}?establecimientoId=${campo}&q=${encodeURIComponent(linkQuery)}`
    setLinkError(""); setLinkOptions([])
    fetch(url, { signal: controller.signal }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); return b })
      .then(b => { if (!controller.signal.aborted) setLinkOptions(b.data.map((x: { id: string; titulo?: string; caravanaVisual?: string; caravanaRfid?: string }) => ({ id: x.id, titulo: x.titulo ?? x.caravanaVisual ?? x.caravanaRfid ?? x.id }))) })
      .catch(e => { if (!controller.signal.aborted) setLinkError(e.message) })
    return () => controller.abort()
  }, [campo, open, modulo, linkType, linkQuery])
  function changeModulo(next: Modulo) { setModulo(next); setRows([]); setPage(1); setQuery(""); setOpen(false); setNotice(""); setError("") }
  function begin(row?: Row) {
    const next = initialDraft(modulo)
    if (row) for (const k of Object.keys(next)) next[k] = String(row[k as keyof Row] ?? "")
    next.fecha = next.fecha.slice(0,10); next.vencimiento = next.vencimiento.slice(0,10)
    setDraft(next); setEditing(row ?? null); setFile(null); setFormError(""); setOpen(true)
    setLinkType(["activoId","comprobanteId","tramiteId","animalId"].find(k => next[k]) ?? ""); setLinkQuery("")
  }
  function attach(row: Row) {
    const key = { patrimonio: "activoId", comprobantes: "comprobanteId", tramites: "tramiteId", documentos: "" }[modulo]
    const next = { ...initialDraft("documentos"), titulo: row.titulo, [key]: row.id, tipo: modulo === "tramites" ? "senasa" : modulo === "comprobantes" ? "comprobante" : "otro" }
    changeModulo("documentos"); setDraft(next); setEditing(null); setFile(null); setFormError(""); setLinkType(key); setLinkQuery(row.titulo); setOpen(true)
  }
  function update(key: string, value: string) { setDraft(d => ({ ...d, [key]: value })) }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setFormError(""); setNotice("")
    try {
      const data = { ...payload(modulo, draft, campo), ...(editing ? { version: editing.version } : {}) }
      let body: BodyInit; let headers: HeadersInit = {}
      if (modulo === "documentos" && !editing) {
        if (!file) throw new Error("Seleccioná un archivo")
        const form = new FormData(); form.set("metadata", JSON.stringify(data)); form.set("archivo", file); body = form
      } else { body = JSON.stringify(data); headers = { "Content-Type": "application/json" } }
      const response = await fetch(`/api/administracion/${modulo}${editing ? `/${editing.id}` : ""}`, { method: editing ? "PATCH" : "POST", headers, body })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "No se pudo guardar")
      setOpen(false); setRefresh(n => n + 1); setNotice(editing ? "Cambios guardados." : "Registro guardado.")
    } catch (e) { setFormError(e instanceof Error ? e.message : "No se pudo guardar") } finally { setSaving(false) }
  }
  const input = (key: string, title: string, options: { type?: string; required?: boolean; maxLength?: number; placeholder?: string } = {}) =>
    <label className="space-y-1 text-sm" key={key}><span>{title}</span><Input value={draft[key]} onChange={e => update(key, e.target.value)} {...options} /></label>
  const select = (key: string, title: string, values: readonly string[]) =>
    <label className="space-y-1 text-sm" key={key}><span>{title}</span><select className={selectClass} value={draft[key]} onChange={e => update(key,e.target.value)}>{values.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></label>
  return <div className="space-y-6">
    <div><p className="text-sm text-muted-foreground">{nombreCampo}</p><h1 className="text-3xl font-bold tracking-tight">Administración del campo</h1><p className="mt-2 text-muted-foreground">Bienes, comprobantes y documentación en un solo lugar. Acceso para propietarios y encargados.</p></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Secciones de administración">{modulos.map(m => { const Icon = config[m].icon; return <button key={m} onClick={() => changeModulo(m)} disabled={saving} aria-pressed={modulo === m} className={`flex items-center gap-3 rounded-xl border p-4 text-left text-sm font-medium transition-colors ${modulo === m ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted"}`}><Icon className="h-5 w-5 shrink-0" />{config[m].label}</button> })}</div>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{config[modulo].label}</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{config[modulo].description}</p></div><Button onClick={() => begin()} disabled={saving || !!error}><Plus className="mr-2 h-4 w-4" />Nuevo registro</Button></div>
    {notice && <p role="status" className="erp-notice">{notice}</p>}
    {open && <Card><CardHeader><CardTitle>{editing ? "Editar registro" : "Nuevo registro"}</CardTitle></CardHeader><CardContent><form onSubmit={save} className="space-y-4"><fieldset disabled={saving} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {input("titulo", "Título *", { required: true, maxLength: 180, placeholder: modulo === "patrimonio" ? "Ej. Tractor John Deere" : "Descripción del registro" })}
      {select("tipo", "Tipo", tipos[modulo])}{select("estado", "Estado", estados[modulo])}
      {input("referencia", modulo === "comprobantes" ? "Número de comprobante *" : "Referencia / número de registro", { required: modulo === "comprobantes", maxLength: 120 })}
      {input("fecha", modulo === "patrimonio" ? "Fecha de adquisición" : "Fecha", { type: "date", required: modulo === "comprobantes" || modulo === "tramites" })}
      {modulo !== "patrimonio" && input("vencimiento", "Vencimiento (opcional)", { type: "date" })}
      {(modulo === "patrimonio" || modulo === "comprobantes") && <>{input("importe", modulo === "patrimonio" ? "Valor de referencia (opcional)" : "Importe total *", { required: modulo === "comprobantes", placeholder: "Ej. 125000.50" })}{select("moneda", "Moneda", ["ARS", "USD"])}</>}
      {modulo === "comprobantes" && <>{input("contraparte", "Proveedor / cliente *", { required: true, maxLength: 180 })}{input("cuit", "CUIT (opcional, sin guiones)", { maxLength: 11 })}{select("sentido", "Movimiento", ["egreso", "ingreso"])}</>}
      {modulo === "documentos" && <>
        {!editing && <label className="space-y-1 text-sm"><span>Archivo PDF, JPG o PNG *</span><Input key={`${modulo}-${open}`} type="file" accept="application/pdf,image/jpeg,image/png" required onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>}
        {editing && <p className="self-center text-sm">Archivo original: {editing.nombreArchivo}</p>}
        <label className="space-y-1 text-sm"><span>Vincular con</span><select className={selectClass} value={linkType} onChange={e => { setLinkType(e.target.value); setLinkQuery(""); setDraft(d => ({ ...d, activoId: "", comprobanteId: "", tramiteId: "", animalId: "" })) }}><option value="">Solo el campo</option><option value="activoId">Bien patrimonial</option><option value="comprobanteId">Comprobante</option><option value="tramiteId">Trámite</option><option value="animalId">Animal</option></select></label>
        {linkType && <><label className="space-y-1 text-sm"><span>Buscar registro vinculado</span><Input value={linkQuery} onChange={e => setLinkQuery(e.target.value)} placeholder="Título o caravana" /></label><label className="space-y-1 text-sm"><span>Registro *</span><select className={selectClass} required value={draft[linkType]} onChange={e => update(linkType,e.target.value)}><option value="">Seleccionar (primeros 25 resultados)</option>{draft[linkType] && !linkOptions.some(o => o.id === draft[linkType]) && <option value={draft[linkType]}>Vínculo seleccionado</option>}{linkOptions.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}</select></label></>}
      </>}
      <label className="space-y-1 text-sm md:col-span-2 lg:col-span-3"><span>Notas</span><textarea className={`${selectClass} h-24`} value={draft.notas} maxLength={4000} onChange={e => update("notas",e.target.value)} /></label>
    </fieldset>{linkError && <p role="alert" className="text-sm text-destructive">{linkError}</p>}{formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}<div className="flex gap-2"><Button disabled={saving} type="submit">{saving ? "Guardando…" : "Guardar"}</Button><Button variant="outline" type="button" disabled={saving} onClick={() => setOpen(false)}>Cancelar</Button></div></form></CardContent></Card>}
    <div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar por título o referencia" placeholder="Buscar por título o referencia…" value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} className="pl-9" /></div>
    {error ? <p role="alert" className="rounded-md border border-destructive p-4 text-destructive">{error} <button className="underline" onClick={() => setRefresh(n => n + 1)}>Reintentar</button></p> : loading ? <p role="status" className="p-6 text-muted-foreground">Cargando registros…</p> : rows.length === 0 ? <Card><CardContent className="p-10 text-center"><FolderOpen className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><p className="font-medium">{query ? "No encontramos registros para esa búsqueda" : "Todavía no hay registros en este campo"}</p><p className="mt-2 text-sm text-muted-foreground">Usá “Nuevo registro” para comenzar.</p></CardContent></Card> : <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-left text-sm"><thead className="bg-muted/50"><tr>{["Registro", "Fecha / vencimiento", "Estado", "Importe / vínculo", "Acciones"].map(t => <th key={t} className="p-4 font-medium">{t}</th>)}</tr></thead><tbody>{rows.map(row => {
      const vencido = row.vencimiento && row.vencimiento.slice(0,10) < localToday() && !["pagado", "anulado", "cancelado", "rechazado", "archivado"].includes(row.estado)
      const link = row.activo?.titulo ?? row.comprobante?.titulo ?? row.tramite?.titulo ?? row.animal?.caravanaVisual ?? row.animal?.caravanaRfid
      return <tr key={row.id} className="border-t"><td className="p-4"><p className="font-medium">{row.titulo}</p><p className="text-xs text-muted-foreground">{label(row.tipo)}{row.referencia ? ` · ${row.referencia}` : ""}</p>{row.contraparte && <p className="text-xs text-muted-foreground">{row.contraparte} · {label(row.sentido!)}</p>}{row.notas && <p className="mt-1 max-w-sm whitespace-pre-wrap text-xs text-muted-foreground">{row.notas}</p>}</td><td className="p-4"><p>{row.fecha?.slice(0,10) || "—"}</p>{row.vencimiento && <p className={`text-xs ${vencido ? "font-semibold text-red-600" : "text-muted-foreground"}`}>{vencido ? "Vencido: " : "Vence: "}{row.vencimiento.slice(0,10)}</p>}</td><td className="p-4"><span className="rounded-full bg-muted px-2 py-1 text-xs">{label(row.estado)}</span></td><td className="p-4">{row.importe ? `${row.moneda} ${row.importe}` : link ?? "—"}</td><td className="p-4"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => begin(row)} disabled={saving} aria-label={`Editar ${row.titulo}`}><Pencil className="h-4 w-4" /></Button>{modulo === "documentos" ? <Button size="sm" variant="outline" asChild><a href={`/api/documentos/${row.id}/archivo`} aria-label={`Descargar ${row.titulo}`}><Download className="h-4 w-4" /></a></Button> : <Button size="sm" variant="outline" onClick={() => attach(row)} disabled={saving} aria-label={`Adjuntar a ${row.titulo}`}><Paperclip className="h-4 w-4" /></Button>}</div></td></tr>
    })}</tbody></table></div>}
    {!error && <div className="flex items-center justify-between text-sm"><p>{total} registros · Página {page} de {Math.max(1, Math.ceil(total / 25))}</p><div className="flex gap-2"><Button variant="outline" disabled={loading || page === 1} onClick={() => setPage(p => p-1)}>Anterior</Button><Button variant="outline" disabled={loading || page * 25 >= total} onClick={() => setPage(p => p+1)}>Siguiente</Button></div></div>}
  </div>
}
