"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import "./map-workspace.css"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useSearchParams } from "next/navigation"
import { useTenant } from "@/lib/context/tenant-context"
import { useMapDraft } from "./use-map-draft"
import { filterPlaces } from "@/lib/mapa/filters"
import { SectorPanel } from "./sector-panel"
import { parseMapImport, type ImportedPlace } from "@/lib/mapa/import"
import { sectorState, isParcel, livestockTypes } from "@/lib/mapa/sector-state"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Search, Loader2, LocateFixed, Plus, MoreHorizontal, Maximize, Minimize, ListFilter, Layers, Info, ArrowLeft, X, Undo2, Redo2 } from "lucide-react"
import { areaHa, geometrySchema, polygonFrom, QUICK_PLACES, SECTOR_TYPES, sectorColor, sectorLabel, type Geometry, type Position } from "@/lib/mapa/geometry"
import type { MapDraft, MapFocus, MapSector } from "@/lib/mapa/types"

const FieldMap = dynamic(() => import("./field-map"), { ssr: false, loading: () => <div className="flex h-full min-h-0 items-center justify-center rounded-xl bg-muted"><Loader2 className="mr-2 animate-spin" />Cargando mapa…</div> })
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm"
const draftGeometry = (draft: MapDraft | null): Geometry | null => !draft ? null : draft.kind === "Point" ? draft.vertices[0] ? { type: "Point", coordinates: draft.vertices[0] } : null : draft.kind === "LineString" ? draft.vertices.length >= 2 ? { type: "LineString", coordinates: draft.vertices } : null : polygonFrom(draft.vertices)
const fmt = (value: number) => value.toLocaleString("es-AR", { maximumFractionDigits: 2 })

export default function MapWorkspace({ fieldId, onList }: { fieldId: string; onList: () => void }) {
  const client = useQueryClient()
  const params = useSearchParams()
  const { establecimientoActivo } = useTenant()
  const [selected, setSelected] = useState<string | null>(params.get("sector"))
  const { draft, setDraft, recovered, storageError, online } = useMapDraft(fieldId)
  const [panelEditing, setPanelEditing] = useState(false), [expanded, setExpanded] = useState(true), [panel, setPanel] = useState(!!params.get("sector"))
  const panelRef = useRef<HTMLElement>(null)
  useEffect(() => { if (recovered) setPanel(true) }, [recovered])
  const [colorByState, setColorByState] = useState(false), [placeQuery, setPlaceQuery] = useState("")
  const [imports, setImports] = useState<ImportedPlace[]>([]), [importError, setImportError] = useState("")
  const [undoStack, setUndoStack] = useState<Position[][]>([]), [redoStack, setRedoStack] = useState<Position[][]>([])
  function changeVertices(vertices: Position[]) { if (!draft) return; setUndoStack(v => [...v.slice(-49), draft.vertices]); setRedoStack([]); setDraft({ ...draft, vertices }) }
  function undo() { if (!draft || !undoStack.length) return; setRedoStack(v => [...v, draft.vertices]); setDraft({ ...draft, vertices: undoStack[undoStack.length - 1] }); setUndoStack(v => v.slice(0, -1)) }
  function redo() { if (!draft || !redoStack.length) return; setUndoStack(v => [...v, draft.vertices]); setDraft({ ...draft, vertices: redoStack[redoStack.length - 1] }); setRedoStack(v => v.slice(0, -1)) }
  const [focus, setFocus] = useState<MapFocus | null>(null), [satellite, setSatellite] = useState(true)
  const [fitKey, setFitKey] = useState(0)
  const [filter, setFilter] = useState("todos"), [stateFilter, setStateFilter] = useState("todos"), [search, setSearch] = useState(""), [searching, setSearching] = useState(false)
  const [places, setPlaces] = useState<{ id: string; nombre: string; lat: number; lon: number }[]>([])
  const [saving, setSaving] = useState(false), [coordinates, setCoordinates] = useState(""), [showLocation, setShowLocation] = useState(false)
  const query = useQuery<{ data: MapSector[]; puedeEditar: boolean }>({ queryKey: ["mapa", fieldId], queryFn: async ({ signal }) => {
    const res = await fetch(`/api/mapa?establecimientoId=${fieldId}`, { signal }); const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? "No se pudo cargar el mapa"); return json
  } })
  const sectors = useMemo(() => query.data?.data ?? [], [query.data?.data]), canEdit = query.data?.puedeEditar ?? false
  const visible = useMemo(() => filterPlaces(sectors, { type: filter, state: stateFilter, query: placeQuery }), [sectors, filter, stateFilter, placeQuery])
  const current = sectors.find(s => s.id === selected), geometry = draftGeometry(draft)
  const validation = geometrySchema.safeParse(geometry)
  function locate(lat: number, lon: number, zoom = 13) { setFocus({ lat, lon, zoom, key: Date.now() }); setShowLocation(false) }
  function begin(kind: MapDraft["kind"], sector?: MapSector, tipo?: string) {
    setPanel(true); setShowLocation(false); setUndoStack([]); setRedoStack([])
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
      setUndoStack([]); setRedoStack([]); setFilter("todos"); setStateFilter("todos"); setPlaceQuery(""); setSelected(json.data.id); setDraft(null); toast.success("Lugar guardado en el campo")
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
  const blocked = !!draft || panelEditing
  const hasFilters = filter !== "todos" || stateFilter !== "todos" || !!placeQuery
  return <div className="field-workspace" data-expanded={expanded} data-panel={panel} aria-label="Espacio de trabajo del mapa">
    <FieldMap sectors={visible} selected={selected} draft={saving ? null : draft} focus={focus} satellite={satellite} fitKey={fitKey}
      panelRef={panelRef} onSelect={id => { if (!panelEditing) { setSelected(id); setPanel(true); setShowLocation(false) } }}
      onVertices={changeVertices} colorByState={colorByState} />

    <div className="map-topbar">
      <div className="map-floating flex min-w-0 max-w-full items-center gap-1 py-1 pl-1 pr-3">
        {expanded && <Button size="icon" variant="ghost" aria-label="Volver al ERP" title="Volver al ERP" onClick={() => setExpanded(false)}><ArrowLeft className="h-4 w-4"/></Button>}
        <div className="min-w-0"><h1 className="!text-sm !font-semibold">Potreros</h1><p className="max-w-[210px] truncate text-xs text-muted-foreground">{establecimientoActivo?.nombre}</p></div>
      </div>
      <div className="map-floating flex items-center gap-1 p-1" role="group" aria-label="Herramientas del mapa">
        <Button variant="ghost" size="sm" disabled={blocked} aria-expanded={panel && !current} aria-controls="map-place-panel"
          onClick={() => { setPanel(current ? true : !panel); setSelected(null); setShowLocation(false) }}>
          <ListFilter className="mr-1 h-4 w-4"/>Lugares{hasFilters ? " · " + visible.length : ""}
        </Button>
        {canEdit && <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" disabled={blocked}><Plus className="h-4 w-4"/><span className="ml-1">Agregar</span></Button></DropdownMenuTrigger><DropdownMenuContent align="start">
          {SECTOR_TYPES.map(([type, label]) => <DropdownMenuItem key={type} onSelect={() => begin(type === "camino" ? "LineString" : ["potrero", "cultivo", "limite"].includes(type) ? "Polygon" : "Point", undefined, type)}>{label}</DropdownMenuItem>)}
        </DropdownMenuContent></DropdownMenu>}
        <Button variant="ghost" size="icon" aria-label="Ubicar campo" title="Ubicar campo" aria-expanded={showLocation} disabled={blocked}
          onClick={() => { setShowLocation(v => !v); setPanel(false); setSelected(null) }}><Search className="h-4 w-4"/></Button>
      </div>
    </div>

    <div className="absolute right-3 top-3 z-20 flex flex-col gap-2">
      <Popover><PopoverTrigger asChild><Button className="map-floating" variant="outline" size="icon" aria-label="Capas del mapa" title="Capas del mapa"><Layers className="h-4 w-4"/></Button></PopoverTrigger>
        <PopoverContent side="left" align="start" className="w-64 space-y-4">
          <h2 className="text-sm font-semibold">Vista del mapa</h2>
          <div className="flex gap-2" role="group" aria-label="Vista del mapa"><Button size="sm" variant={!satellite ? "default" : "outline"} aria-pressed={!satellite} onClick={() => setSatellite(false)}>Mapa</Button><Button size="sm" variant={satellite ? "default" : "outline"} aria-pressed={satellite} onClick={() => setSatellite(true)}>Satélite</Button></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={colorByState} onChange={e => setColorByState(e.target.checked)}/>Colorear por estado</label>
          {colorByState && <p className="text-xs text-muted-foreground">Azul: ganado · Violeta: descanso · Ocre: cultivo · Gris: otros</p>}
        </PopoverContent>
      </Popover>
      <Button className="map-floating" variant="outline" size="icon" aria-label="Ver todos los lugares del campo" title="Ver todo el campo" disabled={blocked || !sectors.some(s => s.geometria)} onClick={() => { setFilter("todos"); setStateFilter("todos"); setPlaceQuery(""); setSelected(null); setPanel(false); setShowLocation(false); setFitKey(v => v + 1) }}><LocateFixed className="h-4 w-4"/></Button>
      <Button className="map-floating" variant="outline" size="icon" aria-label={expanded ? "Salir de pantalla completa" : "Ampliar mapa"} title={expanded ? "Salir de pantalla completa" : "Ampliar mapa"} onClick={() => setExpanded(v => !v)}>{expanded ? <Minimize className="h-4 w-4"/> : <Maximize className="h-4 w-4"/>}</Button>
      <DropdownMenu><DropdownMenuTrigger asChild><Button className="map-floating" variant="outline" size="icon" aria-label="Más opciones del mapa" title="Más opciones del mapa"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent side="left" align="start">
        <DropdownMenuItem disabled={!sectors.some(s => s.geometria)} onSelect={exportMap}>Exportar mapa (GeoJSON)</DropdownMenuItem>
        <DropdownMenuItem onSelect={onList} disabled={blocked}>Ver listado de lugares</DropdownMenuItem>
        <DropdownMenuItem asChild disabled={blocked}><Link href="/cultivos">Cultivos y forrajes del campo</Link></DropdownMenuItem>
        <DropdownMenuItem asChild disabled={blocked}><Link href="/inventario">Inventario general</Link></DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>
    </div>

    {showLocation && <section className="map-floating map-location-panel space-y-3 p-4" aria-label="Ubicar campo">
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Ubicar campo</h2><Button size="icon" variant="ghost" aria-label="Cerrar búsqueda de ubicación" onClick={() => setShowLocation(false)}><X className="h-4 w-4"/></Button></div>
      <p className="text-sm text-muted-foreground">Buscá una localidad y acercate hasta encontrar el campo.</p>
      <div className="flex flex-wrap gap-2">{QUICK_PLACES.map(p => <Button key={p.nombre} variant="secondary" size="sm" onClick={() => locate(p.lat, p.lon)}>{p.nombre}</Button>)}</div>
      <form onSubmit={searchPlaces} className="flex gap-2"><Input aria-label="Localidad argentina" placeholder="Otra localidad de Argentina" minLength={3} maxLength={100} value={search} onChange={e => setSearch(e.target.value)} required/><Button type="submit" disabled={searching}>{searching ? "Buscando…" : "Buscar"}</Button></form>
      {places.length > 0 && <ul className="space-y-1">{places.map(p => <li key={p.id}><Button variant="ghost" className="h-auto whitespace-normal text-left" onClick={() => locate(p.lat, p.lon)}>{p.nombre}</Button></li>)}</ul>}
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); const values = coordinates.trim().split(/[,;\s]+/).map(Number); if (values.length !== 2 || !Number.isFinite(values[0]) || !Number.isFinite(values[1]) || Math.abs(values[0]) > 85 || Math.abs(values[1]) > 180) { toast.error("Usá latitud, longitud en decimales; por ejemplo -45.58, -69.06"); return }; locate(values[0], values[1], 16) }}>
        <Input className="min-w-0 flex-1" aria-label="Coordenadas del campo" placeholder="Latitud, longitud: -45.58, -69.06" value={coordinates} onChange={e => setCoordinates(e.target.value)} required/><Button variant="outline" type="submit">Ir a coordenadas</Button>
      </form>
      <p className="text-xs text-muted-foreground">Localidades: <a href="https://www.argentina.gob.ar/georef" target="_blank" rel="noreferrer" className="underline">Georef Argentina</a>. Los límites del campo los dibujás vos.</p>
    </section>}

    {panel && <aside ref={panelRef} id="map-place-panel" className="map-floating map-floating-panel" aria-label={current && !draft ? "Ficha del lugar seleccionado" : "Lugares y filtros"}>
        {draft ? <form onSubmit={e => { e.preventDefault(); void save() }} className="h-full space-y-3 overflow-y-auto p-4">
          <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{draft.id ? "Editar lugar" : "Nuevo lugar"}</h2><Button type="button" size="icon" variant="ghost" aria-label="Ocultar datos del dibujo" onClick={() => setPanel(false)}><X className="h-4 w-4"/></Button></div>
          <div className="space-y-1"><Label htmlFor="map-name">Nombre</Label><Input id="map-name" value={draft.nombre} onChange={e => setDraft({ ...draft, nombre: e.target.value })} required maxLength={120} disabled={saving} placeholder="Ej. Potrero norte o Galpón de fardos" /></div>
          <div className="space-y-1"><Label htmlFor="map-type">Tipo de lugar</Label><select id="map-type" className={selectClass} value={draft.tipo} onChange={e => setDraft({ ...draft, tipo: e.target.value })} disabled={saving}>{SECTOR_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="space-y-1"><Label htmlFor="map-notes">Descripción / qué hay aquí</Label><Textarea id="map-notes" value={draft.descripcion} onChange={e => setDraft({ ...draft, descripcion: e.target.value })} disabled={saving} maxLength={3000} placeholder="Ej. Alfalfa, herramientas y suministros" /></div>
          {geometry?.type === "Polygon" && validation.success && <p className="text-sm">Área dibujada: <strong>{fmt(areaHa(geometry)!)} ha</strong></p>}
          {geometry && !validation.success && <p role="alert" className="text-sm text-destructive">{validation.error.issues[0].message}</p>}
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!online || !validation.success || !draft.nombre.trim() || (draft.kind !== "Point" && draft.drawing) || saving}>{saving ? "Guardando…" : "Guardar lugar"}</Button><Button type="button" variant="outline" disabled={saving} onClick={() => setDraft(null)}>Cancelar</Button></div>
          <p className="text-xs text-muted-foreground">Guardar actualiza el campo compartido. Cancelar descarta este borrador.</p>
        </form> : current ? <SectorPanel key={current.id} sector={current} fieldId={fieldId} sectors={sectors} onBack={() => setSelected(null)} onClose={() => { setSelected(null); setPanel(false) }} onEdit={() => begin(current.geometria?.type ?? (["potrero", "cultivo", "limite"].includes(current.tipo) ? "Polygon" : current.tipo === "camino" ? "LineString" : "Point"), current)} onEditingChange={setPanelEditing}/> : <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 space-y-3 border-b p-3"><div className="flex items-center justify-between"><h2 className="font-semibold">Lugares del campo</h2><Button size="icon" variant="ghost" aria-label="Cerrar lugares y filtros" onClick={() => setPanel(false)}><X className="h-4 w-4"/></Button></div>
            <Input aria-label="Buscar lugar en el campo" placeholder="Buscar lugar…" value={placeQuery} onChange={e => setPlaceQuery(e.target.value)}/>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label htmlFor="map-type-filter">Tipo de lugar</Label><select id="map-type-filter" className={selectClass} value={filter} onChange={e => setFilter(e.target.value)}><option value="todos">Todos los tipos</option>{SECTOR_TYPES.map(([v,label]) => <option key={v} value={v}>{label}</option>)}</select></div>
              <div className="space-y-1"><Label htmlFor="map-state-filter">Estado</Label><select id="map-state-filter" className={selectClass} value={stateFilter} onChange={e => setStateFilter(e.target.value)}><option value="todos">Todos los estados</option><option value="sin-mapa">Sin ubicar</option><option value="pendientes">Con tareas pendientes</option><option value="ocupado">Con ganado</option><option value="descanso">En descanso</option><option value="cultivado">Con cultivo</option></select></div>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{visible.length} de {sectors.length} lugares</span>{(filter !== "todos" || stateFilter !== "todos" || placeQuery) && <button type="button" className="font-medium text-primary underline" onClick={() => { setFilter("todos"); setStateFilter("todos"); setPlaceQuery("") }}>Limpiar filtros</button>}</div>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
          <div className="space-y-1" aria-label="Lugares del campo">{visible.map(s => <button key={s.id} type="button" onClick={() => setSelected(s.id)} className="flex w-full items-center gap-3 rounded-lg border border-transparent p-3 text-left text-sm hover:border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colorByState ? sectorState(s).color : sectorColor(s.tipo) }}/><span className="min-w-0 flex-1"><span className="block font-medium">{s.nombre}</span><span className="block text-xs text-muted-foreground">{sectorLabel(s.tipo)}{!s.geometria ? " · Sin ubicar" : ""}{s.pendientes ? " · " + s.pendientes + (s.pendientes === 1 ? " tarea" : " tareas") : ""}</span>{livestockTypes.has(s.tipo) && s.bovinos + s.ovinos > 0 && <span className="block text-xs text-muted-foreground">{s.bovinos} bovinos · {s.ovinos} ovinos</span>}</span></button>)}</div>
          {!visible.length && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{sectors.length ? "No hay lugares que coincidan con estos filtros. Probá otra combinación o limpiá los filtros." : "Todavía no hay lugares. Usá Agregar para dibujar el primero."}</p>}
          {canEdit && <details className="border-t pt-3"><summary className="cursor-pointer text-sm font-medium">Importar límites de Google Earth</summary><label className="mt-3 block text-xs text-muted-foreground">KML o GeoJSON · máximo 1 MB<Input type="file" accept=".kml,.geojson,.json" disabled={!!draft || panelEditing} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setImportError(""); try { if (file.size > 1000000) throw Error("El archivo debe pesar menos de 1 MB"); setImports(parseMapImport(await file.text(), file.name)) } catch (err) { setImportError(err instanceof Error ? err.message : "No se pudo leer el archivo") } e.target.value = "" }}/></label>{importError && <p role="alert" className="text-sm text-destructive">{importError}</p>}{imports.map((item, i) => <Button key={i} variant="ghost" className="mt-1 h-auto w-full whitespace-normal justify-start" onClick={() => { const g = item.geometry; const vertices = g.type === "Point" ? [g.coordinates] : g.type === "Polygon" ? g.coordinates[0].slice(0, -1) : g.coordinates; setDraft({ nombre: item.nombre, tipo: g.type === "Point" ? "otro" : g.type === "LineString" ? "camino" : "potrero", descripcion: "", kind: g.type, vertices, drawing: false }); setFocus({ lat: vertices[0][1], lon: vertices[0][0], zoom: 15, key: Date.now() }); setImports(v => v.filter((_, index) => index !== i)) }}>{item.nombre} · Revisar</Button>)}<p className="mt-2 text-xs text-muted-foreground">Revisá cada figura en el mapa y guardala. Importar no crea lugares automáticamente.</p></details>}

          </div>
        </div>}
    </aside>}

    {draft && <div className="map-floating map-drawing-controls space-y-2 border-amber-400 bg-amber-50 p-3 text-amber-950">
      <p role="status" className="text-xs">{draft.kind === "Point" ? "Tocá el mapa o arrastrá el punto." : draft.drawing ? "Marcá las esquinas y terminá el contorno." : "Arrastrá los vértices para ajustar el límite."}</p>
      <div className="flex flex-wrap items-center gap-1">
        {draft.kind !== "Point" && draft.drawing && <Button size="sm" disabled={draft.vertices.length < (draft.kind === "LineString" ? 2 : 3) || saving} onClick={() => setDraft({ ...draft, drawing: false })}>Terminar contorno</Button>}
        <Button size="icon" variant="outline" aria-label="Deshacer cambio del dibujo" title="Deshacer" disabled={!undoStack.length || saving} onClick={undo}><Undo2 className="h-4 w-4"/></Button>
        <Button size="icon" variant="outline" aria-label="Rehacer cambio del dibujo" title="Rehacer" disabled={!redoStack.length || saving} onClick={redo}><Redo2 className="h-4 w-4"/></Button>
        <Button size="sm" variant="outline" aria-expanded={panel} onClick={() => setPanel(v => !v)}>{panel ? "Ocultar datos" : "Datos y guardado"}</Button>
      </div>
      <p role="status" className="text-[11px]">{storageError ? "No se pudo conservar el borrador. No cierres la página antes de guardar." : recovered ? "Borrador recuperado · pendiente de guardar" : "Borrador conservado en este dispositivo · pendiente de guardar"}</p>
    </div>}

    {!online && <p role="status" className="absolute bottom-3 left-3 right-16 z-30 rounded-lg bg-amber-100 p-2 text-xs text-amber-950 shadow">Sin conexión. Podés editar el dibujo y guardarlo cuando vuelva Internet.</p>}
    {!draft && online && <div className="map-bottom-summary absolute bottom-9 left-3 z-20">
      <Popover><PopoverTrigger asChild><Button className="map-floating max-w-full gap-2 text-xs" size="sm" variant="outline" aria-label="Resumen y referencias del mapa"><Info className="h-4 w-4"/><span>{sectors.length} lugares · {sectors.reduce((n, s) => n + s.bovinos, 0)} bovinos · {sectors.reduce((n, s) => n + s.ovinos, 0)} ovinos</span></Button></PopoverTrigger>
        <PopoverContent side="top" align="start" className="space-y-2 text-sm">
          <p>{sectors.filter(s => isParcel(s.tipo) && s.bovinos + s.ovinos > 0).length} parcelas con ganado · {sectors.reduce((n, s) => n + s.pendientes, 0)} tareas pendientes.</p>
          <p>{sectors.filter(s => s.geometria).length} de {sectors.length} lugares ubicados.</p>
          <p className="text-xs text-muted-foreground">Imágenes de referencia, no en tiempo real. Superficies aproximadas, no catastrales.</p>
        </PopoverContent>
      </Popover>
    </div>}
  </div>
}
