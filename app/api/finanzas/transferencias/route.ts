import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { finanzasHandler, registrarTransferencia, ROLES_FINANZAS } from "@/lib/finanzas/service"
import { transferenciaSchema } from "@/lib/finanzas/validation"

// POST /api/finanzas/transferencias — mueve dinero entre dos cuentas del mismo campo
export const POST = withAuth(
  (request, ctx) =>
    finanzasHandler(async () => {
      const input = transferenciaSchema.parse(await request.json())
      const data = await registrarTransferencia(ctx, input)
      return NextResponse.json({ success: true, data }, { status: 201 })
    }),
  { roles: [...ROLES_FINANZAS] },
)
