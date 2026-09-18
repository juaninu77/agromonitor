import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { mapResult, MapError } from "@/lib/mapa/api"

export const GET = withAuth(async request => mapResult(async () => {
  const nombre = z.string().trim().min(3, "Escribí al menos 3 letras").max(100).parse(request.nextUrl.searchParams.get("q"))
  const query = new URLSearchParams({ nombre, max: "8", campos: "id,nombre,centroide,provincia,departamento" })
  const response = await fetch(`https://apis.datos.gob.ar/georef/api/localidades?${query}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(12000) }).catch(() => null)
  if (!response?.ok) throw new MapError("El buscador de localidades no está disponible. Podés mover el mapa o ingresar coordenadas.", 503)
  const result = await response.json()
  return NextResponse.json({ data: (result.localidades ?? []).map((p: { id: string; nombre: string; centroide: { lat: number; lon: number }; provincia: { nombre: string }; departamento: { nombre: string } }) => ({ id: p.id, nombre: `${p.nombre} · ${p.provincia.nombre} · ${p.departamento.nombre}`, ...p.centroide })) })
}))
