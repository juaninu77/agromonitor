import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// ============================================
// GET /api/ganado/ovinos
// ============================================
// Retorna ovinos filtrados por campo (con autenticación)

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
    const organizacionId = searchParams.get("organizacionId")
    const colorMarca = searchParams.get("color")
    const categoria = searchParams.get("categoria")
    const estado = searchParams.get("estado")

    // Verificar que el usuario tiene acceso
    if (organizacionId) {
      const membresia = await prisma.membresia.findUnique({
        where: {
          usuarioId_organizacionId: {
            usuarioId: session.user.id,
            organizacionId,
          },
          esActivo: true,
        },
      })

      if (!membresia) {
        return NextResponse.json(
          { error: "No tienes acceso a esta organización" },
          { status: 403 }
        )
      }
    }

    // Construir filtros
    const where: Record<string, unknown> = {}

    if (campoId) {
      where.campoId = campoId
    }

    if (colorMarca) {
      where.colorMarca = colorMarca
    }

    if (categoria) {
      where.categoria = categoria
    }

    if (estado) {
      where.estado = estado
    }

    const ovinos = await prisma.ovino.findMany({
      where,
      include: {
        campo: true,
      },
      orderBy: {
        idv: "asc",
      },
    })

    // Estadísticas
    const stats = {
      total: ovinos.length,
      porCategoria: {
        ovejas: ovinos.filter(o => o.categoria === "oveja").length,
        borregas: ovinos.filter(o => o.categoria === "borrega").length,
        corderas: ovinos.filter(o => o.categoria === "cordera").length,
        capones: ovinos.filter(o => o.categoria === "capon").length,
        carneros: ovinos.filter(o => o.categoria === "carnero").length,
        corderos: ovinos.filter(o => o.categoria === "cordero").length,
      },
      porColor: {
        rojo: ovinos.filter(o => o.colorMarca === "rojo").length,
        celeste: ovinos.filter(o => o.colorMarca === "celeste").length,
        negro: ovinos.filter(o => o.colorMarca === "negro").length,
        amarillo: ovinos.filter(o => o.colorMarca === "amarillo").length,
        verde: ovinos.filter(o => o.colorMarca === "verde").length,
        blanco: ovinos.filter(o => o.colorMarca === "blanco").length,
      },
      pesoPromedio: ovinos.filter(o => o.peso).length > 0
        ? ovinos.reduce((acc, o) => acc + (o.peso || 0), 0) / ovinos.filter(o => o.peso).length
        : 0,
    }

    return NextResponse.json({
      success: true,
      data: ovinos,
      stats,
    })
  } catch (error) {
    console.error("Error al obtener ovinos:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

// ============================================
// POST /api/ganado/ovinos
// ============================================
// Crea un nuevo ovino (con autenticación)

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
    const { campoId, organizacionId, ...ovinoData } = body

    if (!campoId) {
      return NextResponse.json(
        { error: "Se requiere el campoId" },
        { status: 400 }
      )
    }

    // Verificar acceso
    if (organizacionId) {
      const membresia = await prisma.membresia.findUnique({
        where: {
          usuarioId_organizacionId: {
            usuarioId: session.user.id,
            organizacionId,
          },
          esActivo: true,
        },
      })

      if (!membresia) {
        return NextResponse.json(
          { error: "No tienes acceso a esta organización" },
          { status: 403 }
        )
      }
    }

    // Crear ovino
    const ovino = await prisma.ovino.create({
      data: {
        idv: ovinoData.idv,
        colorMarca: ovinoData.colorMarca,
        categoria: ovinoData.categoria,
        anioNacimiento: ovinoData.anioNacimiento,
        raza: ovinoData.raza,
        peso: ovinoData.peso,
        estado: ovinoData.estado || "activo",
        campoId,
        rodeo: ovinoData.rodeo,
        observaciones: ovinoData.observaciones,
        historial: [],
        historialCategoria: ovinoData.historialCategoria || [],
        condicionCorporal: ovinoData.condicionCorporal,
        valorMercado: ovinoData.valorMercado,
      },
      include: {
        campo: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: ovino,
    }, { status: 201 })
  } catch (error) {
    console.error("Error al crear ovino:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
