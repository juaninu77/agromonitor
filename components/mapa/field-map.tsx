"use client"

import { useEffect, useRef, useState } from "react"
import * as L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { MapDraft, MapSector, MapFocus } from "@/lib/mapa/types"
import { polygonFrom, sectorColor, type Position } from "@/lib/mapa/geometry"

interface Props {
  sectors: MapSector[]; selected: string | null; draft: MapDraft | null; focus: MapFocus | null;
  satellite: boolean; fitKey: number; onSelect: (id: string) => void; onVertices: (vertices: Position[]) => void;
}
export default function FieldMap(props: Props) {
  const host = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null), latest = useRef(props), fitted = useRef(false)
  latest.current = props
  const [tilesFailed, setTilesFailed] = useState(false)
  useEffect(() => {
    if (!host.current) return
    const m = L.map(host.current, { center: [-42, -67], zoom: 5, minZoom: 3, maxZoom: 20, doubleClickZoom: false })
    map.current = m; layer.current = L.layerGroup().addTo(m)
    L.control.scale({ imperial: false }).addTo(m)
    m.on("click", (event: L.LeafletMouseEvent) => {
      const { draft, onVertices } = latest.current
      if (!draft?.drawing) return
      const p: Position = [event.latlng.wrap().lng, event.latlng.lat]
      onVertices(draft.kind === "Point" ? [p] : draft.vertices.length < 500 ? [...draft.vertices, p] : draft.vertices)
    })
    const observer = new ResizeObserver(() => m.invalidateSize())
    observer.observe(host.current)
    return () => { observer.disconnect(); m.remove(); map.current = null }
  }, [])
  useEffect(() => {
    if (!map.current) return
    setTilesFailed(false)
    const tile = props.satellite
      ? L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxNativeZoom: 19, maxZoom: 20, noWrap: true,
        attribution: 'Imágenes © <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener noreferrer">Esri, Maxar, Earthstar Geographics y colaboradores</a>',
      })
      : L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxNativeZoom: 19, maxZoom: 20, noWrap: true,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      })
    tile.on("tileerror", () => setTilesFailed(true)); tile.addTo(map.current)
    return () => { tile.remove() }
  }, [props.satellite])
  useEffect(() => {
    const m = map.current, group = layer.current
    if (!m || !group) return
    group.clearLayers()
    const bounds = L.latLngBounds([])
    for (const sector of props.sectors) {
      if (!sector.geometria || props.draft?.id === sector.id) continue
      const color = sectorColor(sector.tipo)
      const shape = L.geoJSON(sector.geometria, {
        interactive: !props.draft,
        style: { color, weight: sector.id === props.selected ? 4 : 2, fillOpacity: sector.id === props.selected ? 0.4 : 0.2 },
        pointToLayer: (_f, point) => L.circleMarker(point, { radius: 9, color: "white", weight: 2, fillColor: color, fillOpacity: 1, interactive: !props.draft }),
      }).addTo(group)
      const label = document.createElement("span"); label.textContent = sector.nombre
      shape.bindTooltip(label, { sticky: true })
      shape.on("click", () => { if (!latest.current.draft) latest.current.onSelect(sector.id) })
      bounds.extend(shape.getBounds())
    }
    if (!fitted.current && bounds.isValid()) { m.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 }); fitted.current = true }
    const draft = props.draft
    if (!draft) return
    const vertices = draft.vertices, points: L.LatLngTuple[] = vertices.map(([lon, lat]) => [lat, lon])
    if (draft.kind === "Polygon" && vertices.length >= 3) L.geoJSON(polygonFrom(vertices)!, { interactive: false, style: { color: "#f59e0b", dashArray: draft.drawing ? "6 6" : undefined, weight: 3, fillOpacity: 0.2 } }).addTo(group)
    else if (points.length > 1) L.polyline(points, { color: "#f59e0b", interactive: false }).addTo(group)
    points.forEach((point, index) => {
      const marker = L.marker(point, { draggable: true, keyboard: true, title: `Vértice ${index + 1}`, icon: L.divIcon({ className: "map-vertex", html: `<span>${index + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(group)
      marker.on("dragend", () => {
        const value = marker.getLatLng().wrap(), current = latest.current.draft
        if (current) latest.current.onVertices(current.vertices.map((p, i) => i === index ? [value.lng, value.lat] : p))
      })
    })
  }, [props.sectors, props.draft, props.selected])
  useEffect(() => {
    const selected = props.sectors.find(s => s.id === props.selected)
    if (selected?.geometria) map.current?.fitBounds(L.geoJSON(selected.geometria).getBounds(), { padding: [45, 45], maxZoom: 17 })
    // Selection changes center the map; background refreshes must not move a drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selected])
  useEffect(() => { if (props.focus) map.current?.setView([props.focus.lat, props.focus.lon], props.focus.zoom) }, [props.focus])
  useEffect(() => {
    if (!props.fitKey) return
    const bounds = L.latLngBounds([])
    for (const sector of latest.current.sectors) if (sector.geometria) bounds.extend(L.geoJSON(sector.geometria).getBounds())
    if (bounds.isValid()) map.current?.fitBounds(bounds, { padding: [25, 25], maxZoom: 16 })
  }, [props.fitKey])
  return <div className="relative isolate overflow-hidden rounded-xl border bg-muted">
    <div ref={host} role="region" aria-label="Mapa del campo. Usá los controles para dibujar áreas o marcar instalaciones." className="h-[440px] w-full sm:h-[min(68vh,600px)] [&_.leaflet-container]:font-sans" />
    {tilesFailed && <p role="status" className="absolute bottom-8 left-3 right-3 z-[500] rounded-md bg-background/95 p-2 text-xs shadow">Algunas imágenes no cargaron. Probá otra vista o acercamiento. Tus sectores siguen guardados.</p>}
  </div>
}
