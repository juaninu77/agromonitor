import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { mapBody, mapResult } from "@/lib/mapa/api"
import { moveAnimals } from "@/lib/mapa/move"
export const POST = withAuth(async (request, ctx) => mapResult(async () => NextResponse.json({ success: true, data: await moveAnimals(await mapBody(request), ctx) }, { status: 201 })))
