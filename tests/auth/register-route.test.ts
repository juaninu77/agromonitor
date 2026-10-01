import { beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), transaction: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: { usuario: { findFirst: mocks.findFirst }, $transaction: mocks.transaction },
}))
import { POST } from "@/app/api/auth/register/route"

const payload = { nombre: "Juan", apellido: "Pérez", email: "Juan@Gmail.com", password: "vacas2026" }
const req = (body: unknown) =>
  new Request("http://localhost/api/auth/register", { method: "POST", body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findFirst.mockResolvedValue(null)
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      usuario: { create: vi.fn(async ({ data }) => ({ id: "u1", ...data })) },
      organizacion: { create: vi.fn(async () => ({ id: "o1" })) },
      membresia: { create: vi.fn(async () => ({})) },
      establecimiento: { create: vi.fn(async () => ({})) },
    }
    return fn(tx)
  })
})

describe("POST /api/auth/register", () => {
  it("crea la cuenta con el email normalizado y sin exponer el hash", async () => {
    const res = await POST(req(payload))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.user.email).toBe("juan@gmail.com")
    expect(body.user.passwordHash).toBeUndefined()
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: { equals: "juan@gmail.com", mode: "insensitive" } } })
    )
  })

  it("rechaza contraseñas débiles con error por campo", async () => {
    const res = await POST(req({ ...payload, password: "123456" }))
    expect(res.status).toBe(400)
    expect((await res.json()).fieldErrors.password).toBeDefined()
  })

  it("devuelve 409 si el email ya existe", async () => {
    mocks.findFirst.mockResolvedValue({ id: "u0" })
    const res = await POST(req(payload))
    expect(res.status).toBe(409)
    expect((await res.json()).fieldErrors.email).toBeDefined()
  })

  it("devuelve 503 si la base no tiene las tablas", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.findFirst.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("table does not exist", { code: "P2021", clientVersion: "x" })
    )
    const res = await POST(req(payload))
    expect(res.status).toBe(503)
    log.mockRestore()
  })

  it("rechaza JSON inválido", async () => {
    const res = await POST(new Request("http://localhost/api/auth/register", { method: "POST", body: "{" }))
    expect(res.status).toBe(400)
  })
})
