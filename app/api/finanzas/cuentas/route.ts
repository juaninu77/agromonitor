import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { crearCuenta, finanzasHandler, listarCuentas, ROLES_FINANZAS } from "@/lib/finanzas/service"
import { cuentaSchema } from "@/lib/finanzas/validation"

// GET /api/finanzas/cuentas?establecimientoId=&activas=1 — cuentas con su saldo
export const GET = withAuth(
  (request, ctx) =>
    finanzasHandler(async () => {
      const params = request.nextUrl.searchParams
      const data = await listarCuentas(ctx, params.get("establecimientoId") || undefined, params.get("activas") !== "1")
      return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } })
    }),
  { roles: [...ROLES_FINANZAS] },
)

// POST /api/finanzas/cuentas — admin o encargado del campo
export const POST = withAuth(
  (request, ctx) =>
    finanzasHandler(async () => {
      const input = cuentaSchema.parse(await request.json())
      const data = await crearCuenta(ctx, input)
      return NextResponse.json({ success: true, data }, { status: 201 })
    }),
  { roles: [...ROLES_FINANZAS] },
)
