import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// ============================================
// GET /api/ganado/bovinos/[id]
// ============================================
// Obtiene un animal específico por ID

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const { id } = await params
    const fullHistory = request.nextUrl.searchParams.get("fullHistory") === "true"

    const animal = await prisma.animal.findUnique({
      where: { id },
      include: {
        especie: true,
        raza: true,
        categoria: true,
        proveedor: { select: { id: true, nombre: true } },
        genealogia: true,
        eventosPesada: {
          orderBy: { fecha: 'desc' },
          ...(fullHistory ? {} : { take: 5 }),
        },
        eventosSanidad: {
          orderBy: { fecha: 'desc' },
          include: { producto: { select: { id: true, nombre: true, principioActivo: true } } },
          ...(fullHistory ? {} : { take: 5 }),
        },
        serviciosHembra: {
          orderBy: { fecha: 'desc' },
          ...(fullHistory ? {} : { take: 5 }),
        },
        tactos: {
          orderBy: { fecha: 'desc' },
          ...(fullHistory ? {} : { take: 5 }),
        },
        partosMadre: {
          orderBy: { fecha: 'desc' },
          ...(fullHistory ? {} : { take: 5 }),
        },
        eventosMovimiento: {
          orderBy: { fecha: 'desc' },
          ...(fullHistory ? {} : { take: 5 }),
        },
        ubicacionHist: {
          orderBy: { desde: 'desc' },
          include: { sector: true },
          ...(fullHistory ? {} : { take: 3 }),
        },
        loteHist: {
          orderBy: { desde: 'desc' },
          include: { lote: true },
          ...(fullHistory ? {} : { take: 3 }),
        },
        bajas: {
          take: 1,
        },
      }
    })

    if (!animal) {
      return NextResponse.json(
        { error: "Animal no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: animal,
    })
  } catch (error) {
    console.error("Error al obtener animal:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

// ============================================
// PATCH /api/ganado/bovinos/[id]
// ============================================
// Actualiza un animal existente

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()

    const animalExistente = await prisma.animal.findUnique({
      where: { id }
    })

    if (!animalExistente) {
      return NextResponse.json(
        { error: "Animal no encontrado" },
        { status: 404 }
      )
    }

    // Preparar datos para actualizar
    const updateData: any = {}

    // Campos de identificación
    if (body.caravanaVisual !== undefined) updateData.caravanaVisual = body.caravanaVisual
    if (body.caravanaRfid !== undefined) updateData.caravanaRfid = body.caravanaRfid
    if (body.cuig !== undefined) updateData.cuig = body.cuig
    if (body.otroId !== undefined) updateData.otroId = body.otroId

    // Relaciones
    if (body.razaId !== undefined) updateData.razaId = body.razaId
    if (body.categoriaId !== undefined) updateData.categoriaId = body.categoriaId

    // Información básica
    if (body.sexo !== undefined) updateData.sexo = body.sexo
    if (body.fechaNacimiento !== undefined) {
      updateData.fechaNacimiento = body.fechaNacimiento ? new Date(body.fechaNacimiento) : null
    }
    if (body.origen !== undefined) updateData.origen = body.origen

    // Características físicas
    if (body.colorManto !== undefined) updateData.colorManto = body.colorManto
    if (body.estadoCastracion !== undefined) updateData.estadoCastracion = body.estadoCastracion
    if (body.denticion !== undefined) updateData.denticion = body.denticion

    // Cabaña
    if (body.esCabana !== undefined) updateData.esCabana = body.esCabana
    if (body.registroCabana !== undefined) updateData.registroCabana = body.registroCabana

    // Notas
    if (body.notas !== undefined) updateData.notas = body.notas

    // Actualizar animal
    const animalActualizado = await prisma.animal.update({
      where: { id },
      data: updateData,
      include: {
        especie: true,
        raza: true,
        categoria: true,
      },
    })

    // Si se proporciona nuevo peso, crear evento de pesada
    if (body.pesoNuevo) {
      await prisma.evtPesada.create({
        data: {
          animalId: id,
          fecha: new Date(),
          pesoKg: body.pesoNuevo,
          cc: body.ccNuevo,
        }
      })
    }

    // Si se cambia el lote, actualizar historial
    if (body.loteId && body.loteId !== animalExistente.id) {
      // Cerrar lote actual
      await prisma.animalLoteHist.updateMany({
        where: {
          animalId: id,
          hasta: null
        },
        data: {
          hasta: new Date()
        }
      })

      await prisma.animalLoteHist.create({
        data: {
          animalId: id,
          loteId: body.loteId,
          desde: new Date(),
        }
      })
    }

    // Si se cambia el sector, actualizar historial
    if (body.sectorId) {
      await prisma.ubicacionHist.updateMany({
        where: {
          animalId: id,
          hasta: null
        },
        data: {
          hasta: new Date()
        }
      })

      await prisma.ubicacionHist.create({
        data: {
          animalId: id,
          sectorId: body.sectorId,
          desde: new Date(),
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: animalActualizado,
    })
  } catch (error) {
    console.error("Error al actualizar animal:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE /api/ganado/bovinos/[id]
// ============================================
// Elimina un animal (soft delete recomendado)

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const { id } = await params

    const animal = await prisma.animal.findUnique({
      where: { id }
    })

    if (!animal) {
      return NextResponse.json(
        { error: "Animal no encontrado" },
        { status: 404 }
      )
    }

    await prisma.animal.update({
      where: { id },
      data: { estadoVital: "baja" }
    })

    return NextResponse.json({
      success: true,
      message: "Animal eliminado exitosamente",
    })
  } catch (error) {
    console.error("Error al eliminar animal:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
