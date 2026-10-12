import { describe, expect, it } from "vitest"
import {
  ACCIONES_MANGA, ESCALA_CC, PRESELECCION_POR_TIPO, TIPOS_SESION_MANGA, accionesIniciales, especieParaAlta, etiquetasAcciones,
  faltaParaAlta, textoTratamiento, unidadDosisPorDefecto,
} from "@/lib/hardware/manga-config"
import { categoriasPara, especiePorDefecto, type CatalogoManga } from "@/lib/hardware/catalogo-cache"
import { CC_MAX, CC_MIN } from "@/lib/validations/animal-schema"
import { MANGA } from "@/lib/ayuda/hacienda"

describe("acciones preseleccionadas por tipo de sesión", () => {
  it("coinciden con la documentación (Destete y Recepción incluidos)", () => {
    expect(PRESELECCION_POR_TIPO.destete).toEqual(["peso", "cc", "apartado"])
    expect(PRESELECCION_POR_TIPO.recepcion).toEqual(["peso", "cc", "registro"])
    expect(PRESELECCION_POR_TIPO.vacunacion).toEqual(["sanidad"])
    expect(PRESELECCION_POR_TIPO.general).toEqual(ACCIONES_MANGA.map((a) => a.id))
  })
  it("todo tipo tiene preselección y solo usa acciones existentes", () => {
    const ids = ACCIONES_MANGA.map((a) => a.id) as string[]
    for (const t of TIPOS_SESION_MANGA) {
      expect(PRESELECCION_POR_TIPO[t.value].length).toBeGreaterThan(0)
      for (const a of PRESELECCION_POR_TIPO[t.value]) expect(ids).toContain(a)
    }
  })
  it("sin permiso de sanidad no se preselecciona Sanidad", () => {
    expect(accionesIniciales("vacunacion", false)).toEqual([])
    expect(accionesIniciales("general", false)).not.toContain("sanidad")
    expect(accionesIniciales("general", true)).toContain("sanidad")
    expect(accionesIniciales("desconocido", true)).toEqual([])
  })
  it("el PDF lista las acciones con sus nombres", () => {
    expect(etiquetasAcciones(PRESELECCION_POR_TIPO.recepcion)).toBe("peso, cond. corporal, registro nuevo")
  })
  it("la guía de Ayuda describe la misma preselección", () => {
    const texto = MANGA.guias.flatMap((g) => [...(g.pasos ?? []), ...(g.notas ?? [])]).join(" ")
    expect(texto).toContain("Destete → Peso, Cond. Corporal y Apartado")
    expect(texto).toContain("Recepción → Peso, Cond. Corporal y Registro nuevo")
  })
})

describe("condición corporal", () => {
  it("usa la escala de Ganado (1 a 9)", () => {
    expect(ESCALA_CC[0]).toBe(String(CC_MIN))
    expect(ESCALA_CC[ESCALA_CC.length - 1]).toBe(String(CC_MAX))
    expect(ESCALA_CC).toHaveLength(9)
  })
})

describe("tratamiento de la sesión", () => {
  it("sugiere la unidad de la dosis según cómo se cuenta el producto", () => {
    expect(unidadDosisPorDefecto("ml")).toBe("ml")
    expect(unidadDosisPorDefecto("CC")).toBe("cc")
    expect(unidadDosisPorDefecto("comprimidos")).toBe("comprimido")
    expect(unidadDosisPorDefecto("frascos")).toBe("ml")
    expect(unidadDosisPorDefecto(null)).toBe("ml")
  })
  it("muestra producto, dosis con su unidad y vía", () => {
    expect(textoTratamiento({ producto: "Ivermectina 1%", dosis: 5.5, unidad: "ml", via: "subcutanea" }, () => "subcutánea")).toBe("Ivermectina 1% · 5,5 ml · subcutánea")
    expect(textoTratamiento({ producto: "Antiparasitario", dosis: 2, unidad: "comprimido" })).toBe("Antiparasitario · 2 comprimidos")
    expect(textoTratamiento({ producto: null })).toBe("Producto de la sesión")
  })
})

describe("alta de un EID nuevo", () => {
  it("dice con claridad qué falta", () => {
    expect(faltaParaAlta({ razaId: "r", categoriaId: "c" })).toBe("Para registrar el animal nuevo elegí el sexo")
    expect(faltaParaAlta({ sexo: "F" })).toBe("Para registrar el animal nuevo elegí la raza y la categoría")
    expect(faltaParaAlta({})).toBe("Para registrar el animal nuevo elegí el sexo, la raza y la categoría")
    expect(faltaParaAlta({ sexo: "M", razaId: "r", categoriaId: "c" })).toBeNull()
  })
  it("la especie es la elegida, si no la del lote de origen, si no la del campo", () => {
    expect(especieParaAlta({ elegida: "ovino", lote: "bovino", campo: "bovino" })).toBe("ovino")
    expect(especieParaAlta({ lote: "ovino", campo: "bovino" })).toBe("ovino")
    expect(especieParaAlta({ campo: "caprino" })).toBe("caprino")
    expect(especieParaAlta({})).toBeNull()
    // Solo especies del catálogo disponible
    expect(especieParaAlta({ lote: "otra", campo: "ovino", disponibles: ["ovino", "bovino"] })).toBe("ovino")
  })

  const catalogo: CatalogoManga = {
    especies: [{ id: "bov", nombre: "Bovino" }, { id: "ovi", nombre: "Ovino" }],
    razas: [{ id: "r1", nombre: "Angus", especieId: "bov" }, { id: "r2", nombre: "Merino", especieId: "ovi" }],
    categorias: [
      { id: "c1", nombre: "Vaca", especieId: "bov", sexo: "F", edadMinMeses: 30 },
      { id: "c2", nombre: "Ternera", especieId: "bov", sexo: "F", edadMinMeses: 0 },
      { id: "c3", nombre: "Toro", especieId: "bov", sexo: "M", edadMinMeses: 24 },
      { id: "c4", nombre: "Cordero", especieId: "ovi", sexo: null, edadMinMeses: 0 },
    ],
  }
  it("en el dispositivo usa la especie del lote, si no la del campo, y recién después «bovino»", () => {
    expect(especiePorDefecto(catalogo, "ovi", "bov")).toBe("ovi")
    expect(especiePorDefecto(catalogo, null, "ovi")).toBe("ovi")
    expect(especiePorDefecto(catalogo, null, null)).toBe("bov")
    expect(especiePorDefecto(catalogo, "inexistente", null)).toBe("bov")
  })
  it("ofrece las categorías de la especie y el sexo, de la más joven a la mayor", () => {
    expect(categoriasPara(catalogo, "bov", "F").map((c) => c.id)).toEqual(["c2", "c1"])
    expect(categoriasPara(catalogo, "ovi", "M").map((c) => c.id)).toEqual(["c4"])
  })
})
