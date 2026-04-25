import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// ============================================
// GET /api/ganado/bovinos/[id]
// ============================================
// Obtiene un animal específico por ID

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const animal = await prisma.animal.findUnique({
      where: { id: params.id },
      include: {
        especie: true,
        raza: true,
        categoria: true,
        eventosPesada: {
          orderBy: { fecha: 'desc' },
          take: 1
        },
        ubicacionHist: {
          where: { hasta: null },
          include: { sector: true },
          take: 1
        },
        loteHist: {
          where: { hasta: null },
          include: { lote: true },
          take: 1
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
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Verificar que el animal existe
    const animalExistente = await prisma.animal.findUnique({
      where: { id: params.id }
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
      where: { id: params.id },
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
          animalId: params.id,
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
          animalId: params.id,
          hasta: null
        },
        data: {
          hasta: new Date()
        }
      })

      // Crear nuevo lote
      await prisma.animalLoteHist.create({
        data: {
          animalId: params.id,
          loteId: body.loteId,
          desde: new Date(),
        }
      })
    }

    // Si se cambia el sector, actualizar historial
    if (body.sectorId) {
      // Cerrar ubicación actual
      await prisma.ubicacionHist.updateMany({
        where: {
          animalId: params.id,
          hasta: null
        },
        data: {
          hasta: new Date()
        }
      })

      // Crear nueva ubicación
      await prisma.ubicacionHist.create({
        data: {
          animalId: params.id,
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
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    // Verificar que el animal existe
    const animal = await prisma.animal.findUnique({
      where: { id: params.id }
    })

    if (!animal) {
      return NextResponse.json(
        { error: "Animal no encontrado" },
        { status: 404 }
      )
    }

    // Eliminar el animal (hard delete - considerar soft delete en producción)
    await prisma.animal.delete({
      where: { id: params.id }
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
