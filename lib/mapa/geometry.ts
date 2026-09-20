import { z } from "zod"
import { area } from "@turf/area"
import { kinks } from "@turf/kinks"

const position = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-85).max(85)])
const shape = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: position }).strict(),
  z.object({ type: z.literal("LineString"), coordinates: z.array(position).min(2).max(500) }).strict(),
  z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(position).min(4).max(501)).length(1) }).strict(),
])
export type Geometry = z.infer<typeof shape>
export type Position = [number, number]
export const geometrySchema = shape.superRefine((value, ctx) => {
  if (value.type === "Point") return
  if (value.type === "LineString") {
    if (new Set(value.coordinates.map(p => p.join(","))).size < 2) ctx.addIssue({ code: "custom", message: "El camino necesita dos puntos distintos" })
    return
  }
  const ring = value.coordinates[0], vertices = ring.slice(0, -1)
  const same = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1]
  if (!same(ring[0], ring[ring.length - 1])) {
    ctx.addIssue({ code: "custom", message: "Cerrá el contorno del sector" }); return
  }
  if (new Set(vertices.map(p => p.join(","))).size !== vertices.length ||
      Math.max(...vertices.map(p => p[0])) - Math.min(...vertices.map(p => p[0])) > 180 ||
      kinks(value).features.length || area(value) < 1) {
    ctx.addIssue({ code: "custom", message: "El contorno debe tener superficie y no cruzarse ni repetir vértices" })
  }
})
export const areaHa = (g: Geometry | null | undefined) => g?.type === "Polygon" ? area(g) / 10000 : null
export function polygonFrom(vertices: Position[]): Geometry | null {
  return vertices.length >= 3 ? { type: "Polygon", coordinates: [[...vertices, vertices[0]]] } : null
}
export const SECTOR_TYPES = [
  ["potrero", "Potrero", "#25845a"], ["cultivo", "Parcela agrícola", "#c18a17"],
  ["galpon", "Galpón / depósito", "#7957b6"], ["aguada", "Aguada / tanque", "#1683bd"],
  ["corral", "Corral", "#bb6d23"], ["manga", "Manga", "#4665a8"],
  ["feedlot", "Feedlot", "#b25d2d"], ["embarcadero", "Embarcadero", "#856345"],
  ["enfermeria", "Enfermería", "#bc4b60"], ["casa", "Casa / puesto", "#6455a0"],
  ["camino", "Camino", "#d97706"], ["tranquera", "Tranquera", "#e11d48"], ["limite", "Límite del campo", "#475569"],
  ["otro", "Otro sector", "#64748b"],
] as const
export const sectorLabel = (type: string) => SECTOR_TYPES.find(t => t[0] === type)?.[1] ?? type
export const sectorColor = (type: string) => SECTOR_TYPES.find(t => t[0] === type)?.[2] ?? "#64748b"
export const QUICK_PLACES = [
  { nombre: "Sarmiento · Chubut", lat: -45.586868, lon: -69.068941 },
  { nombre: "General Conesa · Río Negro", lat: -40.106186, lon: -64.453014 },
]
const nullableNumber = z.preprocess(v => v === "" || v === null ? null : v, z.coerce.number().finite().nonnegative().nullable())
export const sectorSchema = z.object({
  nombre: z.string().trim().min(1, "Ingresá un nombre").max(120),
  tipo: z.enum(SECTOR_TYPES.map(t => t[0]) as [string, ...string[]]),
  superficieHa: nullableNumber.optional(), capacidad: nullableNumber.refine(v => v === null || Number.isInteger(v), "La capacidad debe ser entera").optional(),
  uso: z.string().trim().max(80).nullable().optional(),
  descripcion: z.string().trim().max(3000).nullable().optional(),
  tieneAgua: z.boolean().optional(), tieneSombra: z.boolean().optional(), tieneBalanza: z.boolean().optional(),
  geometria: geometrySchema.nullable().optional(),
})
export const sectorPatchSchema = sectorSchema.partial().extend({ version: z.number().int().positive() })
