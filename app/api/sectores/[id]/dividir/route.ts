import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { mapBody, mapField, MapError, mapResult } from "@/lib/mapa/api"
import { areaHa, geometrySchema, polygonFrom, type Position } from "@/lib/mapa/geometry"
import { dividirPoligono, DivisionError } from "@/lib/mapa/drawing"

const position = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-85).max(85)])
const nombre = z.string().trim().min(1, "Ingresá un nombre").max(120)
const bodySchema = z.object({
  version: z.number().int().positive(),
  linea: z.array(position).min(2, "Dibujá la división con al menos dos puntos").max(500),
  nombreOriginal: nombre.optional(),
  nombreNuevo: nombre,
  guardarAlambrado: z.boolean().default(true),
}).strict()

const redondear = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100)

// POST /api/sectores/[id]/dividir — divide un potrero (o cualquier lugar con
// contorno) con una línea: la parte más grande conserva el lugar original
// (ganado, registros, historial) y la otra se crea como lugar nuevo del mismo
// tipo. Opcionalmente guarda el tramo de corte como alambrado. Todo en una
// transacción y con control de versión.
export const POST = withAuth(async (request, ctx) => mapResult(async () => {
  const id = z.string().uuid().parse(ctx.params.id)
  const body = bodySchema.parse(await mapBody(request))
  const actual = await prisma.sector.findFirst({ where: { id, establecimientoId: { in: ctx.establecimientoIds }, activo: true } })
  if (!actual) throw new MapError("Sector no encontrado", 404)
  mapField(ctx, actual.establecimientoId, true)
  const geo = geometrySchema.safeParse(actual.geometria)
  if (!geo.success || geo.data.type !== "Polygon") throw new MapError("Solo se pueden dividir lugares dibujados como área")

  let partes: [Position[], Position[]], corte: Position[]
  try {
    ({ partes, corte } = dividirPoligono(geo.data.coordinates[0].slice(0, -1) as Position[], body.linea as Position[]))
  } catch (error) {
    if (error instanceof DivisionError) throw new MapError(error.message)
    throw error
  }
  const [grande, chica] = partes
    .map((p) => ({ geometria: geometrySchema.safeParse(polygonFrom(p)) }))
    .map(({ geometria }) => {
      if (!geometria.success) throw new MapError("La división deja una parte con un contorno inválido. Probá con otra línea.")
      return { geometria: geometria.data, ha: areaHa(geometria.data)! }
    })
    .sort((a, b) => b.ha - a.ha)
  const nombreOriginal = body.nombreOriginal ?? actual.nombre
  if (nombreOriginal.toLowerCase() === body.nombreNuevo.toLowerCase()) throw new MapError("Las dos partes necesitan nombres distintos")
  const tieneSuperficie = actual.superficieHa != null

  const resultado = await prisma.$transaction(async (tx) => {
    const original = await tx.sector.update({
      where: { id, version: body.version },
      data: {
        nombre: nombreOriginal,
        geometria: grande.geometria,
        // La superficie declarada deja de valer: pasa a la medida del mapa
        ...(tieneSuperficie ? { superficieHa: redondear(grande.ha) } : {}),
        ...(actual.capacidad != null ? { capacidad: Math.round(actual.capacidad * grande.ha / (grande.ha + chica.ha)) } : {}),
        version: { increment: 1 },
      },
    })
    const nuevo = await tx.sector.create({
      data: {
        establecimientoId: actual.establecimientoId,
        nombre: body.nombreNuevo,
        tipo: actual.tipo,
        uso: actual.uso,
        // Las instalaciones se copian; la capacidad se reparte según la superficie
        tieneAgua: actual.tieneAgua,
        tieneSombra: actual.tieneSombra,
        tieneBalanza: actual.tieneBalanza,
        capacidad: actual.capacidad != null ? Math.round(actual.capacidad * chica.ha / (grande.ha + chica.ha)) : null,
        geometria: chica.geometria,
        superficieHa: tieneSuperficie ? redondear(chica.ha) : null,
        descripcion: `División de ${actual.nombre}`,
      },
    })
    const alambrado = body.guardarAlambrado
      ? await tx.sector.create({
          data: {
            establecimientoId: actual.establecimientoId,
            nombre: `Alambrado ${nombreOriginal} / ${body.nombreNuevo}`.slice(0, 120),
            tipo: "alambrado",
            geometria: { type: "LineString", coordinates: corte },
            descripcion: `Divide ${nombreOriginal} y ${body.nombreNuevo}`,
          },
        })
      : null
    const organizacionId = ctx.organizacionDeEstablecimiento[actual.establecimientoId]
    await tx.auditLog.createMany({
      data: [
        { usuarioId: ctx.userId, organizacionId, tabla: "sectores", rowPk: id, accion: "UPDATE", detalle: { division: true, versionAnterior: actual.version, geometriaAnterior: actual.geometria as object, nuevoSector: nuevo.id } },
        { usuarioId: ctx.userId, organizacionId, tabla: "sectores", rowPk: nuevo.id, accion: "INSERT", detalle: { divisionDe: id } },
        ...(alambrado ? [{ usuarioId: ctx.userId, organizacionId, tabla: "sectores", rowPk: alambrado.id, accion: "INSERT", detalle: { divisionDe: id } }] : []),
      ],
    })
    return { original, nuevo, alambrado }
  })

  return NextResponse.json({
    success: true,
    data: {
      original: { id: resultado.original.id, nombre: resultado.original.nombre, ha: redondear(grande.ha) },
      nuevo: { id: resultado.nuevo.id, nombre: resultado.nuevo.nombre, ha: redondear(chica.ha) },
      alambrado: resultado.alambrado ? { id: resultado.alambrado.id, nombre: resultado.alambrado.nombre } : null,
    },
  }, { status: 201 })
}))
