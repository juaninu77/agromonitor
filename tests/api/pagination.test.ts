import { describe, it, expect } from "vitest"
import { parsePagination } from "@/lib/api/pagination"

describe("paginación de inventario", () => {
  it("aplica valores por defecto", () => {
    expect(parsePagination(new URLSearchParams())).toMatchObject({ success: true, data: { page: 1, limit: 20 } })
  })
  it.each(["page=0", "page=-1", "page=abc", "page=2x", "page=1.5", "limit=0", "limit=101", "limit=Infinity", "page=9007199254740991&limit=100"])("rechaza %s", (query) => {
    expect(parsePagination(new URLSearchParams(query)).success).toBe(false)
  })
  it("acepta páginas válidas", () => {
    expect(parsePagination(new URLSearchParams("page=3&limit=50"))).toMatchObject({ success: true, data: { page: 3, limit: 50 } })
  })
})
