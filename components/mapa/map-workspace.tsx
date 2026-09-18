"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MapPin, Pentagon, Search, Download, Pencil, Loader2, LocateFixed } from "lucide-react"
import { areaHa, geometrySchema, polygonFrom, QUICK_PLACES, SECTOR_TYPES, sectorColor, sectorLabel, type Geometry, type Position } from "@/lib/mapa/geometry"
import type { MapDraft, MapFocus, MapSector } from "@/lib/mapa/types"

const FieldMap = dynamic(() => import("./field-map"), { ssr: false, loading: () => <div className="flex h-[520px] items-center justify-center rounded-xl bg-muted"><Loader2 className="mr-2 animate-spin" />Cargando mapa…</div> })
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm"
const draftGeometry = (draft: MapDraft | null): Geometry | null => !draft ? null : draft.kind === "Point" ? draft.vertices[0] ? { type: "Point", coordinates: draft.vertices[0] } : null : polygonFrom(draft.vertices)
const fmt = (value: number) => value.toLocaleString("es-AR", { maximumFractionDigits: 2 })

export default function MapWorkspace({ fieldId, onList }: { fieldId: string; onList: () => void }) {
  const client = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null), [draft, setDraft] = useState<MapDraft | null>(null)
  const [focus, setFocus] = useState<MapFocus | null>(null), [satellite, setSatellite] = useState(true)
  const [fitKey, setFitKey] = useState(0)
  const [filter, setFilter] = useState("todos"), [search, setSearch] = useState(""), [searching, setSearching] = useState(false)
  const [places, setPlaces] = useState<{ id: string; nombre: string; lat: number; lon: number }[]>([])
  const [saving, setSaving] = useState(false), [coordinates, setCoordinates] = useState(""), [showLocation, setShowLocation] = useState(false)
  const query = useQuery<{ data: MapSector[]; puedeEditar: boolean }>({ queryKey: ["mapa", fieldId], queryFn: async ({ signal }) => {
    const res = await fetch(`/api/mapa?establecimientoId=${fieldId}`, { signal }); const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? "No se pudo cargar el mapa"); return json
  } })
  const sectors = query.data?.data ?? [], canEdit = query.data?.puedeEditar ?? false
  const visible = sectors.filter(s => filter === "todos" || (filter === "sin-mapa" ? !s.geometria : s.tipo === filter))
  const current = sectors.find(s => s.id === selected), geometry = draftGeometry(draft)
  const validation = geometrySchema.safeParse(geometry)
  useEffect(() => {
    if (!draft) return
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", prevent)
    return () => window.removeEventListener("beforeunload", prevent)
  }, [draft])
  function locate(lat: number, lon: number, zoom = 13) { setFocus({ lat, lon, zoom, key: Date.now() }); setShowLocation(false) }
  function begin(kind: "Point" | "Polygon", sector?: MapSector) {
    setDraft({ id: sector?.id, version: sector?.version, nombre: sector?.nombre ?? "", tipo: sector?.tipo ?? (kind === "Polygon" ? "potrero" : "galpon"), descripcion: sector?.descripcion ?? "", kind,
      vertices: sector?.geometria?.type === "Point" ? [sector.geometria.coordinates] : sector?.geometria?.type === "Polygon" ? sector.geometria.coordinates[0].slice(0, -1) : [], drawing: !sector?.geometria })
  }
  async function save() {
    if (!draft || !validation.success) return
    setSaving(true)
    try {
      const payload = { nombre: draft.nombre, tipo: draft.tipo, descripcion: draft.descripcion, geometria: validation.data, ...(draft.id ? { version: draft.version } : { establecimientoId: fieldId }) }
      const response = await fetch(draft.id ? `/api/sectores/${draft.id}` : "/api/sectores", { method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "No se pudo guardar")
      await Promise.all([client.invalidateQueries({ queryKey: ["mapa", fieldId] }), client.invalidateQueries({ queryKey: ["sectores", fieldId] })])
      setFilter("todos"); setSelected(json.data.id); setDraft(null); toast.success("Lugar guardado en el campo")
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar") } finally { setSaving(false) }
  }
  async function searchPlaces(event: React.FormEvent) {
    event.preventDefault(); setSearching(true); setPlaces([])
    try {
      const response = await fetch(`/api/mapa/localidades?q=${encodeURIComponent(search)}`), json = await response.json()
      if (!response.ok) throw new Error(json.error)
      setPlaces(json.data); if (!json.data.length) toast.info("No encontramos esa localidad. Probá sólo el nombre o usá coordenadas.")
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo buscar") } finally { setSearching(false) }
  }
  function exportMap() {
    const collection = { type: "FeatureCollection", features: sectors.filter(s => s.geometria).map(s => ({ type: "Feature", id: s.id, geometry: s.geometria, properties: { nombre: s.nombre, tipo: s.tipo, descripcion: s.descripcion, superficieDeclaradaHa: s.superficieHa } })) }
    const url = URL.createObjectURL(new Blob([JSON.stringify(collection, null, 2)], { type: "application/geo+json" }))
    const a = document.createElement("a"); a.href = url; a.download = `mapa-campo-${fieldId}.geojson`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  if (query.isPending) return <p role="status" className="p-6">Cargando los lugares de este campo…</p>
  if (query.isError) return <div role="alert" className="rounded-xl border p-6"><p>{query.error.message}</p><Button onClick={() => query.refetch()} className="mt-3">Reintentar</Button></div>
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && <><Button onClick={() => begin("Polygon")} disabled={!!draft}><Pentagon className="mr-2 h-4 w-4" />Dibujar área</Button><Button variant="outline" onClick={() => begin("Point")} disabled={!!draft}><MapPin className="mr-2 h-4 w-4" />Marcar lugar</Button></>}
      <Button variant="outline" onClick={() => setShowLocation(!showLocation)} disabled={!!draft}><Search className="mr-2 h-4 w-4" />Ubicar campo</Button>
      <Button variant="outline" size="icon" aria-label="Ver todos los lugares del campo" title="Ver todo el campo" onClick={() => setFitKey(v => v + 1)} disabled={!!draft || !sectors.some(s => s.geometria)}><LocateFixed className="h-4 w-4" /></Button>
      <div className="ml-auto flex gap-1 rounded-lg border p-1" role="group" aria-label="Vista del mapa"><Button size="sm" variant={!satellite ? "default" : "ghost"} aria-pressed={!satellite} onClick={() => setSatellite(false)}>Mapa</Button><Button size="sm" variant={satellite ? "default" : "ghost"} aria-pressed={satellite} onClick={() => setSatellite(true)}>Satélite</Button></div>
    </div>
    {showLocation && <div className="space-y-3 rounded-xl border bg-card p-4">
      <p className="text-sm font-medium">Buscá una localidad y acercate hasta encontrar el campo.</p>
      <div className="flex flex-wrap gap-2">{QUICK_PLACES.map(p => <Button key={p.nombre} variant="secondary" size="sm" onClick={() => locate(p.lat, p.lon)}>{p.nombre}</Button>)}</div>
      <form onSubmit={searchPlaces} className="flex gap-2"><Input aria-label="Localidad argentina" placeholder="Otra localidad de Argentina" minLength={3} maxLength={100} value={search} onChange={e => setSearch(e.target.value)} required /><Button type="submit" disabled={searching}>{searching ? "Buscando…" : "Buscar"}</Button></form>
      {places.length > 0 && <ul className="space-y-1">{places.map(p => <li key={p.id}><Button variant="ghost" className="h-auto whitespace-normal text-left" onClick={() => locate(p.lat, p.lon)}>{p.nombre}</Button></li>)}</ul>}
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); const values = coordinates.trim().split(/[,;\s]+/).map(Number); if (values.length !== 2 || !Number.isFinite(values[0]) || !Number.isFinite(values[1]) || Math.abs(values[0]) > 85 || Math.abs(values[1]) > 180) { toast.error("Usá latitud, longitud en decimales; por ejemplo -45.58, -69.06"); return }; locate(values[0], values[1], 16) }}><Input className="min-w-0 flex-1" aria-label="Coordenadas del campo" placeholder="Latitud, longitud: -45.58, -69.06" value={coordinates} onChange={e => setCoordinates(e.target.value)} required /><Button variant="outline" type="submit">Ir a coordenadas</Button></form>
      <p className="text-xs text-muted-foreground">Localidades: <a href="https://www.argentina.gob.ar/georef" target="_blank" rel="noreferrer" className="underline">Georef Argentina</a>. Estas referencias ubican la localidad; los límites del campo los dibujás vos.</p>
    </div>}
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 space-y-2">
        {draft && <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950"><span className="flex-1">{draft.kind === "Point" ? "Tocá el mapa para ubicar el lugar. Arrastrá el punto para ajustarlo." : draft.drawing ? "Marcá las esquinas en el mapa y tocá Terminar contorno." : "Arrastrá los vértices para ajustar el límite y guardá los cambios."}</span>{draft.kind === "Polygon" && draft.drawing && <Button size="sm" disabled={draft.vertices.length < 3 || saving} onClick={() => setDraft({ ...draft, drawing: false })}>Terminar contorno</Button>}<Button size="sm" variant="outline" disabled={!draft.vertices.length || saving} onClick={() => setDraft({ ...draft, vertices: draft.vertices.slice(0, -1), drawing: true })}>Deshacer punto</Button></div>}
        <FieldMap sectors={visible} selected={selected} draft={saving ? null : draft} focus={focus} satellite={satellite} fitKey={fitKey} onSelect={setSelected} onVertices={vertices => setDraft(d => d ? { ...d, vertices } : d)} />
        <p className="text-xs text-muted-foreground">{sectors.filter(s => s.geometria).length} de {sectors.length} lugares ubicados · Imágenes de referencia, no en tiempo real · Superficie aproximada, no catastral.</p>
      </div>
      <aside className="space-y-4 rounded-xl border bg-card p-4">
        {draft ? <form onSubmit={e => { e.preventDefault(); void save() }} className="space-y-3">
          <h2 className="font-semibold">{draft.id ? "Editar lugar" : "Nuevo lugar"}</h2>
          <div className="space-y-1"><Label htmlFor="map-name">Nombre</Label><Input id="map-name" value={draft.nombre} onChange={e => setDraft({ ...draft, nombre: e.target.value })} required maxLength={120} disabled={saving} placeholder="Ej. Potrero norte o Galpón de fardos" /></div>
          <div className="space-y-1"><Label htmlFor="map-type">Tipo de lugar</Label><select id="map-type" className={selectClass} value={draft.tipo} onChange={e => setDraft({ ...draft, tipo: e.target.value })} disabled={saving}>{SECTOR_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="space-y-1"><Label htmlFor="map-notes">Descripción / qué hay aquí</Label><Textarea id="map-notes" value={draft.descripcion} onChange={e => setDraft({ ...draft, descripcion: e.target.value })} disabled={saving} maxLength={3000} placeholder="Ej. Alfalfa, herramientas y suministros" /></div>
          {geometry?.type === "Polygon" && validation.success && <p className="text-sm">Área dibujada: <strong>{fmt(areaHa(geometry)!)} ha</strong></p>}
          {geometry && !validation.success && <p role="alert" className="text-sm text-destructive">{validation.error.issues[0].message}</p>}
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!validation.success || !draft.nombre.trim() || (draft.kind === "Polygon" && draft.drawing) || saving}>{saving ? "Guardando…" : "Guardar lugar"}</Button><Button type="button" variant="outline" disabled={saving} onClick={() => setDraft(null)}>Cancelar</Button></div>
          <p className="text-xs text-muted-foreground">Los cambios sólo se guardan al confirmar. Terminá o cancelá antes de cambiar de campo.</p>
        </form> : <>
          <div className="space-y-1"><Label htmlFor="map-filter">Mostrar lugares</Label><select id="map-filter" className={selectClass} value={filter} onChange={e => { setFilter(e.target.value); setSelected(null) }}><option value="todos">Todos los tipos</option><option value="sin-mapa">Pendientes de ubicar</option>{SECTOR_TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></div>
          <div className="max-h-60 space-y-1 overflow-auto" aria-label="Lugares del campo">{visible.map(s => <button key={s.id} type="button" aria-pressed={s.id === selected} onClick={() => setSelected(s.id)} className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm ${s.id === selected ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"}`}><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: sectorColor(s.tipo) }} /><span className="min-w-0 flex-1">{s.nombre}<span className="block text-xs text-muted-foreground">{sectorLabel(s.tipo)}{!s.geometria ? " · Sin ubicar" : ""}</span></span></button>)}{visible.length === 0 && <p className="text-sm text-muted-foreground">No hay lugares en esta vista. Ubicá el campo y dibujá el primero.</p>}</div>
          {current ? <div className="space-y-3 border-t pt-3"><h2 className="font-semibold">{current.nombre}</h2>{current.descripcion && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{current.descripcion}</p>}<dl className="space-y-2 text-sm"><div><dt className="text-muted-foreground">Ganado ubicado aquí</dt><dd>{current.bovinos} bovinos · {current.ovinos} ovinos</dd></div>{current.areaMapaHa !== null && <div><dt className="text-muted-foreground">Superficie dibujada</dt><dd>{fmt(current.areaMapaHa)} ha</dd></div>}{current.superficieHa !== null && <div><dt className="text-muted-foreground">Superficie declarada</dt><dd>{fmt(current.superficieHa)} ha</dd></div>}</dl>
            {current.forrajes.length > 0 && <div className="text-sm"><h3 className="font-medium">Cultivos registrados</h3>{current.forrajes.map(f => <p key={f.id}>{f.forraje.nombre} · {f.estado}{f.superficieHa != null ? ` · ${fmt(f.superficieHa)} ha` : ""}</p>)}</div>}
            {current.pastoreosIngreso.length > 0 && <div className="text-sm"><h3 className="font-medium">Pastoreos declarados</h3>{current.pastoreosIngreso.map(p => <p key={p.id}>{p.lote.nombre} · {p.lote.especie.nombre}</p>)}</div>}
            {canEdit && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => begin(current.geometria?.type ?? "Polygon", current)}><Pencil className="mr-2 h-3 w-3" />{current.geometria ? "Editar dibujo" : "Dibujar área"}</Button>{!current.geometria && <Button size="sm" variant="outline" onClick={() => begin("Point", current)}>Ubicar punto</Button>}</div>}
            <div className="flex flex-wrap gap-3 text-sm"><Link href="/ganado" className="text-primary underline">Ganado</Link><Link href="/cultivos" className="text-primary underline">Cultivos</Link><Link href="/inventario" className="text-primary underline">Inventario</Link></div>
          </div> : <p className="text-sm text-muted-foreground">Tocá un área del mapa o elegí un lugar de la lista para ver su información.</p>}
          <div className="flex flex-wrap gap-2 border-t pt-3"><Button variant="outline" size="sm" onClick={onList}>Gestión de sectores</Button><Button variant="ghost" size="sm" onClick={exportMap} disabled={!sectors.some(s => s.geometria)}><Download className="mr-2 h-4 w-4" />GeoJSON</Button></div>
        </>}
      </aside>
    </div>
  </div>
}
