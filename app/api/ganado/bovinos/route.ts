import { ganadoPaginacionSchema } from "@/lib/ganado/query"
import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { scopeEstablecimiento, resolverEstablecimientoDestino } from "@/lib/api/tenant"
import { logAudit } from "@/lib/api/audit-log"
import { prisma } from "@/lib/prisma"
import { ejecutarAltas, mapearErrorPrisma, prepararAltas } from "@/lib/ganado/alta"

// ============================================
// GET /api/ganado/bovinos
// ============================================
// Retorna animales bovinos con autenticación

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const establecimientoId = searchParams.get("establecimientoId")
    const loteId = searchParams.get("loteId")
    const categoriaId = searchParams.get("categoriaId")
    const busqueda = searchParams.get("busqueda")

    // Filtros avanzados
    const razasFilter = searchParams.get("razas")
    const categoriasFilter = searchParams.get("categorias")
    const pesoMin = searchParams.get("pesoMin")
    const pesoMax = searchParams.get("pesoMax")
    const ccMin = searchParams.get("ccMin")
    const ccMax = searchParams.get("ccMax")

    const parsed = ganadoPaginacionSchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return NextResponse.json({ error: "Filtros o paginación inválidos" }, { status: 400 })
    const { page, limit, orderDirection, especie, estadoVital } = parsed.data
    const skip = (page - 1) * limit
    const orderByField = searchParams.get("orderBy") || "caravana"

    // Construir el objeto orderBy para Prisma
    const getOrderByClause = () => {
      const fieldMapping: Record<string, any> = {
        caravana: { caravanaVisual: orderDirection },
        nombre: { otroId: orderDirection },
        categoria: { categoria: { nombre: orderDirection } },
        raza: { raza: { nombre: orderDirection } },
        edad: { fechaNacimiento: orderDirection === 'asc' ? 'desc' : 'asc' }, // Invertir para edad
        default: { caravanaVisual: orderDirection }
      }
      return fieldMapping[orderByField] || fieldMapping.default
    }

    const orderByClause = getOrderByClause()

    const especieIdFilter = searchParams.get("especieId")

    // Scoping multi-tenant: si el cliente pide un establecimiento, debe ser accesible
    if (establecimientoId && !ctx.establecimientoIds.includes(establecimientoId)) {
      return NextResponse.json(
        { error: "No tienes acceso a este establecimiento" },
        { status: 403 }
      )
    }
    const establecimientosPermitidos = establecimientoId
      ? [establecimientoId]
      : ctx.establecimientoIds

    // Sin especieId: lista todos los animales (bovinos, ovinos, equinos, etc.)
    const where: Record<string, unknown> = {
      ...scopeEstablecimiento(establecimientosPermitidos),
    }
    if (especieIdFilter) {
      where.especieId = especieIdFilter
    }

    if (especie && especie !== "todos") where.especie = { nombre: { equals: especie, mode: "insensitive" } }
    if (estadoVital && estadoVital !== "todos") where.estadoVital = estadoVital

    if (categoriaId) {
      where.categoriaId = categoriaId
    }

    // Filtros avanzados - razas
    if (razasFilter) {
      const razasArray = razasFilter.split(',')
      where.razaId = { in: razasArray }
    }

    // Filtros avanzados - categorías
    if (categoriasFilter) {
      const categoriasArray = categoriasFilter.split(',')
      where.categoriaId = { in: categoriasArray }
    }

    if (busqueda) {
      where.OR = [
        { caravanaVisual: { contains: busqueda, mode: 'insensitive' } },
        { cuig: { contains: busqueda, mode: 'insensitive' } },
        { caravanaRfid: { contains: busqueda, mode: 'insensitive' } },
        { otroId: { contains: busqueda, mode: 'insensitive' } },
      ]
    }

    // Si hay filtro de lote, buscar animales en ese lote (solo lotes del tenant)
    let animalIdsEnLote: string[] | undefined
    if (loteId) {
      const animalesEnLote = await prisma.animalLoteHist.findMany({
        where: {
          loteId,
          hasta: null,
          lote: { establecimientoId: { in: ctx.establecimientoIds } },
        },
        select: { animalId: true },
      })
      animalIdsEnLote = animalesEnLote.map(a => a.animalId)
      where.id = { in: animalIdsEnLote }
    }

    // Filtros por peso y condicion corporal (via ultima pesada)
    if (pesoMin || pesoMax || ccMin || ccMax) {
      const pesadaFilter: Record<string, unknown> = {}
      if (pesoMin) pesadaFilter.gte = parseFloat(pesoMin)
      if (pesoMax) pesadaFilter.lte = parseFloat(pesoMax)

      const animalesConPeso = await prisma.evtPesada.findMany({
        where: {
          animalId: { not: null },
          animal: { establecimientoId: { in: ctx.establecimientoIds } },
          ...(pesoMin || pesoMax ? { pesoKg: pesadaFilter } : {}),
          ...(ccMin || ccMax ? {
            cc: {
              ...(ccMin ? { gte: parseFloat(ccMin) } : {}),
              ...(ccMax ? { lte: parseFloat(ccMax) } : {}),
            },
          } : {}),
        },
        distinct: ["animalId"],
        orderBy: { fecha: "desc" },
        select: { animalId: true },
      })

      const idsConPeso = animalesConPeso
        .map(p => p.animalId)
        .filter((id): id is string => id !== null)

      if (where.id) {
        const existingIds = (where.id as { in: string[] }).in
        where.id = { in: existingIds.filter((id: string) => idsConPeso.includes(id)) }
      } else {
        where.id = { in: idsConPeso }
      }
    }

    // Obtener total de animales (para paginación)
    const totalAnimales = await prisma.animal.count({
      where: where as any
    })

    // Obtener animales con relaciones y paginación
    const animales = await prisma.animal.findMany({
      where: where as any,
      include: {
        especie: true,
        raza: true,
        categoria: true,
        eventosPesada: {
          orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
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
      orderBy: [orderByClause, { id: "asc" }],
      skip,
      take: limit
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
        estadoVital: animal.estadoVital,
        establecimientoId: animal.establecimientoId,
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
        healthStatus: 'Sin evaluación sanitaria',
        dailyGain: ultimoPeso?.gdpKg || 0,
        breed: animal.raza?.nombre || '',
        category: animal.categoria?.nombre || '',
        tagNumber: animal.caravanaVisual || '',
        location: ubicacionActual?.sector?.nombre || '',
        marketValue: null,
        alerts: [] as string[],
      }
    })

    // Estadísticas (misma consulta `where` que la lista; puede incluir varias especies)
    const todosAnimales = await prisma.animal.findMany({
      where: where as any,
      include: {
        categoria: true,
        eventosPesada: {
          orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          take: 1
        }
      }
    })

    const stats = {
      total: totalAnimales,
      porCategoria: {} as Record<string, number>,
      pesoPromedio: 0,
      conPeso: 0,
      activos: todosAnimales.filter(a => a.estadoVital === "activo").length,
      pesoPorCategoria: [] as { category: string; avgWeight: number; count: number }[],
    }

    for (const a of todosAnimales) {
      const nombreCat = a.categoria?.nombre
      if (nombreCat) {
        stats.porCategoria[nombreCat] = (stats.porCategoria[nombreCat] || 0) + 1
      }
    }

    // Calcular peso promedio
    const pesosValidos = todosAnimales
      .map(a => a.eventosPesada[0]?.pesoKg)
      .filter((p): p is number => p !== null && p !== undefined && p > 0)

    stats.conPeso = pesosValidos.length
    const pesosCategoria = new Map<string, number[]>()
    for (const animal of todosAnimales) {
      const peso = animal.eventosPesada[0]?.pesoKg
      if (peso && peso > 0) {
        const nombre = animal.categoria?.nombre || "Sin categoría"
        pesosCategoria.set(nombre, [...(pesosCategoria.get(nombre) || []), peso])
      }
    }
    stats.pesoPorCategoria = Array.from(pesosCategoria, ([category, pesos]) => ({ category, count: pesos.length, avgWeight: Math.round(pesos.reduce((a, b) => a + b, 0) / pesos.length) }))

    if (pesosValidos.length > 0) {
      stats.pesoPromedio = Math.round(
        pesosValidos.reduce((acc, p) => acc + p, 0) / pesosValidos.length
      )
    }

    // Información de paginación
    const totalPages = Math.ceil(totalAnimales / limit)

    return NextResponse.json({
      success: true,
      data: animalesConDetalles,
      stats,
      pagination: {
        page,
        limit,
        total: totalAnimales,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      }
    })
  } catch (error) {
    console.error("Error al obtener bovinos:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

// ============================================
// POST /api/ganado/bovinos
// ============================================
// Crea un nuevo animal bovino

export const POST = withAuth(async (request, ctx) => {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Cuerpo de la petición inválido" }, { status: 400 })
    }

    // Resolver establecimiento destino (scoping multi-tenant)
    const establecimientoDestino = resolverEstablecimientoDestino(
      body.establecimientoId,
      ctx.establecimientoIds
    )
    if (!establecimientoDestino) {
      return NextResponse.json(
        body.establecimientoId
          ? { error: "No tienes acceso a este establecimiento" }
          : { error: "Se requiere establecimientoId para crear el animal" },
        { status: body.establecimientoId ? 403 : 400 }
      )
    }

    // Organización dueña del establecimiento destino (para scopear el catálogo)
    const organizacionDestino = ctx.organizacionDeEstablecimiento[establecimientoDestino]
    const organizacionIds = organizacionDestino ? [organizacionDestino] : ctx.organizacionIds

    // Misma validación que el alta masiva: esquema zod, catálogo del tenant
    // (incluidos los globales), coherencia especie/raza/categoría/sexo,
    // lote y sector del establecimiento, duplicados de identificación.
    const { resultados, preparadas } = await prepararAltas([{ ...body, fila: 1 }], {
      establecimientoId: establecimientoDestino,
      organizacionIds,
    })
    const resultado = resultados[0]
    if (!resultado.ok) {
      const esDuplicado = resultado.errores.some((e) => /ya existe|ya está registrad/i.test(e))
      return NextResponse.json(
        { success: false, error: resultado.errores[0], errores: resultado.errores },
        { status: esDuplicado ? 409 : 400 }
      )
    }

    await ejecutarAltas(preparadas)
    const animal = await prisma.animal.findUnique({
      where: { id: resultado.animalId },
      include: { especie: true, raza: true, categoria: true },
    })

    await logAudit({
      userId: ctx.userId,
      tabla: "animales",
      rowPk: resultado.animalId!,
      accion: "INSERT",
      organizacionId: organizacionDestino,
      detalle: { identificacion: resultado.identificacion, establecimientoId: establecimientoDestino },
    })

    return NextResponse.json({ success: true, data: animal }, { status: 201 })
  } catch (error) {
    const conocido = mapearErrorPrisma(error)
    if (conocido) return NextResponse.json({ success: false, error: conocido.error }, { status: conocido.status })
    console.error("Error al crear animal:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
