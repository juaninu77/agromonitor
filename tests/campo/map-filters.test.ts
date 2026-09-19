import { describe, expect, it } from "vitest"
import { filterAnimals, filterPlaces } from "@/lib/mapa/filters"
import type { MapSector } from "@/lib/mapa/types"

const place = (id: string, values: Partial<MapSector> = {}): MapSector => ({
  id, nombre: id, tipo: "potrero", descripcion: null, version: 1, geometria: null,
  superficieHa: null, areaMapaHa: null, bovinos: 0, ovinos: 0, tieneAgua: false,
  tieneSombra: false, capacidad: null, pendientes: 0, agua: null, descanso: null,
  ultimaMedicion: null, forrajes: [], pastoreosIngreso: [], ...values,
})
const filters = { type: "todos", state: "todos", query: "" }

describe("Filtros combinables del mapa", () => {
  const places = [place("Potrero norte", { pendientes: 1, bovinos: 10 }), place("Potrero sur"), place("Galpón", { tipo: "galpon", pendientes: 2 })]
  it("combina tipo, estado y búsqueda en vez de reemplazarlos", () => {
    expect(filterPlaces(places, { type: "potrero", state: "pendientes", query: "norte" }).map(p => p.id)).toEqual(["Potrero norte"])
    expect(filterPlaces(places, { type: "galpon", state: "ocupado", query: "" })).toEqual([])
  })
  it("encuentra nombres aunque se omitan tildes o se usen mayúsculas", () => {
    expect(filterPlaces(places, { ...filters, query: " GALPON " }).map(p => p.id)).toEqual(["Galpón"])
  })
  it("incluye una parcela cultivada aunque también tenga ganado", () => {
    const mixed = place("Mixto", { bovinos: 5, forrajes: [{ id: "alfalfa", forraje: { nombre: "Alfalfa" }, estado: "implantado", superficieHa: 20 }] })
    expect(filterPlaces([mixed], { ...filters, state: "cultivado" })).toEqual([mixed])
    expect(filterPlaces([mixed], { ...filters, state: "ocupado" })).toEqual([mixed])
  })
  it("limpiar filtros vuelve a incluir todos los lugares", () => {
    expect(filterPlaces(places, filters)).toEqual(places)
  })
  it("distingue lugares sin geometría de los ubicados", () => {
    const located = place("Tanque", { tipo: "aguada", geometria: { type: "Point", coordinates: [-69, -45] } })
    expect(filterPlaces([...places, located], { ...filters, state: "sin-mapa" })).toEqual(places)
  })
})

describe("Búsqueda de ganado en una ficha", () => {
  const animals = [
    { caravanaVisual: "BOV-001", otroId: null, especie: { nombre: "Bovino" } },
    { caravanaVisual: "OV-001", otroId: "Electrónica-72", especie: { nombre: "ovino" } },
    { caravanaVisual: null, otroId: null, especie: { nombre: "ovino" } },
  ]
  it("combina caravana y especie sin incluir animales de la otra especie", () => {
    expect(filterAnimals(animals, "bovino", "001")).toEqual([animals[0]])
    expect(filterAnimals(animals, "ovino", "bov")).toEqual([])
  })
  it("busca por identificación alternativa y conserva animales sin identificación al limpiar", () => {
    expect(filterAnimals(animals, "todos", "electronica-72")).toEqual([animals[1]])
    expect(filterAnimals(animals, "ovino", "")).toEqual(animals.slice(1))
  })
})
