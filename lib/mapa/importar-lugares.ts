// Alta en lote de los lugares importados de un KML/KMZ/GeoJSON (ya revisados en el mapa).
// Todo o nada, idempotente por la `clave` del dispositivo; solo admin/encargado del campo.
// Un nombre que ya existe en el campo (o se repite en el archivo) se numera: «Potrero 3 (2)».

import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { mapField, MapError } from "./api"
import { geometrySchema, SECTOR_TYPES, sectorLabel } from "./geometry"
import { conClave } from "./idempotencia"
import { MAX_LUGARES, nombresLibres, tipoCompatible } from "./import"

export const importacionSchema = z.object({
  establecimientoId: z.string().uuid(),
  clave: z.string().uuid(),
  lugares: z.array(z.object({
    nombre: z.string().trim().min(1, "Cada lugar necesita un nombre").max(120),
    tipo: z.enum(SECTOR_TYPES.map((t) => t[0]) as [string, ...string[]]),
    descripcion: z.string().trim().max(3000).nullable().optional(),
    geometria: geometrySchema,
  })).min(1, "Elegí al menos un lugar").max(MAX_LUGARES, `Importá hasta ${MAX_LUGARES} lugares por vez`),
}).superRefine((v, ctx) => {
  v.lugares.forEach((l, i) => {
    if (!tipoCompatible(l.tipo, l.geometria.type)) ctx.addIssue({ code: "custom", path: ["lugares", i, "tipo"], message: `«${l.nombre}»: «${sectorLabel(l.tipo)}» no puede ser ${l.geometria.type === "Point" ? "un punto" : l.geometria.type === "LineString" ? "una línea" : "un área"}` })
  })
})

export interface ResultadoImportacionLugares {
  creados: { id: string; nombre: string; tipo: string }[]
  /** Lugares que se guardaron con otro nombre porque ya existía */
  renombrados: { original: string; nombre: string }[]
}

export async function importarLugares(ctx: AuthContext, raw: unknown): Promise<ResultadoImportacionLugares> {
  const v = importacionSchema.parse(raw)
  const establecimientoId = mapField(ctx, v.establecimientoId, true)
  return prisma.$transaction(async (tx) => conClave(tx, { clave: v.clave, usuarioId: ctx.userId, ruta: "sectores/importar" }, async () => {
    // Todos los nombres del campo, también los archivados (el nombre es único por campo)
    const existentes = (await tx.sector.findMany({ where: { establecimientoId }, select: { nombre: true } })).map((s) => s.nombre)
    const nombres = nombresLibres(v.lugares.map((l) => l.nombre), existentes)
    const filas = v.lugares.map((l, i) => ({
      id: crypto.randomUUID(),
      establecimientoId,
      nombre: nombres[i],
      tipo: l.tipo,
      descripcion: l.descripcion ?? null,
      geometria: l.geometria as Prisma.InputJsonValue,
    }))
    const { count } = await tx.sector.createMany({ data: filas })
    if (count !== filas.length) throw new MapError("No se pudieron crear todos los lugares. Reintentá.", 409)
    await tx.auditLog.create({
      data: {
        usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[establecimientoId], tabla: "sectores", rowPk: v.clave, accion: "INSERT",
        detalle: { importacion: true, lugares: filas.length, ids: filas.map((f) => f.id) },
      },
    })
    return {
      creados: filas.map((f) => ({ id: f.id, nombre: f.nombre, tipo: f.tipo })),
      renombrados: v.lugares.flatMap((l, i) => (nombres[i] !== l.nombre ? [{ original: l.nombre, nombre: nombres[i] }] : [])),
    }
  }), { timeout: 30_000 })
}
