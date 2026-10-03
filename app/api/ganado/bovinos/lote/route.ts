import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { logAudit } from "@/lib/api/audit-log"
import { resolverEstablecimientoDestino } from "@/lib/api/tenant"
import { ejecutarAltas, erroresZod, mapearErrorPrisma, prepararAltas } from "@/lib/ganado/alta"
import { altaMasivaSchema } from "@/lib/validations/animal-schema"

// ============================================================
// POST /api/ganado/bovinos/lote — alta masiva / importación
// ============================================================
// Recibe hasta 1000 filas (ids o nombres de catálogo), las valida todas y las
// inserta en UNA transacción: o entran todas o no entra ninguna. Con
// `dryRun: true` sólo valida y devuelve la vista previa.
//
// Respuestas:
//   200 { success, dryRun, resumen, filas }           → todo válido (y creado si no era dryRun)
//   422 { success:false, error, resumen, filas }      → hay filas con error; no se escribió nada
//   400/403/409/500 { error }

export const POST = withAuth(
  async (request, ctx) => {
    try {
      const parsed = altaMasivaSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) {
        return NextResponse.json({ error: erroresZod(parsed.error).join("; ") }, { status: 400 })
      }
      const { establecimientoId: solicitado, dryRun, filas } = parsed.data

      // El rol se resuelve en la organización dueña del establecimiento destino.
      const permitidos = ctx.establecimientoIdsConRol(["admin", "encargado"])
      const establecimientoId = resolverEstablecimientoDestino(solicitado, permitidos)
      if (!establecimientoId) {
        return NextResponse.json(
          { error: solicitado ? "No tenés permiso para cargar animales en este establecimiento" : "Indicá el establecimiento destino" },
          { status: solicitado ? 403 : 400 },
        )
      }
      const organizacionId = ctx.organizacionDeEstablecimiento[establecimientoId]
      const organizacionIds = organizacionId ? [organizacionId] : ctx.organizacionIds

      const { resultados, preparadas } = await prepararAltas(filas, { establecimientoId, organizacionIds })
      const conError = resultados.filter((r) => !r.ok).length
      const resumen = { total: resultados.length, validas: resultados.length - conError, conError }

      if (conError > 0) {
        return NextResponse.json(
          {
            success: false,
            dryRun,
            error: `${conError} de ${resultados.length} filas tienen errores; no se registró ningún animal`,
            resumen,
            filas: resultados,
          },
          { status: 422 },
        )
      }

      if (!dryRun) {
        await ejecutarAltas(preparadas)
        await logAudit({
          userId: ctx.userId,
          tabla: "animales",
          rowPk: establecimientoId,
          accion: "INSERT",
          organizacionId,
          detalle: {
            tipo: "alta_masiva",
            cantidad: preparadas.length,
            identificaciones: preparadas.slice(0, 50).map((p) => p.identificacion),
          },
        })
      }

      return NextResponse.json({ success: true, dryRun, resumen, filas: resultados })
    } catch (error) {
      const conocido = mapearErrorPrisma(error)
      if (conocido) return NextResponse.json({ error: conocido.error }, { status: conocido.status })
      console.error("Error en alta masiva de animales:", error)
      return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
    }
  },
  { roles: ["admin", "encargado"] },
)
