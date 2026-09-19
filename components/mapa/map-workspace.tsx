"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { useTenant } from "@/lib/context/tenant-context"
import { useMapDraft } from "./use-map-draft"
import { SectorPanel } from "./sector-panel"
import { parseMapImport, type ImportedPlace } from "@/lib/mapa/import"
import { sectorState, waterLabel, isParcel, livestockTypes } from "@/lib/mapa/sector-state"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Search, Pencil, Loader2, LocateFixed, Plus, MoreHorizontal, Maximize, Minimize, PanelRightClose, PanelRightOpen, Undo2, Redo2 } from "lucide-react"
import { areaHa, geometrySchema, polygonFrom, QUICK_PLACES, SECTOR_TYPES, sectorColor, sectorLabel, type Geometry, type Position } from "@/lib/mapa/geometry"
import type { MapDraft, MapFocus, MapSector } from "@/lib/mapa/types"

const FieldMap = dynamic(() => import("./field-map"), { ssr: false, loading: () => <div className="flex h-[520px] items-center justify-center rounded-xl bg-muted"><Loader2 className="mr-2 animate-spin" />Cargando mapa…</div> })
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm"
const draftGeometry = (draft: MapDraft | null): Geometry | null => !draft ? null : draft.kind === "Point" ? draft.vertices[0] ? { type: "Point", coordinates: draft.vertices[0] } : null : draft.kind === "LineString" ? draft.vertices.length >= 2 ? { type: "LineString", coordinates: draft.vertices } : null : polygonFrom(draft.vertices)
const fmt = (value: number) => value.toLocaleString("es-AR", { maximumFractionDigits: 2 })

export default function MapWorkspace({ fieldId, onList }: { fieldId: string; onList: () => void }) {
  const client = useQueryClient()
  const params = useSearchParams()
  const { establecimientoActivo } = useTenant()
  const [selected, setSelected] = useState<string | null>(params.get("sector"))
  const { draft, setDraft, recovered, storageError, online } = useMapDraft(fieldId)
  const [ficha, setFicha] = useState(false), [expanded, setExpanded] = useState(false), [panel, setPanel] = useState(true)
  const [colorByState, setColorByState] = useState(false), [placeQuery, setPlaceQuery] = useState("")
  const [imports, setImports] = useState<ImportedPlace[]>([]), [importError, setImportError] = useState("")
  const [undoStack, setUndoStack] = useState<Position[][]>([]), [redoStack, setRedoStack] = useState<Position[][]>([])
  function changeVertices(vertices: Position[]) { if (!draft) return; setUndoStack(v => [...v.slice(-49), draft.vertices]); setRedoStack([]); setDraft({ ...draft, vertices }) }
  function undo() { if (!draft || !undoStack.length) return; setRedoStack(v => [...v, draft.vertices]); setDraft({ ...draft, vertices: undoStack[undoStack.length - 1] }); setUndoStack(v => v.slice(0, -1)) }
  function redo() { if (!draft || !redoStack.length) return; setUndoStack(v => [...v, draft.vertices]); setDraft({ ...draft, vertices: redoStack[redoStack.length - 1] }); setRedoStack(v => v.slice(0, -1)) }
  const [focus, setFocus] = useState<MapFocus | null>(null), [satellite, setSatellite] = useState(true)
  const [fitKey, setFitKey] = useState(0)
  const [filter, setFilter] = useState("todos"), [search, setSearch] = useState(""), [searching, setSearching] = useState(false)
  const [places, setPlaces] = useState<{ id: string; nombre: string; lat: number; lon: number }[]>([])
  const [saving, setSaving] = useState(false), [coordinates, setCoordinates] = useState(""), [showLocation, setShowLocation] = useState(false)
  const query = useQuery<{ data: MapSector[]; puedeEditar: boolean }>({ queryKey: ["mapa", fieldId], queryFn: async ({ signal }) => {
    const res = await fetch(`/api/mapa?establecimientoId=${fieldId}`, { signal }); const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? "No se pudo cargar el mapa"); return json
  } })
  const sectors = useMemo(() => query.data?.data ?? [], [query.data?.data]), canEdit = query.data?.puedeEditar ?? false
  const visible = useMemo(() => sectors.filter(s =>
    s.nombre.toLocaleLowerCase("es").includes(placeQuery.toLocaleLowerCase("es")) &&
    (filter === "todos" || (filter === "sin-mapa" ? !s.geometria : filter === "pendientes" ? s.pendientes > 0 : filter.startsWith("estado:") ? sectorState(s).key === filter.slice(7) : s.tipo === filter))), [sectors, filter, placeQuery])
  const current = sectors.find(s => s.id === selected), geometry = draftGeometry(draft)
  const validation = geometrySchema.safeParse(geometry)
  function locate(lat: number, lon: number, zoom = 13) { setFocus({ lat, lon, zoom, key: Date.now() }); setShowLocation(false) }
  function begin(kind: MapDraft["kind"], sector?: MapSector, tipo?: string) {
    setPanel(true); setUndoStack([]); setRedoStack([])
    setDraft({ id: sector?.id, version: sector?.version, nombre: sector?.nombre ?? "", tipo: sector?.tipo ?? tipo ?? (kind === "Polygon" ? "potrero" : kind === "LineString" ? "camino" : "galpon"), descripcion: sector?.descripcion ?? "", kind,
      vertices: sector?.geometria?.type === "Point" ? [sector.geometria.coordinates] : sector?.geometria?.type === "Polygon" ? sector.geometria.coordinates[0].slice(0, -1) : sector?.geometria?.type === "LineString" ? sector.geometria.coordinates : [], drawing: !sector?.geometria })
  }
  async function save() {
    if (!draft || !validation.success) return
    setSaving(true)
    try {
      const payload = { nombre: draft.nombre, tipo: draft.tipo, descripcion: draft.descripcion, geometria: validation.data, ...(draft.id ? { version: draft.version } : { establecimientoId: fieldId }) }
      const response = await fetch(draft.id ? `/api/sectores/${draft.id}` : "/api/sectores", { method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "No se pudo guardar")
      await Promise.all([client.invalidateQueries({ queryKey: ["mapa", fieldId] }), client.invalidateQueries({ queryKey: ["sectores", fieldId] })])
      setUndoStack([]); setRedoStack([]); setFilter("todos"); setSelected(json.data.id); setDraft(null); toast.success("Lugar guardado en el campo")
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
  return <div className={expanded ? "fixed inset-0 z-40 overflow-auto bg-background p-3 sm:p-5 space-y-3" : "space-y-3"}>
    {expanded && <p className="text-sm font-semibold">Mapa · {establecimientoActivo?.nombre}</p>}
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && <DropdownMenu><DropdownMenuTrigger asChild><Button disabled={!!draft}><Plus className="mr-2 h-4 w-4"/>Agregar</Button></DropdownMenuTrigger><DropdownMenuContent align="start">
        {SECTOR_TYPES.map(([type, label]) => <DropdownMenuItem key={type} onSelect={() => begin(type === "camino" ? "LineString" : ["potrero", "cultivo", "limite"].includes(type) ? "Polygon" : "Point", undefined, type)}>{label}</DropdownMenuItem>)}
      </DropdownMenuContent></DropdownMenu>}
      <Button variant="outline" onClick={() => setShowLocation(!showLocation)} disabled={!!draft}><Search className="mr-2 h-4 w-4"/>Ubicar campo</Button>
      <Button variant="outline" size="icon" aria-label="Ver todos los lugares del campo" title="Ver todo el campo" onClick={() => { setFilter("todos"); setPlaceQuery(""); setFitKey(v => v + 1) }} disabled={!!draft || !sectors.some(s => s.geometria)}><LocateFixed className="h-4 w-4"/></Button>
      <Button variant="outline" size="icon" aria-label={expanded ? "Salir de pantalla completa" : "Ampliar mapa"} onClick={() => setExpanded(v => !v)}>{expanded ? <Minimize className="h-4 w-4"/> : <Maximize className="h-4 w-4"/>}</Button>
      <Button variant="outline" size="icon" aria-label={panel ? "Ocultar panel de lugares" : "Mostrar panel de lugares"} disabled={!!draft} onClick={() => setPanel(v => !v)}>{panel ? <PanelRightClose className="h-4 w-4"/> : <PanelRightOpen className="h-4 w-4"/>}</Button>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Más opciones del mapa"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent>
        <DropdownMenuItem disabled={!sectors.some(s => s.geometria)} onSelect={exportMap}>Exportar mapa (GeoJSON)</DropdownMenuItem>
        <DropdownMenuItem onSelect={onList} disabled={!!draft}>Ver listado de lugares</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>
      <div className="ml-auto flex gap-1 rounded-lg border p-1" role="group" aria-label="Vista del mapa"><Button size="sm" variant={!satellite ? "default" : "ghost"} aria-pressed={!satellite} onClick={() => setSatellite(false)}>Mapa</Button><Button size="sm" variant={satellite ? "default" : "ghost"} aria-pressed={satellite} onClick={() => setSatellite(true)}>Satélite</Button></div>
    </div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground"><span><strong className="text-foreground">{sectors.filter(s => isParcel(s.tipo) && s.bovinos + s.ovinos > 0).length}</strong> parcelas con ganado</span><span>{sectors.reduce((n, s) => n + s.bovinos, 0)} bovinos · {sectors.reduce((n, s) => n + s.ovinos, 0)} ovinos</span><span>{sectors.reduce((n, s) => n + s.pendientes, 0)} tareas pendientes</span></div>
    {!online && <p role="status" className="erp-notice">Sin conexión. Podés editar el dibujo; guardalo cuando vuelva la conexión.</p>}
    {draft && <p role="status" className={storageError ? "erp-error" : "text-xs text-muted-foreground"}>{storageError ? "No se pudo conservar el borrador en este dispositivo. No cierres la página antes de guardar." : `${recovered ? "Borrador recuperado. " : ""}Dibujo pendiente de guardar, conservado en este dispositivo para este campo.`}</p>}
    {showLocation && <div className="space-y-3 rounded-xl border bg-card p-4">
      <p className="text-sm font-medium">Buscá una localidad y acercate hasta encontrar el campo.</p>
      <div className="flex flex-wrap gap-2">{QUICK_PLACES.map(p => <Button key={p.nombre} variant="secondary" size="sm" onClick={() => locate(p.lat, p.lon)}>{p.nombre}</Button>)}</div>
      <form onSubmit={searchPlaces} className="flex gap-2"><Input aria-label="Localidad argentina" placeholder="Otra localidad de Argentina" minLength={3} maxLength={100} value={search} onChange={e => setSearch(e.target.value)} required /><Button type="submit" disabled={searching}>{searching ? "Buscando…" : "Buscar"}</Button></form>
      {places.length > 0 && <ul className="space-y-1">{places.map(p => <li key={p.id}><Button variant="ghost" className="h-auto whitespace-normal text-left" onClick={() => locate(p.lat, p.lon)}>{p.nombre}</Button></li>)}</ul>}
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); const values = coordinates.trim().split(/[,;\s]+/).map(Number); if (values.length !== 2 || !Number.isFinite(values[0]) || !Number.isFinite(values[1]) || Math.abs(values[0]) > 85 || Math.abs(values[1]) > 180) { toast.error("Usá latitud, longitud en decimales; por ejemplo -45.58, -69.06"); return }; locate(values[0], values[1], 16) }}><Input className="min-w-0 flex-1" aria-label="Coordenadas del campo" placeholder="Latitud, longitud: -45.58, -69.06" value={coordinates} onChange={e => setCoordinates(e.target.value)} required /><Button variant="outline" type="submit">Ir a coordenadas</Button></form>
      <p className="text-xs text-muted-foreground">Localidades: <a href="https://www.argentina.gob.ar/georef" target="_blank" rel="noreferrer" className="underline">Georef Argentina</a>. Estas referencias ubican la localidad; los límites del campo los dibujás vos.</p>
    </div>}
    <div className={`grid gap-3 ${panel || draft ? "md:grid-cols-[minmax(0,1fr)_280px]" : ""}`}>
      <div className="min-w-0 space-y-2">
        {draft && <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950"><span className="flex-1">{draft.kind === "Point" ? "Tocá el mapa para ubicar el lugar. Arrastrá el punto para ajustarlo." : draft.drawing ? "Marcá las esquinas en el mapa y tocá Terminar contorno." : "Arrastrá los vértices para ajustar el límite y guardá los cambios."}</span>{draft.kind !== "Point" && draft.drawing && <Button size="sm" disabled={draft.vertices.length < (draft.kind === "LineString" ? 2 : 3) || saving} onClick={() => setDraft({ ...draft, drawing: false })}>Terminar contorno</Button>}<Button size="sm" variant="outline" aria-label="Deshacer cambio del dibujo" disabled={!undoStack.length || saving} onClick={undo}><Undo2 className="mr-1 h-4 w-4"/>Deshacer</Button><Button size="sm" variant="outline" aria-label="Rehacer cambio del dibujo" disabled={!redoStack.length || saving} onClick={redo}><Redo2 className="h-4 w-4"/></Button></div>}
        <FieldMap sectors={visible} selected={selected} draft={saving ? null : draft} focus={focus} satellite={satellite} fitKey={fitKey} onSelect={id => { setSelected(id); setPanel(true) }} onVertices={changeVertices} colorByState={colorByState} expanded={expanded} />
        <p className="text-xs text-muted-foreground">{sectors.filter(s => s.geometria).length} de {sectors.length} lugares ubicados · Imágenes de referencia, no en tiempo real · Superficie aproximada, no catastral.</p>
      </div>
      {(panel || draft) && <aside className="space-y-4 rounded-xl border bg-card p-4">
        {draft ? <form onSubmit={e => { e.preventDefault(); void save() }} className="space-y-3">
          <h2 className="font-semibold">{draft.id ? "Editar lugar" : "Nuevo lugar"}</h2>
          <div className="space-y-1"><Label htmlFor="map-name">Nombre</Label><Input id="map-name" value={draft.nombre} onChange={e => setDraft({ ...draft, nombre: e.target.value })} required maxLength={120} disabled={saving} placeholder="Ej. Potrero norte o Galpón de fardos" /></div>
          <div className="space-y-1"><Label htmlFor="map-type">Tipo de lugar</Label><select id="map-type" className={selectClass} value={draft.tipo} onChange={e => setDraft({ ...draft, tipo: e.target.value })} disabled={saving}>{SECTOR_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="space-y-1"><Label htmlFor="map-notes">Descripción / qué hay aquí</Label><Textarea id="map-notes" value={draft.descripcion} onChange={e => setDraft({ ...draft, descripcion: e.target.value })} disabled={saving} maxLength={3000} placeholder="Ej. Alfalfa, herramientas y suministros" /></div>
          {geometry?.type === "Polygon" && validation.success && <p className="text-sm">Área dibujada: <strong>{fmt(areaHa(geometry)!)} ha</strong></p>}
          {geometry && !validation.success && <p role="alert" className="text-sm text-destructive">{validation.error.issues[0].message}</p>}
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!online || !validation.success || !draft.nombre.trim() || (draft.kind !== "Point" && draft.drawing) || saving}>{saving ? "Guardando…" : "Guardar lugar"}</Button><Button type="button" variant="outline" disabled={saving} onClick={() => setDraft(null)}>Cancelar</Button></div>
          <p className="text-xs text-muted-foreground">Guardar actualiza el campo compartido. Cancelar descarta este borrador.</p>
        </form> : <>
          <Input aria-label="Buscar lugar en el campo" placeholder="Buscar un potrero o instalación…" value={placeQuery} onChange={e => setPlaceQuery(e.target.value)}/><div className="space-y-1"><Label htmlFor="map-filter">Mostrar lugares</Label><select id="map-filter" className={selectClass} value={filter} onChange={e => { setFilter(e.target.value); setSelected(null) }}><option value="todos">Todos los tipos</option><option value="sin-mapa">Pendientes de ubicar</option><option value="pendientes">Con tareas pendientes</option><option value="estado:ocupado">Con ganado</option><option value="estado:descanso">En descanso</option><option value="estado:cultivado">Con cultivo</option>{SECTOR_TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={colorByState} onChange={e => setColorByState(e.target.checked)}/>Colorear por estado</label>{colorByState && <p className="text-xs text-muted-foreground">Azul: ganado · Violeta: descanso · Ocre: cultivo · Gris: otros</p>}<div className="max-h-52 space-y-1 overflow-auto" aria-label="Lugares del campo">{visible.map(s => <button key={s.id} type="button" aria-pressed={s.id === selected} onClick={() => setSelected(s.id)} className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm ${s.id === selected ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"}`}><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colorByState ? sectorState(s).color : sectorColor(s.tipo) }} /><span className="min-w-0 flex-1">{s.nombre}<span className="block text-xs text-muted-foreground">{sectorLabel(s.tipo)}{!s.geometria ? " · Sin ubicar" : ""}{s.pendientes ? ` · ${s.pendientes} tareas` : ""}</span></span></button>)}{visible.length === 0 && <p className="text-sm text-muted-foreground">No hay lugares en esta vista. Ubicá el campo y dibujá el primero.</p>}</div>
          {current ? <div className="space-y-3 border-t pt-3"><h2 className="font-semibold">{current.nombre}</h2><p className="text-sm font-medium" style={{color:sectorState(current).color}}>{sectorState(current).label}</p><Button className="w-full" onClick={() => setFicha(true)}>Abrir ficha del lugar</Button>{current.descripcion && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{current.descripcion}</p>}<dl className="space-y-2 text-sm">{livestockTypes.has(current.tipo) && <div><dt className="text-muted-foreground">Ganado ubicado aquí</dt><dd>{current.bovinos} bovinos · {current.ovinos} ovinos</dd></div>}{current.areaMapaHa !== null && <div><dt className="text-muted-foreground">Superficie dibujada</dt><dd>{fmt(current.areaMapaHa)} ha</dd></div>}{current.superficieHa !== null && <div><dt className="text-muted-foreground">Superficie declarada</dt><dd>{fmt(current.superficieHa)} ha</dd></div>}</dl>
            {(isParcel(current.tipo) || current.tipo === "aguada" || current.tieneAgua) && <p className="text-sm">{waterLabel(current.agua)}{current.agua && <span className="block text-xs text-muted-foreground">Revisión: {new Date(current.agua.fecha).toLocaleDateString("es-AR")}</span>}</p>}{current.forrajes.length > 0 && <div className="text-sm"><h3 className="font-medium">Cultivos registrados</h3>{current.forrajes.map(f => <p key={f.id}>{f.forraje.nombre} · {f.estado}{f.superficieHa != null ? ` · ${fmt(f.superficieHa)} ha` : ""}</p>)}</div>}
            {current.pastoreosIngreso.length > 0 && <div className="text-sm"><h3 className="font-medium">Pastoreos declarados</h3>{current.pastoreosIngreso.map(p => <p key={p.id}>{p.lote.nombre} · {p.lote.especie.nombre}</p>)}</div>}
            {canEdit && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => begin(current.geometria?.type ?? "Polygon", current)}><Pencil className="mr-2 h-3 w-3" />{current.geometria ? "Editar dibujo" : "Dibujar área"}</Button>{!current.geometria && <Button size="sm" variant="outline" onClick={() => begin("Point", current)}>Ubicar punto</Button>}</div>}

          </div> : <p className="text-sm text-muted-foreground">Tocá un área del mapa o elegí un lugar de la lista para ver su información.</p>}
          {canEdit && <details className="border-t pt-3"><summary className="cursor-pointer text-sm font-medium">Importar límites de Google Earth</summary><label className="mt-3 block text-xs text-muted-foreground">KML o GeoJSON · máximo 1 MB<Input type="file" accept=".kml,.geojson,.json" disabled={!!draft} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setImportError(""); try { if (file.size > 1000000) throw Error("El archivo debe pesar menos de 1 MB"); setImports(parseMapImport(await file.text(), file.name)) } catch (err) { setImportError(err instanceof Error ? err.message : "No se pudo leer el archivo") } e.target.value = "" }}/></label>{importError && <p role="alert" className="text-sm text-destructive">{importError}</p>}{imports.map((item, i) => <Button key={i} variant="ghost" className="mt-1 h-auto w-full whitespace-normal justify-start" onClick={() => { const g = item.geometry; const vertices = g.type === "Point" ? [g.coordinates] : g.type === "Polygon" ? g.coordinates[0].slice(0, -1) : g.coordinates; setDraft({ nombre: item.nombre, tipo: g.type === "Point" ? "otro" : g.type === "LineString" ? "camino" : "potrero", descripcion: "", kind: g.type, vertices, drawing: false }); setFocus({ lat: vertices[0][1], lon: vertices[0][0], zoom: 15, key: Date.now() }); setImports(v => v.filter((_, index) => index !== i)) }}>{item.nombre} · Revisar</Button>)}<p className="mt-2 text-xs text-muted-foreground">Revisá cada figura en el mapa y guardala. Importar no crea lugares automáticamente.</p></details>}

        </>}
      </aside>}
    </div>
    {current && <SectorPanel key={current.id} sector={current} fieldId={fieldId} sectors={sectors} open={ficha} onOpenChange={setFicha}/> }
  </div>
}
