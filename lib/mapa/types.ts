import type { Geometry, Position } from "./geometry"
export interface MapSector {
  id: string; nombre: string; tipo: string; descripcion: string | null; version: number;
  geometria: Geometry | null; superficieHa: number | null; areaMapaHa: number | null;
  bovinos: number; ovinos: number;
  /** Todas las especies; EV y carga calculados en lib/mapa/carga.ts. */
  animales: number; porEspecie: Record<string, number>; ev: number; evHa: number | null; ocupacionPct: number | null;
  /** Días con animales (desde el ingreso del grupo o la primera ubicación) o sin animales desde la última salida. */
  diasOcupacion: number | null; diasDescanso: number | null; ultimaSalida: string | null; ocupadoDesde?: string | null;
  tieneAgua: boolean; tieneSombra: boolean; capacidad: number | null;
  pendientes: number; agua: SectorRecord | null; descanso: SectorRecord | null;
  ultimaMedicion: { fecha: string; alturaPastoCm: number | null; msKgHa: number | null; coberturaPct: number | null } | null;
  forrajes: { id: string; forraje: { nombre: string }; estado: string; superficieHa: number | null }[];
  pastoreosIngreso: { id: string; ingreso?: string; animalesPromedio?: number | null; lote: { id: string; nombre: string; especie: { nombre: string } } }[];
}
export interface MapDraft {
  id?: string; version?: number; nombre: string; tipo: string; descripcion: string;
  kind: "Point" | "Polygon" | "LineString"; vertices: Position[]; drawing: boolean;
  /** Herramienta de dibujo; "Rectangle" se guarda como Polygon. */
  forma?: "Polygon" | "Rectangle" | "LineString" | "Point";
  /** Si está, la línea dibujada divide ese potrero en dos. */
  dividir?: { id: string; version: number; nombre: string };
}
export interface MapFocus { lat: number; lon: number; zoom: number; key: number }

export interface SectorRecord { id: string; tipo: string; detalle: string; estado: string; fecha: string; version: number }
