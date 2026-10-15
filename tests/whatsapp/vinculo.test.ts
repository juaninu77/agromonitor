import { beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"

const m = vi.hoisted(() => ({ upsert: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), audit: vi.fn() }))
vi.mock("@/lib/prisma", () => {
  const tx = { whatsappVinculo: { upsert: m.upsert, findFirst: m.findFirst, findUnique: m.findUnique, update: m.update }, auditLog: { create: m.audit } }
  return { prisma: { ...tx, $transaction: (cb: unknown) => (typeof cb === "function" ? cb(tx) : Promise.all(cb as unknown[])) } }
})
import { crearCodigoVinculo, generarCodigo, hashCodigo, leerCodigo, vincularNumero } from "@/lib/whatsapp/vinculo"

beforeEach(() => {
  vi.resetAllMocks()
  process.env.WHATSAPP_NUMERO = "+54 9 2966 000000"
})

describe("código de vinculación", () => {
  it("usa 6 caracteres sin letras ni números confundibles", () => {
    for (let i = 0; i < 50; i++) expect(generarCodigo()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
  })
  it("se lee del mensaje con o sin espacios y en minúsculas", () => {
    expect(leerCodigo("VINCULAR K7Q2MZ")).toBe("K7Q2MZ")
    expect(leerCodigo("  vincular k7q 2mz ")).toBe("K7Q2MZ")
    expect(leerCodigo("vincular K7Q2")).toBeNull()
    expect(leerCodigo("hola vincular K7Q2MZ")).toBeNull()
    expect(leerCodigo(null)).toBeNull()
  })
  it("guarda solo el hash, vence a los 10 minutos y arma el enlace de WhatsApp", async () => {
    const r = await crearCodigoVinculo("u1")
    const args = m.upsert.mock.calls[0][0]
    expect(args.create.codigoHash).toBe(hashCodigo(r.codigo))
    expect(args.create.codigoHash).not.toContain(r.codigo)
    expect(r.expira.getTime() - Date.now()).toBeGreaterThan(9 * 60_000)
    expect(r.enlace).toBe(`https://wa.me/5492966000000?text=VINCULAR%20${r.codigo}`)
  })
  it("si choca con el código de otro usuario genera otro", async () => {
    m.upsert.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }))
    await crearCodigoVinculo("u1")
    expect(m.upsert).toHaveBeenCalledTimes(2)
  })
})

describe("vincular el número", () => {
  it("rechaza un código inexistente o vencido", async () => {
    m.findFirst.mockResolvedValue(null)
    expect(await vincularNumero("549111", "K7Q2MZ")).toEqual({ ok: false })
    expect(m.findFirst.mock.calls[0][0].where).toMatchObject({ codigoHash: hashCodigo("K7Q2MZ"), codigoExpira: { gt: expect.any(Date) }, usuario: { esActivo: true } })
    expect(m.update).not.toHaveBeenCalled()
  })
  it("vincula, borra el código (un solo uso) y saca el número de otra cuenta", async () => {
    m.findFirst.mockResolvedValue({ id: "v1", usuarioId: "u1", usuario: { nombre: "Ana" } })
    m.findUnique.mockResolvedValue({ id: "v-otro" })
    const r = await vincularNumero("549111", "K7Q2MZ")
    expect(r).toEqual({ ok: true, usuarioId: "u1", vinculoId: "v1", nombre: "Ana", reemplazado: true })
    expect(m.update).toHaveBeenCalledWith({ where: { id: "v-otro" }, data: { waId: null, verificadoAt: null } })
    expect(m.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: expect.objectContaining({ waId: "549111", codigoHash: null, codigoExpira: null }) })
    expect(m.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ tabla: "whatsapp_vinculos", rowPk: "v1" }) })
  })
})
