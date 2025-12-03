import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// ============================================
// GET /api/ganado/bovinos
// ============================================
// Retorna animales bovinos con autenticación

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
    const establecimientoId = searchParams.get("establecimientoId")
    const loteId = searchParams.get("loteId")
    const categoriaId = searchParams.get("categoriaId")
    const busqueda = searchParams.get("busqueda")

    // Buscar la especie bovina
    const especieBovina = await prisma.especie.findFirst({
      where: { nombre: 'bovino' }
    })

    if (!especieBovina) {
      return NextResponse.json({
        success: true,
        data: [],
        stats: { total: 0 }
      })
    }

    // Construir filtros
    const where: Record<string, unknown> = {
      especieId: especieBovina.id
    }
    
    if (categoriaId) {
      where.categoriaId = categoriaId
    }
    
    if (busqueda) {
      where.OR = [
        { caravanaVisual: { contains: busqueda, mode: 'insensitive' } },
        { cuig: { contains: busqueda, mode: 'insensitive' } },
        { otroId: { contains: busqueda, mode: 'insensitive' } },
      ]
    }

    // Si hay filtro de lote, buscar animales en ese lote
    let animalIdsEnLote: string[] | undefined
    if (loteId) {
      const animalesEnLote = await prisma.animalLoteHist.findMany({
        where: {
          loteId,
          hasta: null // Lote activo
        },
        select: { animalId: true }
      })
      animalIdsEnLote = animalesEnLote.map(a => a.animalId)
      where.id = { in: animalIdsEnLote }
    }

    // Obtener animales con relaciones
    const animales = await prisma.animal.findMany({
      where: where as any,
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
        genealogia: true,
      },
      orderBy: { caravanaVisual: 'asc' }
    })

    // Transformar para la UI
    const animalesConDetalles = animales.map(animal => {
      const ultimoPeso = animal.eventosPesada[0]
      const ubicacionActual = animal.ubicacionHist[0]
      const loteActual = animal.loteHist[0]
      
      // Calcular edad
      let edad = ''
      if (animal.fechaNacimiento) {
        const nacimiento = new Date(animal.fechaNacimiento)
        const hoy = new Date()
        const meses = (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + 
                      (hoy.getMonth() - nacimiento.getMonth())
        if (meses >= 12) {
          const años = Math.floor(meses / 12)
          const mesesRestantes = meses % 12
          edad = `${años} año${años > 1 ? 's' : ''}${mesesRestantes > 0 ? ` ${mesesRestantes} mes${mesesRestantes > 1 ? 'es' : ''}` : ''}`
        } else {
          edad = `${meses} mes${meses > 1 ? 'es' : ''}`
        }
      }

      return {
        id: animal.id,
        cuig: animal.cuig,
        caravanaVisual: animal.caravanaVisual,
        caravanaRfid: animal.caravanaRfid,
        nombre: animal.otroId || animal.caravanaVisual || animal.cuig || 'Sin ID',
        sexo: animal.sexo,
        fechaNacimiento: animal.fechaNacimiento?.toISOString(),
        edad,
        origen: animal.origen,
        colorManto: animal.colorManto,
        estadoCastracion: animal.estadoCastracion,
        denticion: animal.denticion,
        esCabana: animal.esCabana,
        registroCabana: animal.registroCabana,
        notas: animal.notas,
        // Relaciones
        especie: animal.especie,
        raza: animal.raza,
        categoria: animal.categoria,
        // Datos calculados
        pesoActual: ultimoPeso?.pesoKg,
        ccActual: ultimoPeso?.cc,
        ubicacion: ubicacionActual?.sector?.nombre,
        lote: loteActual?.lote?.nombre,
        // Para compatibilidad con UI existente
        weight: ultimoPeso?.pesoKg || 0,
        bodyConditionScore: ultimoPeso?.cc || 0,
        healthStatus: 'Saludable',
        dailyGain: ultimoPeso?.gdpKg || 0,
        breed: animal.raza?.nombre || '',
        category: animal.categoria?.nombre || '',
        tagNumber: animal.caravanaVisual || '',
        location: ubicacionActual?.sector?.nombre || '',
        marketValue: ultimoPeso?.pesoKg ? Math.round(ultimoPeso.pesoKg * 3.5) : 0,
        alerts: [] as string[],
      }
    })

    // Estadísticas
    const categorias = await prisma.categoria.findMany({
      where: { especieId: especieBovina.id }
    })

    const stats = {
      total: animales.length,
      porCategoria: {} as Record<string, number>,
      pesoPromedio: 0,
    }

    // Contar por categoría
    for (const cat of categorias) {
      stats.porCategoria[cat.nombre] = animales.filter(a => a.categoriaId === cat.id).length
    }

    // Calcular peso promedio
    const pesosValidos = animalesConDetalles.filter(a => a.pesoActual && a.pesoActual > 0)
    if (pesosValidos.length > 0) {
      stats.pesoPromedio = Math.round(
        pesosValidos.reduce((acc, a) => acc + (a.pesoActual || 0), 0) / pesosValidos.length
      )
    }

    return NextResponse.json({
      success: true,
      data: animalesConDetalles,
      stats,
    })
  } catch (error) {
    console.error("Error al obtener bovinos:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

// ============================================
// POST /api/ganado/bovinos
// ============================================
// Crea un nuevo animal bovino

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

    // Buscar especie bovina
    const especieBovina = await prisma.especie.findFirst({
      where: { nombre: 'bovino' }
    })

    if (!especieBovina) {
      return NextResponse.json(
        { error: "Especie bovina no encontrada" },
        { status: 400 }
      )
    }

    // Validar raza
    if (!body.razaId) {
      return NextResponse.json(
        { error: "Se requiere la raza" },
        { status: 400 }
      )
    }

    // Validar categoría
    if (!body.categoriaId) {
      return NextResponse.json(
        { error: "Se requiere la categoría" },
        { status: 400 }
      )
    }

    // Crear animal
    const animal = await prisma.animal.create({
      data: {
        especieId: especieBovina.id,
        razaId: body.razaId,
        categoriaId: body.categoriaId,
        sexo: body.sexo || 'M',
        cuig: body.cuig,
        caravanaVisual: body.caravanaVisual,
        caravanaRfid: body.caravanaRfid,
        otroId: body.otroId,
        fechaNacimiento: body.fechaNacimiento ? new Date(body.fechaNacimiento) : null,
        origen: body.origen || 'cria_propia',
        colorManto: body.colorManto,
        estadoCastracion: body.estadoCastracion,
        denticion: body.denticion,
        esCabana: body.esCabana || false,
        registroCabana: body.registroCabana,
        notas: body.notas,
      },
      include: {
        especie: true,
        raza: true,
        categoria: true,
      },
    })

    // Si se proporciona peso inicial, crear evento de pesada
    if (body.pesoInicial) {
      await prisma.evtPesada.create({
        data: {
          animalId: animal.id,
          fecha: new Date(),
          pesoKg: body.pesoInicial,
          cc: body.ccInicial,
        }
      })
    }

    // Si se proporciona lote, asignar al lote
    if (body.loteId) {
      await prisma.animalLoteHist.create({
        data: {
          animalId: animal.id,
          loteId: body.loteId,
          desde: new Date(),
        }
      })
    }

    // Si se proporciona sector/ubicación, asignar ubicación
    if (body.sectorId) {
      await prisma.ubicacionHist.create({
        data: {
          animalId: animal.id,
          sectorId: body.sectorId,
          desde: new Date(),
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: animal,
    }, { status: 201 })
  } catch (error) {
    console.error("Error al crear bovino:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
