import { createHash, timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sincronizarTareasReproductivas } from "@/lib/reproduccion/agenda"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** El cron de Vercel manda `Authorization: Bearer <CRON_SECRET>`. Sin el secreto configurado no corre. */
function autorizado(request: NextRequest) {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return false
  // Se comparan los hash (mismo largo) en tiempo constante
  const hash = (t: string) => new Uint8Array(createHash("sha256").update(t).digest())
  return timingSafeEqual(hash(request.headers.get("authorization") ?? ""), hash(`Bearer ${secreto}`))
}

// GET /api/cron/agenda-reproductiva — diario (vercel.json): pone al día las tareas de la agenda
// reproductiva de todos los campos, aunque nadie registre eventos ni abra la agenda o el Panel
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 })
  if (!autorizado(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const campos = await prisma.establecimiento.findMany({ select: { id: true } })
  let creadas = 0, cumplidas = 0
  for (const c of campos) {
    const r = await sincronizarTareasReproductivas(c.id)
    creadas += r.creadas
    cumplidas += r.cumplidas
  }
  return NextResponse.json({ campos: campos.length, creadas, cumplidas })
}
