import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ getPendingItems: vi.fn(), syncPendingItems: vi.fn() }))
vi.mock("@/lib/hardware/offline-queue", () => ({ ...mocks, esConflicto: (i: { estado?: string }) => i.estado === "conflicto" }))
import { finalizeSession } from "@/lib/hardware/finalize-session"

const fetchMock = vi.fn()
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  mocks.getPendingItems.mockResolvedValue([])
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { totalSanidad: 0 } }) })
})
afterEach(() => vi.unstubAllGlobals())

describe("finalizar desde la interfaz", () => {
  it("usa el endpoint que genera los eventos", async () => {
    await finalizeSession("session")
    expect(fetchMock).toHaveBeenCalledWith("/api/manga/session/finalizar", { method: "POST" })
  })
  it("no cierra mientras quedan lecturas sin subir", async () => {
    mocks.getPendingItems.mockResolvedValue([{ id: 1 }])
    await expect(finalizeSession("session")).rejects.toThrow("pendientes")
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("sincroniza antes de cerrar", async () => {
    mocks.getPendingItems.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([])
    await finalizeSession("session")
    expect(mocks.syncPendingItems).toHaveBeenCalledWith("session")
    expect(fetchMock).toHaveBeenCalledOnce()
  })
  it("con lecturas rechazadas no cierra y pide revisarlas (no se queda trabada como pendiente)", async () => {
    mocks.getPendingItems.mockResolvedValue([{ id: 1, estado: "conflicto" }, { id: 2, estado: "conflicto" }])
    await expect(finalizeSession("session")).rejects.toThrow("Hay 2 lecturas rechazadas por el sistema. Revisalas en «Para revisar»")
    // Las rechazadas no se reenvían solas
    expect(mocks.syncPendingItems).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("muestra errores del servidor", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Sesión ya finalizada" }) })
    await expect(finalizeSession("session")).rejects.toThrow("Sesión ya finalizada")
  })
})
