import type { Geometry, Position } from "./geometry"
export interface MapSector {
  id: string; nombre: string; tipo: string; descripcion: string | null; version: number;
  geometria: Geometry | null; superficieHa: number | null; areaMapaHa: number | null;
  bovinos: number; ovinos: number;
  forrajes: { id: string; forraje: { nombre: string }; estado: string; superficieHa: number | null }[];
  pastoreosIngreso: { id: string; lote: { id: string; nombre: string; especie: { nombre: string } } }[];
}
export interface MapDraft {
  id?: string; version?: number; nombre: string; tipo: string; descripcion: string;
  kind: "Point" | "Polygon"; vertices: Position[]; drawing: boolean;
}
export interface MapFocus { lat: number; lon: number; zoom: number; key: number }
