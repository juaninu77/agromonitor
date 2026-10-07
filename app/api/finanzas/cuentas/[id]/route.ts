import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { actualizarCuenta, eliminarCuenta, finanzasHandler, ROLES_FINANZAS } from "@/lib/finanzas/service"
import { cuentaUpdateSchema } from "@/lib/finanzas/validation"

// PATCH /api/finanzas/cuentas/[id] — editar o desactivar (activa: false)
export const PATCH = withAuth(
  (request, ctx) =>
    finanzasHandler(async () => {
      const id = z.string().uuid("Cuenta inválida").parse(ctx.params.id)
      const input = cuentaUpdateSchema.parse(await request.json())
      const data = await actualizarCuenta(ctx, id, input)
      return NextResponse.json({ success: true, data })
    }),
  { roles: [...ROLES_FINANZAS] },
)

// DELETE /api/finanzas/cuentas/[id] — solo cuentas sin movimientos
export const DELETE = withAuth(
  (_request, ctx) =>
    finanzasHandler(async () => {
      const id = z.string().uuid("Cuenta inválida").parse(ctx.params.id)
      await eliminarCuenta(ctx, id)
      return NextResponse.json({ success: true })
    }),
  { roles: [...ROLES_FINANZAS] },
)
