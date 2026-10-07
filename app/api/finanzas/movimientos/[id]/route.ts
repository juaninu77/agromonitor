import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { actualizarMovimiento, eliminarMovimiento, finanzasHandler, ROLES_FINANZAS } from "@/lib/finanzas/service"
import { movimientoUpdateSchema } from "@/lib/finanzas/validation"

// PATCH /api/finanzas/movimientos/[id] — reemplaza los campos editables
export const PATCH = withAuth(
  (request, ctx) =>
    finanzasHandler(async () => {
      const id = z.string().uuid("Movimiento inválido").parse(ctx.params.id)
      const input = movimientoUpdateSchema.parse(await request.json())
      const data = await actualizarMovimiento(ctx, id, input)
      return NextResponse.json({ success: true, data })
    }),
  { roles: [...ROLES_FINANZAS] },
)

// DELETE /api/finanzas/movimientos/[id] — en transferencias borra las dos patas
export const DELETE = withAuth(
  (_request, ctx) =>
    finanzasHandler(async () => {
      const id = z.string().uuid("Movimiento inválido").parse(ctx.params.id)
      const data = await eliminarMovimiento(ctx, id)
      return NextResponse.json({ success: true, data })
    }),
  { roles: [...ROLES_FINANZAS] },
)
