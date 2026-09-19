import { describe, expect, it, vi } from "vitest"
import { bindVertexDrag } from "../../lib/mapa/live-edit"
describe("Edición fluida del contorno", () => {
  it("mueve las líneas durante el arrastre y guarda el estado al soltar", () => {
    const handlers: Record<string, () => void> = {}
    let point = { lat: -45, lng: -69 }
    const marker = { on: (e: string, f: () => void) => { handlers[e] = f }, getLatLng: () => point }
    const render = vi.fn(), commit = vi.fn()
    bindVertexDrag(marker, 0, [[-69, -45], [-68, -45], [-68, -44]], render, commit)
    point = { lat: -45.1, lng: -69.2 }; handlers.drag()
    expect(render).toHaveBeenLastCalledWith([[-69.2, -45.1], [-68, -45], [-68, -44]])
    expect(commit).not.toHaveBeenCalled()
    point = { lat: -45.3, lng: -69.4 }; handlers.drag()
    expect(render).toHaveBeenCalledTimes(2)
    handlers.dragend()
    expect(commit).toHaveBeenCalledOnce()
    expect(commit).toHaveBeenLastCalledWith([[-69.4, -45.3], [-68, -45], [-68, -44]])
  })
})
