import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { addPendingItem, removePendingItem, syncPendingItems } from "@/lib/hardware/offline-queue"

let transaction: { oncomplete?: Function; onabort?: Function; onerror?: Function; error: Error | null; objectStore: Function }
let request: { result: number; onsuccess?: Function }
let openRequest: { result: unknown; onsuccess?: Function; onerror?: Function; error?: Error }
const close = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  request = { result: 7 }
  transaction = { error: null, objectStore: () => ({ add: () => request, delete: () => request }) }
  openRequest = { result: { transaction: () => transaction, close } }
  vi.stubGlobal("indexedDB", { open: () => openRequest })
})
afterEach(() => vi.unstubAllGlobals())
async function open() {
  openRequest.onsuccess?.()
  await Promise.resolve()
  await Promise.resolve()
}
describe("durabilidad de la cola offline", () => {
  it("espera el commit antes de confirmar una lectura", async () => {
    const done = vi.fn()
    const pending = addPendingItem({ sessionId: "s", eidLeido: "123", createdAt: "2026-01-01" })
    pending.then(done)
    await open()
    request.onsuccess?.()
    await Promise.resolve()
    expect(done).not.toHaveBeenCalled()
    transaction.oncomplete?.()
    expect(await pending).toBe(7)
    expect(close).toHaveBeenCalledOnce()
  })
  it("no informa éxito si el borrado se aborta", async () => {
    const pending = removePendingItem(7)
    const assertion = expect(pending).rejects.toThrow("disk full")
    await open()
    request.onsuccess?.()
    transaction.error = new Error("disk full")
    transaction.onabort?.()
    await assertion
    expect(close).toHaveBeenCalledOnce()
  })
  it("comparte una sincronización en curso para no enviar dos veces la misma cola", async () => {
    const first = syncPendingItems("session-single-flight")
    const second = syncPendingItems("session-single-flight")
    expect(first).toBe(second)
    const result = Promise.allSettled([first, second])
    openRequest.error = new Error("unavailable")
    openRequest.onerror?.()
    await result
    const retry = syncPendingItems("session-single-flight")
    expect(retry).not.toBe(first)
    const retryResult = Promise.allSettled([retry])
    openRequest.onerror?.()
    await retryResult
  })
})
