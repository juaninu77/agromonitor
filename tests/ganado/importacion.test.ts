import { describe, it, expect } from "vitest"
import * as XLSX from "xlsx"
import {
  mapearEncabezado,
  mapearEncabezados,
  filasDesdeMatriz,
  normalizarValor,
  generarPlantilla,
  COLUMNAS_PLANTILLA,
} from "@/lib/ganado/importacion"

describe("mapearEncabezado", () => {
  it("reconoce alias con acentos, mayúsculas y separadores", () => {
    expect(mapearEncabezado("Caravana")).toBe("caravanaVisual")
    expect(mapearEncabezado("CARAVANA VISUAL")).toBe("caravanaVisual")
    expect(mapearEncabezado("Categoría")).toBe("categoria")
    expect(mapearEncabezado("Fecha_de_Nacimiento")).toBe("fechaNacimiento")
    expect(mapearEncabezado("Peso (kg)")).toBe("pesoInicial")
    expect(mapearEncabezado("EID")).toBe("caravanaRfid")
    expect(mapearEncabezado("Columna rara")).toBeNull()
    expect(mapearEncabezado("")).toBeNull()
  })
  it("la plantilla usa encabezados que se reconocen a sí mismos", () => {
    for (const c of COLUMNAS_PLANTILLA) expect(mapearEncabezado(c.encabezado)).toBe(c.campo)
  })
})

describe("mapearEncabezados", () => {
  it("asigna columnas y lista las ignoradas", () => {
    const m = mapearEncabezados(["Caravana", "Sexo", "Raza", "Color de ojos", null, "Caravana"])
    expect(m.columnas).toEqual({ 0: "caravanaVisual", 1: "sexo", 2: "raza" })
    expect(m.ignorados).toEqual(["Color de ojos", "Caravana"])
  })
})

describe("normalizarValor", () => {
  it("traduce sexo y origen en lenguaje natural", () => {
    expect(normalizarValor("sexo", "Hembra")).toBe("F")
    expect(normalizarValor("sexo", "macho")).toBe("M")
    expect(normalizarValor("sexo", "x")).toBe("X")
    expect(normalizarValor("origen", "Cría propia")).toBe("cria_propia")
    expect(normalizarValor("origen", "Comprado")).toBe("compra")
  })
  it("mantiene números y fechas para que el servidor los interprete", () => {
    expect(normalizarValor("pesoInicial", 320)).toBe(320)
    expect(normalizarValor("pesoInicial", "320,5")).toBe("320.5")
    expect(normalizarValor("fechaNacimiento", 45444)).toBe(45444)
    expect(normalizarValor("fechaNacimiento", new Date(Date.UTC(2020, 2, 15)))).toBe("2020-03-15")
    expect(normalizarValor("notas", "   ")).toBeUndefined()
  })
})

describe("filasDesdeMatriz", () => {
  it("convierte la planilla en filas numeradas y saltea las vacías", () => {
    const { filas, mapeo } = filasDesdeMatriz([
      ["Caravana", "Sexo", "Raza", "Categoria", "Peso", "Lote"],
      ["a-1", "Hembra", "Hereford", "vaca", 410, "Rodeo 1"],
      [null, null, null, null, null, null],
      ["a-2", "M", "Hereford", "novillo", "", ""],
    ])
    expect(mapeo.reconocidos).toHaveLength(6)
    expect(filas).toEqual([
      { fila: 2, caravanaVisual: "a-1", sexo: "F", raza: "Hereford", categoria: "vaca", pesoInicial: 410, lote: "Rodeo 1" },
      { fila: 4, caravanaVisual: "a-2", sexo: "M", raza: "Hereford", categoria: "novillo" },
    ])
  })
})

describe("generarPlantilla", () => {
  it("genera un libro con hoja de datos e instrucciones que se puede volver a leer", () => {
    const wb = generarPlantilla({ razas: ["Angus Negro", "Hereford"], categorias: ["vaca"], lotes: ["Rodeo 1"], potreros: ["Norte"] })
    expect(wb.SheetNames).toEqual(["Animales", "Instrucciones"])
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Animales, { header: 1 })
    const { filas, mapeo } = filasDesdeMatriz(matriz)
    expect(mapeo.ignorados).toEqual([])
    expect(filas).toHaveLength(2)
    expect(filas[0].caravanaVisual).toBe("A-001")
    expect(filas[0].lote).toBe("Rodeo 1")
  })
})
