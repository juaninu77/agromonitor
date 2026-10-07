import { describe, expect, it } from "vitest"
import { rankearDestinos } from "@/lib/mapa/rotacion"
import type { MapSector } from "@/lib/mapa/types"

const hoy = new Date().toISOString()
const lugar = (v: Partial<MapSector>): MapSector => ({
  id: "s", nombre: "S", tipo: "potrero", descripcion: null, version: 1, geometria: null,
  superficieHa: 20, areaMapaHa: null, bovinos: 0, ovinos: 0, tieneAgua: false, tieneSombra: false, capacidad: null, pendientes: 0,
  agua: null, descanso: null, ultimaMedicion: null, forrajes: [], pastoreosIngreso: [],
  animales: 0, porEspecie: {}, ev: 0, evHa: 0, ocupacionPct: null, diasOcupacion: null, diasDescanso: null, ultimaSalida: null, ...v,
})

describe("sugerencia de destino", () => {
  it("prioriza el potrero más descansado y con más pasto, y explica por qué", () => {
    const r = rankearDestinos([
      lugar({ id: "origen", nombre: "Origen" }),
      lugar({ id: "a", nombre: "A", diasDescanso: 10 }),
      lugar({ id: "b", nombre: "B", diasDescanso: 45, ultimaMedicion: { fecha: hoy, alturaPastoCm: 18, msKgHa: null, coberturaPct: null } }),
      lugar({ id: "c", nombre: "C", animales: 30, ev: 25 }),
      lugar({ id: "corral", nombre: "Corral", tipo: "corral" }),
      lugar({ id: "aguada", nombre: "Aguada", tipo: "aguada" }),
    ], "origen", 20, 16)
    expect(r.map((d) => d.sector.id)).toEqual(["b", "a", "corral", "c"])
    expect(r[0].motivo).toBe("45 días de descanso · 18 cm de pasto · quedaría 0,8 EV/ha")
  })
  it("baja y avisa si supera la capacidad o falta agua", () => {
    const r = rankearDestinos([
      lugar({ id: "lleno", nombre: "Lleno", diasDescanso: 60, capacidad: 10 }),
      lugar({ id: "seco", nombre: "Seco", diasDescanso: 60, agua: { id: "r", tipo: "revision_agua", detalle: "", estado: "sin_agua", fecha: hoy, version: 1 } }),
      lugar({ id: "ok", nombre: "Ok", diasDescanso: 30 }),
    ], "x", 20, 16)
    expect(r[0].sector.id).toBe("ok")
    expect(r.find((d) => d.sector.id === "lleno")?.aviso).toBe("Supera la capacidad (20 de 10)")
    expect(r.find((d) => d.sector.id === "seco")?.aviso).toBe("Sin agua")
  })
})
