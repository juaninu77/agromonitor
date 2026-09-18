import { afterEach, describe, expect, it, vi } from "vitest"
import { cargarTodosLosAnimales, ganadoParams } from "@/lib/ganado/query"
afterEach(() => vi.unstubAllGlobals())
describe("exportación por campo y especie", () => {
  it("incluye todas las páginas conservando cada filtro", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: "primero" }],
          pagination: { hasNextPage: true },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: "ultimo" }],
          pagination: { hasNextPage: false },
        }),
      })
    vi.stubGlobal("fetch", mock)
    const rows = await cargarTodosLosAnimales({
      establecimientoId: "campo",
      especie: "ovino",
      estadoVital: "activo",
      busqueda: "Majada",
      categoriaId: "oveja",
      loteId: "lote",
      page: 9,
    })
    expect(rows).toEqual([{ id: "primero" }, { id: "ultimo" }])
    mock.mock.calls.forEach(([url], i) => {
      const params = new URL(url, "http://localhost").searchParams
      expect(Object.fromEntries(params)).toMatchObject({
        establecimientoId: "campo",
        especie: "ovino",
        estadoVital: "activo",
        busqueda: "Majada",
        categoriaId: "oveja",
        loteId: "lote",
        page: String(i + 1),
      })
    })
  })
  it("no entrega un archivo parcial si falla una página", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: [{}],
            pagination: { hasNextPage: true },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: "Conexión perdida" }),
        }),
    )
    await expect(
      cargarTodosLosAnimales({ establecimientoId: "campo", especie: "ovino" }),
    ).rejects.toThrow("Conexión perdida")
  })
  it("no construye una consulta global cuando falta el campo", () => {
    expect(() =>
      ganadoParams({ establecimientoId: "", especie: "ovino" }),
    ).toThrow("Seleccioná un campo")
  })
})
