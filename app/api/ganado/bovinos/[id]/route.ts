import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { animalDelTenant, loteDelTenant, sectorDelTenant } from "@/lib/api/tenant"
import { logAudit } from "@/lib/api/audit-log"
import { decimalToNumber } from "@/lib/api/serialize"
import { prisma } from "@/lib/prisma"
import { validarRazaYCategoriaParaEspecie } from "@/lib/ganado/validate-especie"
import { erroresZod, mapearErrorPrisma } from "@/lib/ganado/alta"
import { BajaError, registrarBaja } from "@/lib/ganado/baja"
import { animalActualizacionSchema } from "@/lib/validations/animal-schema"
import { bajaSchema } from "@/lib/validations/eventos-schema"
import { Prisma } from "@prisma/client"

// ============================================
// GET /api/ganado/bovinos/[id]
// ============================================
// Obtiene un animal específico por ID

export const GET = withAuth(async (request, ctx) => {
  try {
    const { id } = ctx.params
    const fullHistory = request.nextUrl.searchParams.get("fullHistory") === "true"

    const animal = await prisma.animal.findFirst({
      where: { id, establecimientoId: { in: ctx.establecimientoIds } },
      include: {
        especie: true,
        raza: true,
        categoria: true,
        proveedor: { select: { id: true, nombre: true } },
        genealogia: true,
        eventosPesada: {
          orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          ...(fullHistory ? {} : { take: 5 }),
        },
        eventosSanidad: {
          where: { anuladoAt: null },
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
        partosComoMadre: {
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
        eventoBaja: true,
      }
    })

    if (!animal) {
      return NextResponse.json(
        { error: "Animal no encontrado" },
        { status: 404 }
      )
    }

    // Coerción de campos Decimal (dinero) a number para el contrato de la API
    const data = {
      ...animal,
      eventosSanidad: animal.eventosSanidad.map((e) => ({
        ...e,
        costo: decimalToNumber(e.costo),
      })),
      eventoBaja: animal.eventoBaja
        ? {
            ...animal.eventoBaja,
            precioKg: decimalToNumber(animal.eventoBaja.precioKg),
            precioTotal: decimalToNumber(animal.eventoBaja.precioTotal),
          }
        : animal.eventoBaja,
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error("Error al obtener animal:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

// ============================================
// PATCH /api/ganado/bovinos/[id]
// ============================================
// Actualiza un animal existente

// Quién puede editar qué: la identificación y los datos del animal los cambian
// admin/encargado de la org dueña; mover de lote o sector lo puede hacer
// cualquier rol de esa org (es operación de campo).
const ROLES_EDICION = ["admin", "encargado"] as const
const CAMPOS_OPERATIVOS = new Set(["loteId", "sectorId", "pesoNuevo", "ccNuevo"])

export const PATCH = withAuth(async (request, ctx) => {
  try {
    const { id } = ctx.params
    const parsed = animalActualizacionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      const errores = erroresZod(parsed.error)
      return NextResponse.json({ error: errores[0], errores }, { status: 400 })
    }
    const body = parsed.data

    const animalExistente = await animalDelTenant(id, ctx.establecimientoIds)
    if (!animalExistente) {
      return NextResponse.json({ error: "Animal no encontrado" }, { status: 404 })
    }

    // Rol EN LA ORG DUEÑA del animal (nunca el rol global)
    const camposPedidos = Object.keys(parsed.data as object)
    const soloOperativo = camposPedidos.every((c) => CAMPOS_OPERATIVOS.has(c))
    const puedeEditar =
      ctx.esAdminPlataforma ||
      (animalExistente.establecimientoId
        ? ctx.establecimientoIdsConRol([...ROLES_EDICION]).includes(animalExistente.establecimientoId)
        : false)
    if (!soloOperativo && !puedeEditar) {
      return NextResponse.json(
        { error: "Sólo un administrador o encargado del campo puede editar los datos del animal" },
        { status: 403 }
      )
    }
    if (animalExistente.estadoVital !== "activo" && !puedeEditar) {
      return NextResponse.json({ error: "El animal está dado de baja" }, { status: 400 })
    }

    // Organización dueña del establecimiento del animal (para scopear el catálogo)
    const organizacionDelAnimal = animalExistente.establecimientoId
      ? ctx.organizacionDeEstablecimiento[animalExistente.establecimientoId]
      : undefined
    const organizacionIdsScope = organizacionDelAnimal ? [organizacionDelAnimal] : ctx.organizacionIds

    if (body.especieId !== undefined && body.especieId !== animalExistente.especieId) {
      return NextResponse.json(
        { error: "La especie de un animal registrado no puede cambiarse desde su ficha" },
        { status: 400 }
      )
    }

    const updateData: Prisma.AnimalUpdateInput = {}
    // Identificación: "" ya llega como undefined; sólo se pisa lo que vino en el body
    const bodyKeys = new Set(Object.keys(parsed.data as object))
    for (const campo of ["caravanaVisual", "caravanaRfid", "cuig", "otroId", "colorManto", "estadoCastracion", "denticion", "registroCabana", "notas"] as const) {
      if (bodyKeys.has(campo)) (updateData as Record<string, unknown>)[campo] = body[campo] ?? null
    }
    if (bodyKeys.has("sexo") && body.sexo) updateData.sexo = body.sexo
    if (bodyKeys.has("fechaNacimiento")) updateData.fechaNacimiento = body.fechaNacimiento ?? null
    if (bodyKeys.has("origen") && body.origen) updateData.origen = body.origen
    if (bodyKeys.has("esCabana")) updateData.esCabana = body.esCabana ?? false
    if (bodyKeys.has("razaId") && body.razaId) updateData.raza = { connect: { id: body.razaId } }
    if (bodyKeys.has("categoriaId") && body.categoriaId) updateData.categoria = { connect: { id: body.categoriaId } }
    if (bodyKeys.has("proveedorId")) updateData.proveedor = body.proveedorId ? { connect: { id: body.proveedorId } } : { disconnect: true }

    // El animal tiene que seguir teniendo al menos una identificación
    const identificacionFinal = {
      caravanaVisual: bodyKeys.has("caravanaVisual") ? body.caravanaVisual : animalExistente.caravanaVisual,
      caravanaRfid: bodyKeys.has("caravanaRfid") ? body.caravanaRfid : animalExistente.caravanaRfid,
      cuig: bodyKeys.has("cuig") ? body.cuig : animalExistente.cuig,
      otroId: bodyKeys.has("otroId") ? body.otroId : animalExistente.otroId,
    }
    if (!Object.values(identificacionFinal).some(Boolean)) {
      return NextResponse.json(
        { error: "El animal debe conservar al menos una identificación (caravana, RFID, CUIG u otro)" },
        { status: 400 }
      )
    }

    // Coherencia especie / raza / categoría / sexo
    const especieFinal = animalExistente.especieId
    const razaFinal = body.razaId ?? animalExistente.razaId
    const catFinal = body.categoriaId ?? animalExistente.categoriaId
    const sexoFinal = body.sexo ?? animalExistente.sexo
    if (razaFinal || catFinal) {
      const errCombo = await validarRazaYCategoriaParaEspecie(especieFinal, razaFinal, catFinal, organizacionIdsScope)
      if (errCombo) return NextResponse.json({ error: errCombo }, { status: 400 })
    }
    if (catFinal) {
      const categoria = await prisma.categoria.findUnique({ where: { id: catFinal }, select: { sexo: true, nombre: true } })
      if (categoria?.sexo && categoria.sexo !== sexoFinal) {
        return NextResponse.json(
          { error: `La categoría "${categoria.nombre}" no corresponde al sexo del animal` },
          { status: 400 }
        )
      }
    }

    // Lote destino (si se cambia): del mismo campo y especie, activo
    if (body.loteId) {
      const lote = await loteDelTenant(body.loteId, ctx.establecimientoIds)
      if (!lote) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 })
      if (lote.establecimientoId !== animalExistente.establecimientoId || lote.especieId !== especieFinal) {
        return NextResponse.json({ error: "El lote debe pertenecer al campo y especie del animal" }, { status: 400 })
      }
      if (!lote.activo) return NextResponse.json({ error: "El lote está inactivo" }, { status: 400 })
    }

    // Sector destino (si se cambia): del mismo campo
    if (body.sectorId) {
      const sector = await sectorDelTenant(body.sectorId, ctx.establecimientoIds)
      if (!sector || sector.establecimientoId !== animalExistente.establecimientoId) {
        return NextResponse.json({ error: "Sector no encontrado" }, { status: 404 })
      }
    }

    const ahora = new Date()
    const animalActualizado = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.animal.update({
        where: { id },
        data: updateData,
        include: { especie: true, raza: true, categoria: true },
      })

      if (body.pesoNuevo !== undefined) {
        await tx.evtPesada.create({
          data: { animalId: id, fecha: ahora, pesoKg: body.pesoNuevo, cc: body.ccNuevo ?? null },
        })
      }

      if (body.loteId) {
        const abierto = await tx.animalLoteHist.findFirst({ where: { animalId: id, hasta: null }, select: { loteId: true } })
        if (abierto?.loteId !== body.loteId) {
          await tx.animalLoteHist.updateMany({ where: { animalId: id, hasta: null }, data: { hasta: ahora } })
          await tx.animalLoteHist.create({ data: { animalId: id, loteId: body.loteId, desde: ahora } })
        }
      }

      if (body.sectorId) {
        const abierto = await tx.ubicacionHist.findFirst({ where: { animalId: id, hasta: null }, select: { sectorId: true } })
        if (abierto?.sectorId !== body.sectorId) {
          await tx.ubicacionHist.updateMany({ where: { animalId: id, hasta: null }, data: { hasta: ahora } })
          await tx.ubicacionHist.create({ data: { animalId: id, sectorId: body.sectorId, desde: ahora } })
        }
      }

      return actualizado
    })

    await logAudit({
      userId: ctx.userId,
      tabla: "animales",
      rowPk: id,
      accion: "UPDATE",
      organizacionId: organizacionDelAnimal,
      detalle: { campos: Array.from(bodyKeys) },
    })

    return NextResponse.json({ success: true, data: animalActualizado })
  } catch (error) {
    const conocido = mapearErrorPrisma(error)
    if (conocido) return NextResponse.json({ success: false, error: conocido.error }, { status: conocido.status })
    console.error("Error al actualizar animal:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})

// ============================================
// DELETE /api/ganado/bovinos/[id]
// ============================================
// Baja lógica: NO borra la fila. Crea un EvtBaja (motivo por defecto "otro",
// fecha de hoy; se pueden pasar `motivo`, `fecha` y `observ` en el body),
// deja el estadoVital según el motivo y cierra los historiales de lote y
// ubicación. Para ventas con cliente/precio usar POST /api/ventas/bajas.

export const DELETE = withAuth(
  async (request, ctx) => {
    try {
      const { id } = ctx.params
      const body = (await request.json().catch(() => null)) ?? {}
      const parsed = bajaSchema.safeParse({
        animalId: id,
        motivo: body.motivo ?? "otro",
        fecha: body.fecha ?? new Date(),
        observ: body.observ ?? body.notas,
        pesoVivoKg: body.pesoVivoKg,
      })
      if (!parsed.success) {
        const errores = erroresZod(parsed.error)
        return NextResponse.json({ success: false, error: errores[0], errores }, { status: 400 })
      }

      // Solo donde el usuario es admin/encargado de la org dueña del animal
      const { baja, animal } = await registrarBaja(parsed.data, {
        establecimientoIds: ctx.establecimientoIdsConRol(["admin", "encargado"]),
        userId: ctx.userId,
        organizacionIds: ctx.organizacionIds,
      })

      await logAudit({
        userId: ctx.userId,
        tabla: "animales",
        rowPk: id,
        accion: "UPDATE",
        detalle: {
          baja: true,
          motivo: parsed.data.motivo,
          estadoVital: animal.estadoVital,
          evtBajaId: baja.id,
          caravanaVisual: animal.caravanaVisual,
        },
        organizacionId: animal.establecimientoId
          ? ctx.organizacionDeEstablecimiento[animal.establecimientoId]
          : null,
      })

      return NextResponse.json({
        success: true,
        data: { animalId: id, estadoVital: animal.estadoVital, evtBajaId: baja.id },
        message: "Animal dado de baja",
      })
    } catch (error) {
      if (error instanceof BajaError) {
        return NextResponse.json({ success: false, error: error.message }, { status: error.status })
      }
      const conocido = mapearErrorPrisma(error)
      if (conocido) return NextResponse.json({ success: false, error: conocido.error }, { status: conocido.status })
      console.error("Error al dar de baja animal:", error)
      return NextResponse.json(
        { success: false, error: "Error interno del servidor" },
        { status: 500 }
      )
    }
  },
  { roles: ["admin", "encargado"] }
)
