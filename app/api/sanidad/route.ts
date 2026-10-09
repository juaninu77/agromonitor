import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { errorSanidad, listarSanidad, registrarSanidad } from "@/lib/sanidad/service"

// GET /api/sanidad?establecimientoId=&q=&motivo=&productoId=&loteId=&animalId=&desde=&hasta=&page=&limit=
export const GET = withAuth(async (request, ctx) => {
  try {
    const data = await listarSanidad(ctx, Object.fromEntries(request.nextUrl.searchParams))
    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error al obtener eventos sanitarios:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})

// POST /api/sanidad — admin, encargado o vet del campo; descuenta stock si se indica
export const POST = withAuth(async (request, ctx) => {
  try {
    const data = await registrarSanidad(ctx, await request.json())
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error al crear evento sanitario:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
