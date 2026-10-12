import { describe, expect, it } from "vitest"
import { buscarAyuda, normalizar, seccionDeRuta, type SeccionAyuda } from "@/lib/ayuda/buscar"
import { SECCIONES_AYUDA } from "@/lib/ayuda/contenido"

const secciones: SeccionAyuda[] = [
  { id: "sanidad", titulo: "Sanidad", descripcion: "", guias: [{ id: "vacunar", titulo: "Registrar una vacunación", pasos: ["Tocá «Nueva aplicación»"] }, { id: "retiro", titulo: "Carencia", notas: ["No se puede faenar"] }] },
  { id: "ganado", titulo: "Ganado", descripcion: "", guias: [{ id: "alta", titulo: "Dar de alta un animal" }] },
]

describe("búsqueda de la ayuda", () => {
  it("ignora tildes y mayúsculas y exige todas las palabras", () => {
    expect(normalizar("Vacunación")).toBe("vacunacion")
    expect(buscarAyuda(secciones, "VACUNACION").map((s) => s.guias.map((g) => g.id))).toEqual([["vacunar"]])
    expect(buscarAyuda(secciones, "registrar faenar")).toEqual([])
    // Busca también en el título de la sección, los pasos y las notas
    expect(buscarAyuda(secciones, "sanidad faenar")[0].guias.map((g) => g.id)).toEqual(["retiro"])
    expect(buscarAyuda(secciones, "  ")).toBe(secciones)
    // Palabras largas por su raíz: «vacunaciones» encuentra «vacunación»
    expect(buscarAyuda(secciones, "vacunaciones").map((s) => s.id)).toEqual(["sanidad"])
  })
  it("relaciona cada pantalla con su sección", () => {
    expect(seccionDeRuta("/")).toBe("panel")
    expect(seccionDeRuta("/sanidad/protocolos")).toBe("sanidad")
    expect(seccionDeRuta("/configuracion/equipo")).toBe("equipo")
    expect(seccionDeRuta("/configuracion/establecimientos")).toBe("configuracion")
    expect(seccionDeRuta("/mapa")).toBe("potreros")
  })
})

describe("contenido de la ayuda", () => {
  it("ids únicos, sin guías vacías y con una sección por cada módulo del menú", async () => {
    const ids = SECCIONES_AYUDA.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of SECCIONES_AYUDA) {
      const guias = s.guias.map((g) => g.id)
      expect(new Set(guias).size, s.id).toBe(guias.length)
      for (const g of s.guias) expect((g.pasos?.length ?? 0) + (g.notas?.length ?? 0) + (g.resumen ? 1 : 0), `${s.id}/${g.id}`).toBeGreaterThan(0)
    }
    const { navItems } = await import("@/lib/config/navigation")
    for (const item of navItems.filter((n) => n.href !== "/ayuda")) expect(ids, item.href).toContain(seccionDeRuta(item.href))
  })
})
