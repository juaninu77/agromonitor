import { describe, expect, it } from "vitest"
import { alertasDelCampo, colorDeLugar, grupoDeTipo, indicadorDeModo, leyendaDeModo, resumenDelCampo } from "@/lib/mapa/capas"
import type { MapSector } from "@/lib/mapa/types"

const hoy = new Date().toISOString()
const viejo = new Date(Date.now() - 60 * 86_400_000).toISOString()
const lugar = (v: Partial<MapSector>): MapSector => ({
  id: "s", nombre: "S", tipo: "potrero", descripcion: null, version: 1, geometria: { type: "Point", coordinates: [-69, -45] },
  superficieHa: 10, areaMapaHa: 10, bovinos: 0, ovinos: 0, tieneAgua: false, tieneSombra: false, capacidad: null, pendientes: 0,
  agua: null, descanso: null, ultimaMedicion: null, forrajes: [], pastoreosIngreso: [],
  animales: 0, porEspecie: {}, ev: 0, evHa: 0, ocupacionPct: null, diasOcupacion: null, diasDescanso: null, ultimaSalida: null, ...v,
})

describe("capas del mapa", () => {
  it("agrupa los tipos para mostrar u ocultar", () => {
    expect(grupoDeTipo("corral")).toBe("instalaciones")
    expect(grupoDeTipo("alambrado")).toBe("lineas")
    expect(grupoDeTipo("potrero")).toBe("parcelas")
  })
  it("colorea por carga, pasto y días con 'sin dato' en gris", () => {
    expect(colorDeLugar(lugar({ animales: 10, evHa: 2 }), "carga", true)).toBe("#1e3a8a")
    expect(colorDeLugar(lugar({ animales: 0 }), "carga", true)).toBe("#e5e7eb")
    expect(colorDeLugar(lugar({ ultimaMedicion: { fecha: hoy, alturaPastoCm: 12, msKgHa: null, coberturaPct: null } }), "pasto", true)).toBe("#65a30d")
    expect(colorDeLugar(lugar({ ultimaMedicion: { fecha: viejo, alturaPastoCm: 12, msKgHa: null, coberturaPct: null } }), "pasto", true)).toBe("#9ca3af")
    expect(colorDeLugar(lugar({ diasDescanso: 45 }), "dias", true)).toBe("#7c3aed")
    expect(colorDeLugar(lugar({ animales: 3 }), "dias", true)).toBe("#ea580c")
    expect(colorDeLugar(lugar({ tipo: "aguada" }), "pasto", true)).toBe("#cbd5e1")
  })
  it("la leyenda de tipo solo lista los tipos presentes y los indicadores son cortos", () => {
    expect(leyendaDeModo("tipo", ["corral", "potrero"]).map((i) => i.label)).toEqual(["Potrero", "Corral"])
    expect(indicadorDeModo(lugar({ animales: 5, evHa: 0.84 }), "carga")).toBe("0,8 EV/ha")
    expect(indicadorDeModo(lugar({ diasDescanso: 12 }), "dias")).toBe("12 d descanso")
  })
  it("arma alertas de agua, sobrecarga y pasto bajo", () => {
    const alertas = alertasDelCampo([
      lugar({ id: "a", nombre: "A", animales: 120, capacidad: 100, ocupacionPct: 120 }),
      lugar({ id: "b", nombre: "B", animales: 10, ultimaMedicion: { fecha: hoy, alturaPastoCm: 3, msKgHa: null, coberturaPct: null } }),
      lugar({ id: "c", nombre: "C", agua: { id: "r", tipo: "revision_agua", detalle: "", estado: "sin_agua", fecha: hoy, version: 1 } }),
    ])
    expect(alertas.map((a) => [a.sectorId, a.tipo])).toEqual([["c", "agua"], ["a", "sobrecarga"], ["b", "pasto"]])
  })
  it("resume superficie, ganado y carga global de las parcelas", () => {
    const r = resumenDelCampo([
      lugar({ id: "a", animales: 10, ev: 8, porEspecie: { bovino: 10 }, superficieHa: 20, areaMapaHa: 19.5 }),
      lugar({ id: "b", tipo: "corral", animales: 5, ev: 5, porEspecie: { bovino: 5 }, superficieHa: null, areaMapaHa: 0.2, geometria: null }),
    ])
    expect(r).toMatchObject({ animales: 15, ev: 13, cargaGlobal: 0.4, sinUbicar: 1, porEspecie: { bovino: 15 } })
    expect(r.hectareasPorTipo[0]).toEqual({ tipo: "potrero", mapaHa: 19.5, declaradaHa: 20 })
  })
})
