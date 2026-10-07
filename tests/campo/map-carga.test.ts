import { describe, expect, it } from "vitest"
import { cargaDeLugar, evDeAnimal, textoEspecies } from "@/lib/mapa/carga"

describe("carga animal (EV)", () => {
  it("usa la equivalencia de la categoría sin importar acentos ni mayúsculas", () => {
    expect(evDeAnimal("Bovino", "Vaquillona")).toBe(0.75)
    expect(evDeAnimal("bovino", "TORO")).toBe(1.2)
    expect(evDeAnimal("ovino", "Capón")).toBe(0.13)
  })
  it("si la categoría no está en la tabla usa el valor de la especie", () => {
    expect(evDeAnimal("bovino", "desconocida")).toBe(0.8)
    expect(evDeAnimal("equino", null)).toBe(1.2)
    expect(evDeAnimal("llama", null)).toBe(1)
  })
  it("resume animales por especie, EV, EV/ha y ocupación", () => {
    const c = cargaDeLugar(
      [
        { especie: "Bovino", categoria: "vaca", cantidad: 40 },
        { especie: "Bovino", categoria: "ternero", cantidad: 30 },
        { especie: "Ovino", categoria: "oveja", cantidad: 60 },
        { especie: "Equino", categoria: null, cantidad: 2 },
      ],
      50,
      100,
    )
    expect(c.animales).toBe(132)
    expect(c.porEspecie).toEqual({ bovino: 70, ovino: 60, equino: 2 })
    expect(c.ev).toBeCloseTo(40 + 15 + 10.2 + 2.4, 2)
    expect(c.evHa).toBeCloseTo(c.ev / 50, 2)
    expect(c.ocupacionPct).toBe(132)
    expect(textoEspecies(c.porEspecie)).toBe("70 bovinos · 60 ovinos · 2 equinos")
  })
  it("sin superficie ni capacidad no inventa carga", () => {
    const c = cargaDeLugar([{ especie: "bovino", categoria: "novillo", cantidad: 1 }], null, null)
    expect(c).toMatchObject({ animales: 1, ev: 0.95, evHa: null, ocupacionPct: null })
    expect(textoEspecies(c.porEspecie)).toBe("1 bovino")
  })
})
