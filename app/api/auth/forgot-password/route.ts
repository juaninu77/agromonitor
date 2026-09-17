import { NextResponse } from "next/server"

// No mail transport is configured yet. Never claim that a message was sent,
// return reset tokens to the browser, or write credentials to server logs.
export async function POST() {
  return NextResponse.json(
    { error: "La recuperación por email todavía no está habilitada. Contactá al administrador para recuperar el acceso." },
    { status: 503 }
  )
}
