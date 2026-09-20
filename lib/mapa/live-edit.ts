import type { Position } from "./geometry"

/** Keep the Leaflet path live while dragging; commit React state only on release. */
export function bindVertexDrag(
  marker: { on: (event: string, fn: () => void) => unknown; getLatLng: () => { lat: number; lng: number } },
  index: number,
  vertices: Position[],
  render: (points: Position[]) => void,
  commit: (points: Position[]) => void,
) {
  const moved = () => {
    const p = marker.getLatLng()
    return vertices.map((v, i): Position => i === index ? [p.lng, p.lat] : v)
  }
  marker.on("drag", () => render(moved()))
  marker.on("dragend", () => { const points = moved(); render(points); commit(points) })
}
