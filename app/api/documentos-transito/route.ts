import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// ============================================
// GET /api/documentos-transito
// ============================================
// Retorna los DTAs filtrados por campo

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const campoId = searchParams.get("campoId")
    const estado = searchParams.get("estado")

    if (!campoId) {
      return NextResponse.json(
        { error: "Se requiere el parámetro campoId" },
        { status: 400 }
      )
    }

    // Construir filtros
    const where: Record<string, unknown> = { campoId }
    if (estado) {
      where.estado = estado
    }

    const documentos = await prisma.documentoTransito.findMany({
      where,
      orderBy: {
        fechaEmision: "desc",
      },
    })

    return NextResponse.json(documentos)
  } catch (error) {
    console.error("Error al obtener DTAs:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

// ============================================
// POST /api/documentos-transito
// ============================================
// Crea un nuevo DTA

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      campoId,
      numeroDta,
      tipo,
      fechaEmision,
      fechaVencimiento,
      renspaOrigen,
      nombreOrigen,
      renspaDestino,
      nombreDestino,
      especieAnimal,
      cantidadAnimales,
      categorias,
      motivo,
      patenteCamion,
      patenteAcoplado,
      transportista,
      certificadoSanitario,
      observaciones,
    } = body

    // Validaciones básicas
    if (!campoId || !numeroDta || !renspaOrigen || !renspaDestino) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      )
    }

    // Verificar si el número de DTA ya existe
    const existente = await prisma.documentoTransito.findUnique({
      where: { numeroDta },
    })

    if (existente) {
      return NextResponse.json(
        { error: "Ya existe un DTA con ese número" },
        { status: 409 }
      )
    }

    // Crear el documento
    const documento = await prisma.documentoTransito.create({
      data: {
        numeroDta,
        tipo: tipo || "DTe",
        fechaEmision: new Date(fechaEmision),
        fechaVencimiento: new Date(fechaVencimiento),
        renspaOrigen,
        nombreOrigen,
        renspaDestino,
        nombreDestino,
        especieAnimal: especieAnimal || "bovino",
        cantidadAnimales: cantidadAnimales || 1,
        categorias,
        motivo: motivo || "venta",
        estado: "vigente",
        patenteCamion,
        patenteAcoplado,
        transportista,
        certificadoSanitario,
        observaciones,
        campoId,
      },
    })

    return NextResponse.json(documento, { status: 201 })
  } catch (error) {
    console.error("Error al crear DTA:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

