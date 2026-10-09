import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { mapBody, mapResult, MapError } from "@/lib/mapa/api"
import { InventarioError, registrarMovimientoStock } from "@/lib/inventario/service"

// Entrada o salida de productos en un galpón desde la ficha del mapa: el mismo servicio que
// Inventario (permisos, saldo del galpón, lotes FEFO, idempotencia por clave y auditoría).
const schema = z.object({ clave: z.string().uuid(), productoId: z.string().uuid(), tipo: z.enum(["entrada", "salida"]), cantidad: z.number().finite().positive().max(10000000), motivo: z.string().trim().min(1).max(1000) })
export const POST = withAuth(async (request, ctx) => mapResult(async () => {
  const id = z.string().uuid().parse(ctx.params.id), v = schema.parse(await mapBody(request))
  try {
    const { movimiento } = await registrarMovimientoStock(ctx, { ...v, sectorId: id })
    return NextResponse.json({ data: movimiento }, { status: 201 })
  } catch (e) {
    if (e instanceof InventarioError) throw new MapError(e.message, e.status)
    throw e
  }
}))
