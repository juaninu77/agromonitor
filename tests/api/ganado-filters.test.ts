import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  lotes: vi.fn(),
}))
vi.mock("@/lib/api/with-auth", () => ({
  withAuth: (handler: Function) => (request: unknown) =>
    handler(request, { establecimientoIds: ["campo1", "campo2"] }),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    animal: { count: mocks.count, findMany: mocks.findMany },
    animalLoteHist: { findMany: mocks.lotes },
  },
}))
import { GET as routeGET } from "@/app/api/ganado/bovinos/route"
const get = (query: string) =>
  routeGET(new NextRequest(`http://localhost/api/ganado/bovinos?${query}`), {
    params: Promise.resolve({}),
  })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.count.mockResolvedValue(0)
  mocks.findMany.mockResolvedValue([])
  mocks.lotes.mockResolvedValue([])
})

describe("filtros de Ganado en el servidor", () => {
  it("aplica campo, especie, estado y categoría a lista, resumen y total", async () => {
    expect(
      (
        await get(
          "establecimientoId=campo1&especie=ovino&estadoVital=activo&categoriaId=oveja",
        )
      ).status,
    ).toBe(200)
    const where = mocks.count.mock.calls[0][0].where
    expect(where).toMatchObject({
      establecimientoId: { in: ["campo1"] },
      especie: { nombre: { equals: "ovino", mode: "insensitive" } },
      estadoVital: "activo",
      categoriaId: "oveja",
    })
    for (const [args] of mocks.findMany.mock.calls)
      expect(args.where).toEqual(where)
  })
  it("Todos conserva el campo y permite consultar animales vendidos", async () => {
    await get("establecimientoId=campo2&especie=todos&estadoVital=vendido")
    const where = mocks.count.mock.calls[0][0].where
    expect(where.establecimientoId).toEqual({ in: ["campo2"] })
    expect(where.especie).toBeUndefined()
    expect(where.estadoVital).toBe("vendido")
  })
  it("rechaza un campo ajeno sin consultar animales", async () => {
    expect((await get("establecimientoId=ajeno&especie=ovino")).status).toBe(
      403,
    )
    expect(mocks.count).not.toHaveBeenCalled()
  })
  it.each([
    "page=0",
    "page=-1",
    "page=NaN",
    "limit=0",
    "limit=1001",
    "limit=1.5",
    "especie=otro",
    "estadoVital=invalido",
    "orderDirection=invalid",
  ])("rechaza filtros inválidos: %s", async (query) => {
    expect((await get(query)).status).toBe(400)
    expect(mocks.count).not.toHaveBeenCalled()
  })
  it("busca RFID y nombre en el servidor antes de paginar", async () => {
    await get(
      "establecimientoId=campo1&especie=ovino&busqueda=RFID-999&page=2&limit=10",
    )
    const { where, skip, take, orderBy } = mocks.findMany.mock.calls[0][0]
    expect(where.OR).toContainEqual({
      caravanaRfid: { contains: "RFID-999", mode: "insensitive" },
    })
    expect(where.OR).toContainEqual({
      otroId: { contains: "RFID-999", mode: "insensitive" },
    })
    expect({ skip, take }).toEqual({ skip: 10, take: 10 })
    expect(orderBy.at(-1)).toEqual({ id: "asc" })
  })
  it("calcula reportes con todos los resultados y excluye pesos ausentes", async () => {
    mocks.count.mockResolvedValue(3)
    mocks.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        categoria: { nombre: "oveja" },
        estadoVital: "activo",
        eventosPesada: [{ pesoKg: 40 }],
      },
      {
        categoria: { nombre: "oveja" },
        estadoVital: "activo",
        eventosPesada: [{ pesoKg: 60 }],
      },
      {
        categoria: { nombre: "cordero" },
        estadoVital: "activo",
        eventosPesada: [],
      },
    ])
    const result = await (await get("especie=ovino&limit=1")).json()
    expect(result.stats).toMatchObject({
      total: 3,
      conPeso: 2,
      pesoPromedio: 50,
      porCategoria: { oveja: 2, cordero: 1 },
      pesoPorCategoria: [{ category: "oveja", count: 2, avgWeight: 50 }],
    })
    expect(result.pagination.totalPages).toBe(3)
    expect(mocks.findMany.mock.calls[1][0].include.eventosPesada.orderBy).toEqual([{ fecha: "desc" }, { createdAt: "desc" }, { id: "desc" }])
  })
})
