import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ updateMany: vi.fn(), findFirst: vi.fn(), transaction: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }))
import { withMangaSession } from "@/lib/api/manga-session"

const tx = { sesionManga: { updateMany: mocks.updateMany, findFirst: mocks.findFirst } }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.transaction.mockImplementation(async (callback) => callback(tx))
  mocks.updateMany.mockResolvedValue({ count: 1 })
})
describe("escrituras de manga", () => {
  it("bloquea y limita la sesión al establecimiento antes de escribir", async () => {
    const operation = vi.fn(async () => "ok")
    expect(await withMangaSession("session", ["est"], operation)).toBe("ok")
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "session", establecimientoId: { in: ["est"] }, estado: { not: "finalizada" } },
      data: { totalAnimales: { increment: 0 } },
    })
    expect(operation).toHaveBeenCalledWith(tx)
    expect(mocks.updateMany.mock.invocationCallOrder[0]).toBeLessThan(operation.mock.invocationCallOrder[0])
  })
  it.each([[null, 404], [{ id: "session" }, 409]])("rechaza una sesión no editable (%s)", async (session, status) => {
    mocks.updateMany.mockResolvedValue({ count: 0 })
    mocks.findFirst.mockResolvedValue(session)
    const operation = vi.fn()
    await expect(withMangaSession("session", ["est"], operation)).rejects.toMatchObject({ status })
    expect(operation).not.toHaveBeenCalled()
  })
  it("propaga fallos para que la transacción haga rollback", async () => {
    await expect(withMangaSession("session", ["est"], async () => { throw new Error("write failed") })).rejects.toThrow("write failed")
  })
})
