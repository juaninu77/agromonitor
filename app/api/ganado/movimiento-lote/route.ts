import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { erroresZod } from "@/lib/ganado/alta"
import { EventoGanadoError, moverDeLote, ROLES_MOVIMIENTO } from "@/lib/ganado/eventos"
import { movimientoLoteSchema } from "@/lib/validations/eventos-schema"

// ============================================
// POST /api/ganado/movimiento-lote
// ============================================
// Mueve animales entre lotes del mismo establecimiento. Sólo admin o
// encargado de la organización dueña del lote; animales activos; la fecha
// no puede ser futura ni anterior a movimientos ya registrados.

export const POST = withAuth(
  async (request, ctx) => {
    try {
      const parsed = movimientoLoteSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) {
        const errores = erroresZod(parsed.error)
        return NextResponse.json(
          { success: false, error: errores[0], errores, details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }

      const data = await moverDeLote(ctx, parsed.data)
      return NextResponse.json({ success: true, data })
    } catch (error) {
      if (error instanceof EventoGanadoError) return NextResponse.json({ success: false, error: error.message }, { status: error.status })
      console.error("Error al mover animales:", error)
      return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
    }
  },
  { roles: [...ROLES_MOVIMIENTO] }
)
