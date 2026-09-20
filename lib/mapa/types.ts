import type { Geometry, Position } from "./geometry"
export interface MapSector {
  id: string; nombre: string; tipo: string; descripcion: string | null; version: number;
  geometria: Geometry | null; superficieHa: number | null; areaMapaHa: number | null;
  bovinos: number; ovinos: number;
  tieneAgua: boolean; tieneSombra: boolean; capacidad: number | null;
  pendientes: number; agua: SectorRecord | null; descanso: SectorRecord | null;
  ultimaMedicion: { fecha: string; alturaPastoCm: number | null; msKgHa: number | null; coberturaPct: number | null } | null;
  forrajes: { id: string; forraje: { nombre: string }; estado: string; superficieHa: number | null }[];
  pastoreosIngreso: { id: string; lote: { id: string; nombre: string; especie: { nombre: string } } }[];
}
export interface MapDraft {
  id?: string; version?: number; nombre: string; tipo: string; descripcion: string;
  kind: "Point" | "Polygon" | "LineString"; vertices: Position[]; drawing: boolean;
}
export interface MapFocus { lat: number; lon: number; zoom: number; key: number }

export interface SectorRecord { id: string; tipo: string; detalle: string; estado: string; fecha: string; version: number }
