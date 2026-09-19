import type { MapSector } from "./types"

export type PlaceFilters = { type: string; state: string; query: string }
export const searchText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim()

export function filterPlaces(sectors: MapSector[], filters: PlaceFilters) {
  const query = searchText(filters.query)
  return sectors.filter(s => {
    if (filters.type !== "todos" && s.tipo !== filters.type) return false
    if (!searchText(s.nombre).includes(query)) return false
    switch (filters.state) {
      case "sin-mapa": return !s.geometria
      case "pendientes": return s.pendientes > 0
      case "ocupado": return s.bovinos + s.ovinos > 0
      case "descanso": return s.descanso?.estado === "inicio"
      case "cultivado": return s.forrajes.length > 0
      default: return true
    }
  })
}

export function filterAnimals<T extends { caravanaVisual: string | null; otroId: string | null; especie: { nombre: string } }>(animals: T[], species: string, query: string) {
  const normalized = searchText(query)
  return animals.filter(a => (species === "todos" || searchText(a.especie.nombre) === species)
    && [a.caravanaVisual, a.otroId].some(value => searchText(value ?? "").includes(normalized)))
}
