import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ aprobar: vi.fn(), rechazar: vi.fn() }))
vi.mock("@/lib/api/with-auth", () => ({
  withAuth: (h: (r: unknown, c: unknown) => unknown) => async (r: unknown, rc: { params: Promise<Record<string, string>> }) => h(r, { userId: "u1", params: await rc.params }),
}))
vi.mock("@/lib/whatsapp/borradores", async (orig) => ({ ...(await orig<typeof import("@/lib/whatsapp/borradores")>()), aprobarBorrador: m.aprobar, rechazarBorrador: m.rechazar }))
import { NextRequest } from "next/server"
import { BorradorError } from "@/lib/whatsapp/borradores"
import { POST as aprobar } from "@/app/api/whatsapp/borradores/[id]/aprobar/route"
import { POST as rechazar } from "@/app/api/whatsapp/borradores/[id]/rechazar/route"

const ID = "00000000-0000-4000-8000-0000000000b1"
const pedir = (fn: typeof aprobar, body?: unknown) =>
  fn(new NextRequest(`http://localhost/api/whatsapp/borradores/${ID}/x`, { method: "POST", body: body ? JSON.stringify(body) : undefined }), { params: Promise.resolve({ id: ID }) } as never)

beforeEach(() => vi.resetAllMocks())

describe("bandeja de cargas por WhatsApp", () => {
  it("aprobar devuelve el resultado, también cuando hay que aceptar un aviso", async () => {
    m.aprobar.mockResolvedValue({ tipo: "confirmar", texto: "⚠️ Lote vencido" })
    const res = await pedir(aprobar)
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({ tipo: "confirmar", texto: "⚠️ Lote vencido" })
    expect(m.aprobar).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1" }), ID)
  })
  it("una carga ajena o ya revisada responde con su estado", async () => {
    m.aprobar.mockRejectedValue(new BorradorError("Esa carga ya fue revisada", 409))
    const res = await pedir(aprobar)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/ya fue revisada/)
  })
  it("rechazar exige un motivo", async () => {
    expect((await pedir(rechazar, { motivo: " " })).status).toBe(400)
    expect(m.rechazar).not.toHaveBeenCalled()
    m.rechazar.mockResolvedValue({ tipo: "rechazado", texto: "Carga rechazada." })
    expect((await pedir(rechazar, { motivo: "Dosis mal cargada" })).status).toBe(200)
    expect(m.rechazar).toHaveBeenCalledWith(expect.anything(), ID, "Dosis mal cargada")
  })
})
