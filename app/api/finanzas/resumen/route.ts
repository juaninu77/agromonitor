import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { resumenFinanzas } from "@/lib/finanzas/resumen"
import { finanzasHandler, ROLES_FINANZAS } from "@/lib/finanzas/service"
import { filtroResumenSchema } from "@/lib/finanzas/validation"

// GET /api/finanzas/resumen?establecimientoId=&desde=AAAA-MM-DD&hasta=AAAA-MM-DD
export const GET = withAuth(
  (request, ctx) =>
    finanzasHandler(async () => {
      const params = Object.fromEntries([...request.nextUrl.searchParams].filter(([, v]) => v !== ""))
      const filtro = filtroResumenSchema.parse(params)
      if (filtro.desde > filtro.hasta)
        return NextResponse.json({ error: "«Desde» no puede ser posterior a «hasta»" }, { status: 400 })
      const data = await resumenFinanzas(ctx, filtro)
      return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } })
    }),
  { roles: [...ROLES_FINANZAS] },
)
