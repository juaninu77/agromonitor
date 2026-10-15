import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { whatsappConfigurado } from "@/lib/whatsapp/config"
import { crearCodigoVinculo, desvincular, estadoVinculo } from "@/lib/whatsapp/vinculo"

// GET /api/whatsapp/vinculo — estado del número vinculado del usuario
export const GET = withAuth(async (_request, { userId }) =>
  NextResponse.json({ data: { configurado: whatsappConfigurado(), ...(await estadoVinculo(userId)) } }))

// POST /api/whatsapp/vinculo — genera un código de vinculación (vence a los 10 minutos)
export const POST = withAuth(async (_request, { userId }) => {
  if (!whatsappConfigurado()) return NextResponse.json({ error: "El asistente de WhatsApp no está habilitado" }, { status: 503 })
  const r = await crearCodigoVinculo(userId)
  return NextResponse.json({ data: { codigo: r.codigo, expira: r.expira.toISOString(), enlace: r.enlace } }, { status: 201 })
})

// DELETE /api/whatsapp/vinculo — desvincula el número
export const DELETE = withAuth(async (_request, { userId }) => {
  await desvincular(userId)
  return NextResponse.json({ data: { vinculado: false } })
})
