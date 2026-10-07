"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import * as L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { MapDraft, MapSector, MapFocus } from "@/lib/mapa/types"
import { areaHa, polygonFrom, type Geometry, type Position } from "@/lib/mapa/geometry"
import { colorDeLugar, grupoDeTipo, indicadorDeModo, type ModoColor } from "@/lib/mapa/capas"
import { formatearEv, textoEspecies } from "@/lib/mapa/carga"
import { bindVertexDrag } from "@/lib/mapa/live-edit"
import { distanciaM, formatearDistancia, proyectarEnSegmento, rectanguloDesde3Puntos } from "@/lib/mapa/drawing"

interface Props {
  sectors: MapSector[]; selected: string | null; draft: MapDraft | null; focus: MapFocus | null;
  satellite: boolean; fitKey: number;
  /** Selecciona un lugar; `tab` abre la ficha en esa pestaña (p. ej. "animales"). */
  onSelect: (id: string, tab?: string) => void;
  /** Modo de color (tipo, ocupación, carga, pasto o días). */
  modoColor: ModoColor;
  /** Grupos de capas ocultos. */
  capasOcultas: string[];
  /** Etiquetas permanentes con nombre, ganado e indicador. */
  etiquetas: boolean;
  /** Nuevos vértices; con `terminar` además cierra el trazo en el mismo cambio. */
  onVertices: (vertices: Position[], terminar?: boolean) => void;
  /** Termina el trazo en curso (cerrar contorno, terminar línea o rectángulo). */
  onFinish: () => void;
  /** Imán: acercar clics a vértices y bordes existentes. */
  snap: boolean;
  /** Vista previa de las dos partes al dividir un potrero. */
  preview?: Position[][] | null;
  panelRef?: RefObject<HTMLElement | null>;
}

// Distancias del imán en píxeles de pantalla (independientes del zoom)
const IMAN_VERTICE_PX = 14, IMAN_BORDE_PX = 10, CERRAR_PX = 16, DUPLICADO_PX = 4
const COLOR_BORRADOR = "#f59e0b", COLOR_IMAN = "#0ea5e9"
const COLORES_PREVIA = ["#0ea5e9", "#a855f7"]
const ll = ([lon, lat]: Position): L.LatLngTuple => [lat, lon]
const fmtHa = (ha: number) => `${ha.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ha`

/** Anillos y líneas de una geometría, para el imán. */
function trazos(g: Geometry | null): { puntos: Position[]; cerrado: boolean }[] {
  if (!g) return []
  if (g.type === "Point") return [{ puntos: [g.coordinates], cerrado: false }]
  if (g.type === "LineString") return [{ puntos: g.coordinates, cerrado: false }]
  return [{ puntos: g.coordinates[0].slice(0, -1), cerrado: true }]
}

/** Centro visual de una geometría (para la etiqueta). */
function centro(g: Geometry): L.LatLng {
  if (g.type === "Point") return L.latLng(g.coordinates[1], g.coordinates[0])
  if (g.type === "LineString") { const p = g.coordinates[Math.floor(g.coordinates.length / 2)]; return L.latLng(p[1], p[0]) }
  return L.polygon(g.coordinates[0].map(ll)).getBounds().getCenter()
}

/** Etiqueta del lugar armada con nodos DOM (los nombres son texto del usuario, nunca HTML). */
function etiquetaDeLugar(sector: MapSector, modo: ModoColor): HTMLElement {
  const caja = document.createElement("div"); caja.className = "map-label"
  const nombre = document.createElement("strong"); nombre.textContent = sector.nombre; caja.append(nombre)
  const indicador = indicadorDeModo(sector, modo)
  if (sector.animales > 0) {
    const ganado = document.createElement("button"); ganado.type = "button"; ganado.className = "map-label-badge"
    ganado.textContent = `${textoEspecies(sector.porEspecie)} · ${formatearEv(sector.ev)} EV`
    ganado.title = "Ver el ganado de este lugar"
    caja.append(ganado)
  }
  for (const p of sector.pastoreosIngreso) {
    const lote = document.createElement("span"); lote.className = "map-label-lote"; lote.textContent = p.lote.nombre; caja.append(lote)
  }
  if (indicador) { const ind = document.createElement("span"); ind.className = "map-label-ind"; ind.textContent = indicador; caja.append(ind) }
  return caja
}

export default function FieldMap(props: Props) {
  const host = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null), guide = useRef<L.LayerGroup | null>(null)
  const latest = useRef(props), fitted = useRef(false)
  latest.current = props
  const [tilesFailed, setTilesFailed] = useState(false), [zoomActual, setZoomActual] = useState(5)

  function fitVisibleArea(bounds: L.LatLngBounds, maxZoom: number) {
    const m = map.current, box = host.current?.getBoundingClientRect()
    if (!m || !box) return
    const panel = latest.current.panelRef?.current?.getBoundingClientRect()
    const sidePanel = panel && panel.top < box.top + 24
    const right = panel && sidePanel ? Math.max(0, box.right - panel.left) : 0
    const bottom = panel && !sidePanel ? Math.max(0, box.bottom - panel.top) : 0
    m.fitBounds(bounds, {
      paddingTopLeft: [30, 110],
      paddingBottomRight: [Math.min(right + 60, box.width - 150), Math.min(bottom + 35, box.height - 230)],
      maxZoom,
    })
  }

  /** Distancia en píxeles entre dos posiciones en la vista actual. */
  function px(a: Position, b: Position) {
    const m = map.current!
    return m.latLngToContainerPoint(ll(a)).distanceTo(m.latLngToContainerPoint(ll(b)))
  }

  /**
   * Acerca un punto al vértice más cercano (prioridad) o al borde más cercano
   * de los lugares dibujados y del propio borrador.
   */
  function imantar(latlng: L.LatLng, excluirIndice?: number): { p: Position; iman: "vertice" | "borde" | null } {
    const m = map.current, { draft, snap, sectors } = latest.current
    const crudo: Position = [latlng.wrap().lng, latlng.lat]
    if (!m || !snap) return { p: crudo, iman: null }
    const c = m.latLngToContainerPoint(latlng)
    const lineas: { puntos: Position[]; cerrado: boolean }[] = []
    for (const s of sectors) if (s.id !== draft?.id) lineas.push(...trazos(s.geometria))
    if (draft) {
      const propios = draft.vertices.filter((_, i) => i !== excluirIndice)
      if (propios.length) lineas.push({ puntos: propios, cerrado: false })
    }
    let mejor: Position | null = null, dMejor = IMAN_VERTICE_PX
    for (const t of lineas) for (const v of t.puntos) {
      const d = c.distanceTo(m.latLngToContainerPoint(ll(v)))
      if (d < dMejor) { dMejor = d; mejor = v }
    }
    if (mejor) return { p: mejor, iman: "vertice" }
    dMejor = IMAN_BORDE_PX
    let enBorde: L.Point | null = null
    for (const t of lineas) {
      const n = t.puntos.length, lados = t.cerrado ? n : n - 1
      for (let i = 0; i < lados; i++) {
        const a = m.latLngToContainerPoint(ll(t.puntos[i])), b = m.latLngToContainerPoint(ll(t.puntos[(i + 1) % n]))
        const { punto } = proyectarEnSegmento([c.x, c.y], [a.x, a.y], [b.x, b.y])
        const d = Math.hypot(punto[0] - c.x, punto[1] - c.y)
        if (d < dMejor) { dMejor = d; enBorde = L.point(punto[0], punto[1]) }
      }
    }
    if (enBorde) { const q = m.containerPointToLatLng(enBorde); return { p: [q.lng, q.lat], iman: "borde" } }
    return { p: crudo, iman: null }
  }

  /** Línea elástica, rectángulo en curso y medida junto al cursor. */
  function dibujarGuia(latlng: L.LatLng) {
    const g = guide.current, draft = latest.current.draft
    g?.clearLayers()
    if (!g || !draft?.drawing || draft.kind === "Point") return
    const { p, iman } = imantar(latlng)
    const v = draft.vertices, forma = draft.forma ?? draft.kind
    let texto = ""
    if (forma === "Rectangle" && v.length === 2) {
      const r = rectanguloDesde3Puntos(v[0], v[1], p)
      if (r) {
        L.polygon(r.map(ll), { color: COLOR_BORRADOR, weight: 2, dashArray: "6 6", fillOpacity: 0.15, interactive: false }).addTo(g)
        texto = `${formatearDistancia(distanciaM(r[0], r[1]))} × ${formatearDistancia(distanciaM(r[1], r[2]))} · ${fmtHa(areaHa(polygonFrom(r))!)}`
      }
    } else if (v.length) {
      const ultimo = v[v.length - 1]
      L.polyline([ll(ultimo), ll(p)], { color: COLOR_BORRADOR, weight: 2, dashArray: "6 6", interactive: false }).addTo(g)
      texto = formatearDistancia(distanciaM(ultimo, p))
      if (draft.kind === "Polygon" && v.length >= 2) {
        L.polyline([ll(p), ll(v[0])], { color: COLOR_BORRADOR, weight: 1, dashArray: "2 6", opacity: 0.7, interactive: false }).addTo(g)
        if (v.length >= 3 && px(p, v[0]) < CERRAR_PX) texto = "Cerrar contorno"
      }
    }
    const cursor = L.circleMarker(ll(p), {
      radius: iman ? 7 : 4, color: iman ? COLOR_IMAN : COLOR_BORRADOR, weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false,
    }).addTo(g)
    if (texto) cursor.bindTooltip(texto, { permanent: true, direction: "right", offset: [10, 0], className: "map-measure" }).openTooltip()
  }

  useEffect(() => {
    if (!host.current) return
    const m = L.map(host.current, { center: [-42, -67], zoom: 5, minZoom: 3, maxZoom: 20, doubleClickZoom: false, zoomControl: false })
    map.current = m; layer.current = L.layerGroup().addTo(m); guide.current = L.layerGroup().addTo(m)
    L.control.zoom({ position: "topleft", zoomInTitle: "Acercar mapa", zoomOutTitle: "Alejar mapa" }).addTo(m)
    L.control.scale({ imperial: false }).addTo(m)
    m.on("zoomend", () => setZoomActual(m.getZoom()))
    m.on("click", (event: L.LeafletMouseEvent) => {
      const { draft, onVertices, onFinish } = latest.current
      if (!draft?.drawing) return
      const { p } = imantar(event.latlng)
      if (draft.kind === "Point") { onVertices([p]); return }
      const v = draft.vertices, forma = draft.forma ?? draft.kind
      // El segundo clic de un doble clic no agrega un vértice repetido
      if (v.length && px(p, v[v.length - 1]) < DUPLICADO_PX) return
      if (forma === "Rectangle") {
        if (v.length < 2) { onVertices([...v, p]); return }
        const r = rectanguloDesde3Puntos(v[0], v[1], p)
        if (r) { onVertices(r, true); guide.current?.clearLayers() }
        return
      }
      if (draft.kind === "Polygon" && v.length >= 3 && px(p, v[0]) < CERRAR_PX) { onFinish(); guide.current?.clearLayers(); return }
      onVertices(v.length < 500 ? [...v, p] : v)
    })
    m.on("dblclick", () => {
      const { draft, onFinish } = latest.current
      if (!draft?.drawing || draft.kind === "Point" || draft.forma === "Rectangle") return
      if (draft.vertices.length >= (draft.kind === "LineString" ? 2 : 3)) { onFinish(); guide.current?.clearLayers() }
    })
    m.on("mousemove", (e: L.LeafletMouseEvent) => dibujarGuia(e.latlng))
    m.on("mouseout", () => guide.current?.clearLayers())
    const observer = new ResizeObserver(() => m.invalidateSize())
    observer.observe(host.current)
    // Al desmontar (o en el doble montaje de desarrollo) el próximo mapa vuelve a encuadrar
    return () => { observer.disconnect(); m.remove(); map.current = null; fitted.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!props.draft?.drawing) guide.current?.clearLayers()
    const bounds = L.latLngBounds([])
    const zoom = m.getZoom()
    const candidatas: { sector: MapSector; geometria: Geometry; shape: L.GeoJSON }[] = []
    for (const sector of props.sectors) {
      if (!sector.geometria || props.draft?.id === sector.id) continue
      if (props.capasOcultas.includes(grupoDeTipo(sector.tipo)) && sector.id !== props.selected) continue
      const color = colorDeLugar(sector, props.modoColor, props.satellite)
      const esAlambrado = sector.tipo === "alambrado"
      const shape = L.geoJSON(sector.geometria, {
        interactive: !props.draft,
        style: {
          color, weight: sector.id === props.selected ? 4 : esAlambrado ? 3 : 2,
          dashArray: esAlambrado ? "8 5" : undefined,
          fillOpacity: sector.id === props.selected ? 0.4 : 0.2,
        },
        pointToLayer: (_f, point) => L.circleMarker(point, { radius: 9, color: "white", weight: 2, fillColor: color, fillOpacity: 1, interactive: !props.draft }),
      }).addTo(group)
      shape.on("click", () => { if (!latest.current.draft) latest.current.onSelect(sector.id) })
      bounds.extend(shape.getBounds())
      // Etiqueta permanente si el área se ve con tamaño suficiente en pantalla (o desde zoom 16
      // para puntos y líneas); siempre para el lugar elegido.
      const caja = sector.geometria.type === "Polygon" ? shape.getBounds() : null
      const tamano = caja ? m.latLngToContainerPoint(caja.getNorthEast()).subtract(m.latLngToContainerPoint(caja.getSouthWest())) : null
      const visibleEnPantalla = tamano ? Math.abs(tamano.x) >= 28 && Math.abs(tamano.y) >= 18 : zoom >= 16
      const mostrar = props.etiquetas && (visibleEnPantalla || sector.id === props.selected)
      if (mostrar) candidatas.push({ sector, geometria: sector.geometria, shape })
      else {
        const label = document.createElement("span"); label.textContent = sector.nombre
        shape.bindTooltip(label, { sticky: true })
      }
    }
    // Etiquetas sin superponerse: primero el lugar elegido, después los que tienen ganado y los más grandes.
    // Las que no entran quedan como tooltip al pasar el mouse.
    candidatas.sort((a, b) =>
      Number(b.sector.id === props.selected) - Number(a.sector.id === props.selected) ||
      b.sector.animales - a.sector.animales || (b.sector.areaMapaHa ?? 0) - (a.sector.areaMapaHa ?? 0))
    const ocupadas: { x1: number; y1: number; x2: number; y2: number }[] = []
    for (const { sector, geometria, shape } of candidatas) {
      const el = etiquetaDeLugar(sector, props.modoColor)
      const punto = geometria.type === "Point"
      if (punto) el.classList.add("map-label-punto")
      const c = m.latLngToContainerPoint(centro(geometria))
      const textos = [sector.nombre, ...(sector.animales > 0 ? [`${textoEspecies(sector.porEspecie)} · ${formatearEv(sector.ev)} EV`] : [])]
      const ancho = Math.max(...textos.map(t => t.length * 6.6)) + 18
      const alto = 18 + (sector.animales > 0 ? 18 : 0) + sector.pastoreosIngreso.length * 15 + (indicadorDeModo(sector, props.modoColor) ? 15 : 0)
      const r = punto ? { x1: c.x + 10, y1: c.y - alto / 2, x2: c.x + 14 + ancho, y2: c.y + alto / 2 } : { x1: c.x - ancho / 2, y1: c.y - alto / 2, x2: c.x + ancho / 2, y2: c.y + alto / 2 }
      const choca = ocupadas.some(o => r.x1 < o.x2 + 4 && r.x2 + 4 > o.x1 && r.y1 < o.y2 + 2 && r.y2 + 2 > o.y1)
      if (choca && sector.id !== props.selected) {
        const label = document.createElement("span"); label.textContent = sector.nombre
        shape.bindTooltip(label, { sticky: true })
        continue
      }
      ocupadas.push(r)
      const marca = L.marker(centro(geometria), { interactive: !props.draft, keyboard: false, icon: L.divIcon({ className: "map-label-icon", html: el, iconSize: undefined }) }).addTo(group)
      marca.on("click", (e: L.LeafletMouseEvent) => {
        if (latest.current.draft) return
        const enGanado = (e.originalEvent.target as HTMLElement | null)?.closest(".map-label-badge")
        latest.current.onSelect(sector.id, enGanado ? "animales" : undefined)
      })
    }
    // Solo un borrador recuperado (ya trazado) centra el mapa: mientras se dibuja, el mapa no se mueve
    if (!fitted.current && props.draft?.vertices.length && !props.draft.drawing) { fitVisibleArea(L.latLngBounds(props.draft.vertices.map(ll)), 17); fitted.current = true }
    if (!fitted.current && bounds.isValid()) { fitVisibleArea(bounds, 16); fitted.current = true }

    // Vista previa de la división: las dos partes con su superficie
    props.preview?.forEach((parte, i) => {
      const poly = L.polygon(parte.map(ll), { color: COLORES_PREVIA[i % 2], weight: 2, fillOpacity: 0.35, interactive: false }).addTo(group)
      const ha = areaHa(polygonFrom(parte))
      if (ha != null) poly.bindTooltip(`Parte ${i + 1} · ${fmtHa(ha)}`, { permanent: true, direction: "center", className: "map-measure" })
    })

    const draft = props.draft
    if (!draft) return
    const vertices = draft.vertices, points = vertices.map(ll)
    const cerrado = draft.kind === "Polygon" && vertices.length >= 3 && !(draft.drawing && draft.forma === "Rectangle")
    const outline = cerrado
      ? L.polygon(points, { interactive: false, color: COLOR_BORRADOR, dashArray: draft.drawing ? "6 6" : undefined, weight: 3, fillOpacity: 0.2 }).addTo(group)
      : points.length > 1 ? L.polyline(points, { color: COLOR_BORRADOR, weight: 3, interactive: false }).addTo(group) : null

    // Medida de cada lado y punto medio para insertar vértices (al editar)
    const lados = draft.kind === "Point" ? 0 : cerrado ? vertices.length : vertices.length - 1
    const editando = !draft.drawing
    for (let i = 0; i < lados && vertices.length <= 200; i++) {
      const a = vertices[i], b = vertices[(i + 1) % vertices.length]
      const medio: Position = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const marca = L.marker(ll(medio), {
        draggable: editando, interactive: editando, keyboard: false,
        title: editando ? "Arrastrá o tocá para agregar un vértice" : undefined,
        icon: L.divIcon({ className: editando ? "map-midpoint" : "map-midpoint map-midpoint-quiet", html: "<span>+</span>", iconSize: [18, 18], iconAnchor: [9, 9] }),
      }).addTo(group)
      if (vertices.length <= 24) {
        marca.bindTooltip(formatearDistancia(distanciaM(a, b)), { permanent: true, direction: "top", offset: [0, -8], className: "map-edge-label" })
      }
      if (editando) {
        const insertar = (p: Position) => { if (latest.current.draft) latest.current.onVertices([...vertices.slice(0, i + 1), p, ...vertices.slice(i + 1)]) }
        marca.on("click", () => insertar(medio))
        marca.on("dragend", () => { const q = marca.getLatLng(); insertar([q.lng, q.lat]) })
      }
    }

    points.forEach((point, index) => {
      const primero = index === 0 && draft.drawing && draft.kind === "Polygon" && draft.forma !== "Rectangle" && vertices.length >= 3
      const marker = L.marker(point, {
        draggable: true, keyboard: true,
        title: primero ? "Tocá para cerrar el contorno" : `Vértice ${index + 1}${editando && vertices.length > (draft.kind === "Polygon" ? 3 : 2) ? " · clic derecho o mantener presionado para quitar" : ""}`,
        icon: L.divIcon({ className: primero ? "map-vertex map-vertex-close" : "map-vertex", html: `<span>${index + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
      }).addTo(group)
      if (primero) marker.on("click", () => { latest.current.onFinish(); guide.current?.clearLayers() })
      // Imán también al arrastrar un vértice
      marker.on("drag", () => {
        const { p, iman } = imantar(marker.getLatLng(), index)
        if (iman) marker.setLatLng(ll(p))
      })
      bindVertexDrag(marker, index, vertices,
        next => outline?.setLatLngs(next.map(ll)),
        next => { if (latest.current.draft) latest.current.onVertices(next) })
      marker.on("contextmenu", (e: L.LeafletMouseEvent) => {
        L.DomEvent.preventDefault(e.originalEvent)
        const minimo = draft.kind === "Polygon" ? 3 : draft.kind === "LineString" ? 2 : 1
        if (vertices.length > minimo && latest.current.draft) latest.current.onVertices(vertices.filter((_, i) => i !== index))
      })
    })
  }, [props.sectors, props.draft, props.selected, props.modoColor, props.capasOcultas, props.etiquetas, props.satellite, props.preview, zoomActual])

  useEffect(() => {
    const selected = props.sectors.find(s => s.id === props.selected)
    if (selected?.geometria) fitVisibleArea(L.geoJSON(selected.geometria).getBounds(), 17)
    // Selection changes center the map; background refreshes must not move a drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selected])
  useEffect(() => { if (props.focus) { map.current?.setView([props.focus.lat, props.focus.lon], props.focus.zoom); fitted.current = true } }, [props.focus])
  useEffect(() => {
    if (!props.fitKey) return
    const bounds = L.latLngBounds([])
    for (const sector of latest.current.sectors) if (sector.geometria) bounds.extend(L.geoJSON(sector.geometria).getBounds())
    if (bounds.isValid()) fitVisibleArea(bounds, 16)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fitKey])
  // Leaflet adds classes to its host; keep that className stable when resizing.
  return <div className="relative isolate h-full min-h-0 overflow-hidden rounded-xl border bg-muted">
    <div ref={host} role="region" aria-label="Mapa del campo. Usá los controles para dibujar áreas, líneas o marcar instalaciones." className="h-full w-full font-sans" data-drawing={props.draft?.drawing ? "true" : undefined} />
    {tilesFailed && <p role="status" className="absolute bottom-8 left-3 right-3 z-[500] rounded-md bg-background/95 p-2 text-xs shadow">Algunas imágenes no cargaron. Probá otra vista o acercamiento. Tus sectores siguen guardados.</p>}
  </div>
}
