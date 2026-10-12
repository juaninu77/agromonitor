// Reproducción por grupo: servicio de una torada, planilla de tacto y destete de un grupo en una
// sola operación (todo o nada, idempotente por la clave del cliente), y señalada de corderos
// por lote (spec 03 §3.4). Las reglas por animal son las mismas que en la carga individual.

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { diasEntre, formatoDia, hoyArgentina } from "@/lib/inventario/fechas"
import { estadosReproductivos } from "./estado"
import { sincronizarTareasReproductivas } from "./agenda"
import { descontarAplicacion } from "@/lib/inventario/aplicaciones"
import {
  ReproduccionError, SEL_ANIMAL, auditar, avisoCaravana, diaDe, etiqueta, exigirRol, fechaDia, finDia, grupoDeDestete, inicioDia, moverAGrupo, vigente,
} from "./service"
import {
  calcularParto, desteteMasivoSchema, filtrosReproduccionSchema, senaladaSchema, servicioMasivoSchema, soloServicioNatural, tactoMasivoSchema, tipoGrupoDeEspecie,
} from "./validation"

const enGrupoEl = (loteId: string, fecha: string): Prisma.AnimalLoteHistWhereInput => ({
  loteId, desde: { lte: finDia(fecha) }, OR: [{ hasta: null }, { hasta: { gte: inicioDia(fecha) } }],
})
const lista = (nombres: string[], max = 5) => nombres.slice(0, max).join(", ") + (nombres.length > max ? ` y ${nombres.length - max} más` : "")

async function toradaDelUsuario(ctx: AuthContext, toradaId: string) {
  const torada = await prisma.torada.findFirst({
    where: { id: toradaId, lote: { establecimientoId: { in: ctx.establecimientoIds } } },
    select: {
      id: true, nombre: true, tipo: true, tipoGrupo: true, fechaInicio: true, fechaFin: true, loteId: true, cantidadHembras: true,
      lote: { select: { id: true, nombre: true, establecimientoId: true, especieId: true, especie: { select: { nombre: true } } } },
    },
  })
  if (!torada) throw new ReproduccionError("Torada no encontrada", 404)
  return torada
}

/**
 * Hembras de una torada para cargar servicio o tacto: las activas que estaban en su grupo ese
 * día y las que tienen servicios en la torada, con su estado reproductivo y el servicio sin tacto.
 */
export async function hembrasDeTorada(ctx: AuthContext, toradaId: string, fechaPedida?: string) {
  const torada = await toradaDelUsuario(ctx, toradaId)
  const inicio = diaDe(torada.fechaInicio), hoy = hoyArgentina()
  const fecha = fechaPedida ?? (torada.fechaFin && diaDe(torada.fechaFin) < hoy ? diaDe(torada.fechaFin) : hoy < inicio ? inicio : hoy)
  const hembras = await prisma.animal.findMany({
    where: {
      estadoVital: "activo", sexo: "F", especieId: torada.lote.especieId, establecimientoId: torada.lote.establecimientoId,
      OR: [{ loteHist: { some: enGrupoEl(torada.loteId, fecha) } }, { serviciosHembra: { some: { toradaId, ...vigente } } }],
    },
    select: { id: true, caravanaVisual: true, cuig: true, caravanaRfid: true, categoria: { select: { nombre: true } } },
    orderBy: [{ caravanaVisual: "asc" }, { id: "asc" }],
    take: 3000,
  })
  const ids = hembras.map((h) => h.id)
  const [estados, sinTacto, delDia] = await Promise.all([
    estadosReproductivos(ids),
    prisma.evtServicio.findMany({ where: { hembraId: { in: ids }, ...vigente, tacto: { is: null }, fecha: { lte: fechaDia(fecha) } }, orderBy: { fecha: "desc" }, select: { id: true, hembraId: true, fecha: true, tipo: true, toradaId: true } }),
    prisma.evtServicio.findMany({ where: { hembraId: { in: ids }, ...vigente, fecha: fechaDia(fecha) }, select: { hembraId: true } }),
  ])
  const servida = new Set(delDia.map((s) => s.hembraId))
  return {
    torada: { id: torada.id, nombre: torada.nombre, tipo: torada.tipo, tipoGrupo: torada.tipoGrupo, fechaInicio: inicio, fechaFin: torada.fechaFin ? diaDe(torada.fechaFin) : null, lote: torada.lote },
    fecha,
    hembras: hembras.map((h) => {
      // El servicio de esta torada si lo hay; si no, el último sin tacto
      const propios = sinTacto.filter((s) => s.hembraId === h.id)
      const s = propios.find((x) => x.toradaId === toradaId) ?? propios[0] ?? null
      return { ...h, estado: estados.get(h.id) ?? null, servicioSinTacto: s && { id: s.id, fecha: diaDe(s.fecha), tipo: s.tipo }, servidaEseDia: servida.has(h.id) }
    }),
  }
}

/** Servicio de las hembras de una torada en una operación (C1). Omite preñadas y repetidos. */
export async function servicioMasivo(ctx: AuthContext, raw: unknown) {
  const v = servicioMasivoSchema.parse(raw)
  const previos = await prisma.evtServicio.count({ where: { operacionId: v.clave } })
  if (previos) return { operacionId: v.clave, cantidad: previos, omitidas: { prenadas: 0, yaServidas: 0 }, repetido: true }
  const torada = await toradaDelUsuario(ctx, v.toradaId)
  const est = torada.lote.establecimientoId
  exigirRol(ctx, est, "servicio")
  const inicio = diaDe(torada.fechaInicio), fin = torada.fechaFin ? diaDe(torada.fechaFin) : null
  if (v.fecha < inicio || (fin && v.fecha > fin)) throw new ReproduccionError(`La fecha cae fuera de la torada «${torada.nombre}» (${formatoDia(inicio)}${fin ? ` al ${formatoDia(fin)}` : " en adelante"})`, 400)
  if (v.tipo !== "natural" && soloServicioNatural(torada.lote.especie.nombre)) throw new ReproduccionError("En ovinos el servicio es solo natural (encarnerada con carneros)", 400)
  if (v.machoId) {
    const m = await prisma.animal.findFirst({ where: { id: v.machoId, establecimientoId: { in: ctx.establecimientoIds } }, select: SEL_ANIMAL })
    if (!m || !m.establecimientoId || ctx.organizacionDeEstablecimiento[m.establecimientoId] !== ctx.organizacionDeEstablecimiento[est]) throw new ReproduccionError("El macho no se encontró", 404)
    if (m.sexo !== "M" || m.especieId !== torada.lote.especieId || m.estadoVital !== "activo") throw new ReproduccionError(`${etiqueta(m)} no puede servir: tiene que ser un macho activo de la especie del grupo`, 400)
  }
  const elegidas = v.hembraIds ? [...new Set(v.hembraIds)] : null
  const hembras = await prisma.animal.findMany({
    where: {
      estadoVital: "activo", sexo: "F", especieId: torada.lote.especieId, establecimientoId: est, loteHist: { some: enGrupoEl(torada.loteId, v.fecha) },
      ...(elegidas ? { id: { in: elegidas } } : {}),
    },
    select: { id: true, caravanaVisual: true, cuig: true, fechaNacimiento: true },
  })
  if (elegidas && hembras.length < elegidas.length) {
    throw new ReproduccionError(`${elegidas.length - hembras.length} de las hembras elegidas no estaban activas en el grupo de la torada ese día`, 400)
  }
  const nacidasDespues = hembras.filter((h) => h.fechaNacimiento && diaDe(h.fechaNacimiento) > v.fecha)
  if (nacidasDespues.length) throw new ReproduccionError(`La fecha es anterior al nacimiento de ${lista(nacidasDespues.map(etiqueta))}`, 400)
  const ids = hembras.map((h) => h.id)
  const [estados, repetidas] = await Promise.all([
    estadosReproductivos(ids, v.fecha),
    prisma.evtServicio.findMany({ where: { hembraId: { in: ids }, fecha: fechaDia(v.fecha), tipo: v.tipo, ...vigente }, select: { hembraId: true } }),
  ])
  const yaServidas = new Set(repetidas.map((r) => r.hembraId))
  const prenadas = new Set(ids.filter((id) => estados.get(id)?.estado === "preñada"))
  const aServir = hembras.filter((h) => !yaServidas.has(h.id) && (v.incluirPrenadas || !prenadas.has(h.id)))
  if (!aServir.length) {
    throw new ReproduccionError(hembras.length ? "No queda ninguna hembra para servir: todas figuran preñadas o ya tienen ese servicio ese día" : "No hay hembras activas en el grupo de la torada ese día", 400)
  }
  const resultado = await prisma.$transaction(async (tx) => {
    await tx.evtServicio.createMany({
      data: aServir.map((h) => ({
        fecha: fechaDia(v.fecha), tipo: v.tipo, hembraId: h.id, establecimientoId: est, machoId: v.machoId, toradaId: torada.id, operacionId: v.clave,
        toroNombre: v.toroNombre, loteSemen: v.loteSemen, inseminador: v.inseminador, observ: v.observ,
      })),
    })
    await auditar(tx, ctx, est, "evt_servicio", v.clave, { masivo: true, toradaId: torada.id, fecha: v.fecha, tipo: v.tipo, cantidad: aServir.length })
    return {
      operacionId: v.clave, cantidad: aServir.length, repetido: false,
      omitidas: { prenadas: v.incluirPrenadas ? 0 : [...prenadas].filter((id) => !yaServidas.has(id)).length, yaServidas: yaServidas.size },
    }
  })
  await sincronizarTareasReproductivas(est)
  return resultado
}

/** Planilla de tacto: un resultado por hembra en una operación (C2). Vincula cada uno a su servicio. */
export async function tactoMasivo(ctx: AuthContext, raw: unknown) {
  const v = tactoMasivoSchema.parse(raw)
  const previos = await prisma.evtTacto.count({ where: { operacionId: v.clave } })
  if (previos) return { operacionId: v.clave, cantidad: previos, prenadas: 0, vinculados: 0, repetido: true }
  const ids = v.filas.map((f) => f.hembraId)
  if (new Set(ids).size !== ids.length) throw new ReproduccionError("Hay una hembra repetida en la planilla", 400)
  const hembras = await prisma.animal.findMany({ where: { id: { in: ids }, establecimientoId: { in: ctx.establecimientoIds } }, select: SEL_ANIMAL })
  if (hembras.length !== ids.length) throw new ReproduccionError("Una hembra de la planilla no se encontró", 404)
  const campos = new Set(hembras.map((h) => h.establecimientoId))
  if (campos.size !== 1) throw new ReproduccionError("La planilla tiene hembras de otro campo", 400)
  const est = hembras[0].establecimientoId!
  exigirRol(ctx, est, "tacto")
  const errores = hembras.flatMap((h) =>
    h.sexo !== "F" ? [`${etiqueta(h)} es macho`] : h.estadoVital !== "activo" ? [`${etiqueta(h)} está dado de baja`]
    : h.fechaNacimiento && diaDe(h.fechaNacimiento) > v.fecha ? [`${etiqueta(h)} nació después de esa fecha`] : [])
  if (errores.length) throw new ReproduccionError(lista(errores), 400)
  const [delDia, servicios] = await Promise.all([
    prisma.evtTacto.findMany({ where: { hembraId: { in: ids }, fecha: fechaDia(v.fecha), ...vigente }, select: { hembraId: true } }),
    prisma.evtServicio.findMany({
      where: { hembraId: { in: ids }, ...vigente, tacto: { is: null }, fecha: { lte: fechaDia(v.fecha) }, ...(v.toradaId ? { toradaId: v.toradaId } : {}) },
      orderBy: { fecha: "desc" }, select: { id: true, hembraId: true, fecha: true },
    }),
  ])
  const porId = new Map(hembras.map((h) => [h.id, h]))
  if (delDia.length) throw new ReproduccionError(`Ya tienen tacto ese día: ${lista(delDia.map((t) => etiqueta(porId.get(t.hembraId)!)))}`, 409)
  const filas = v.filas.map((f) => {
    const h = porId.get(f.hembraId)!
    const s = servicios.find((x) => x.hembraId === f.hembraId) ?? null
    if (f.resultado === "preñada" && v.metodo === "ecografia" && f.mesesGest == null && !s) throw new ReproduccionError(`Por ecografía, indicá los meses de gestación de ${etiqueta(h)}`, 400)
    const parto = f.resultado === "preñada" ? calcularParto(h.especie.nombre, v.fecha, { servicioFecha: s ? diaDe(s.fecha) : null, mesesGest: f.mesesGest }) : null
    return {
      fecha: fechaDia(v.fecha), resultado: f.resultado, metodo: v.metodo, veterinario: v.veterinario, hembraId: f.hembraId, establecimientoId: est, servicioId: s?.id ?? null, operacionId: v.clave,
      mesesGest: parto?.mesesGest ?? null, fechaProbableParto: parto?.fecha ? fechaDia(parto.fecha) : null,
    }
  })
  const resultado = await prisma.$transaction(async (tx) => {
    await tx.evtTacto.createMany({ data: filas })
    await auditar(tx, ctx, est, "evt_tacto", v.clave, { masivo: true, fecha: v.fecha, cantidad: filas.length, toradaId: v.toradaId })
    return { operacionId: v.clave, cantidad: filas.length, prenadas: filas.filter((f) => f.resultado === "preñada").length, vinculados: filas.filter((f) => f.servicioId).length, repetido: false }
  })
  await sincronizarTareasReproductivas(est)
  return resultado
}

const diaMenos = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)

/** Terneros o corderos de un grupo para destetar: activos, en el grupo hoy y sin destete vigente. */
export async function criasDelGrupo(ctx: AuthContext, loteId: string) {
  const lote = await prisma.lote.findFirst({ where: { id: loteId, establecimientoId: { in: ctx.establecimientoIds } }, select: { id: true, nombre: true, especieId: true, establecimientoId: true } })
  if (!lote) throw new ReproduccionError("Grupo no encontrado", 404)
  const hoy = hoyArgentina()
  const animales = await prisma.animal.findMany({
    where: {
      estadoVital: "activo", establecimientoId: lote.establecimientoId, loteHist: { some: { loteId, hasta: null } }, destetes: { none: vigente },
      // Solo crías: nacidas en los últimos 18 meses o, sin fecha de nacimiento, de una categoría de hasta 12 meses
      OR: [
        { fechaNacimiento: { gte: fechaDia(diaMenos(hoy, 540)) } },
        { fechaNacimiento: null, categoria: { edadMaxMeses: { lte: 12 } } },
      ],
    },
    select: {
      id: true, caravanaVisual: true, cuig: true, caravanaRfid: true, sexo: true, fechaNacimiento: true, categoria: { select: { nombre: true } },
      genealogia: { select: { madre: { select: { caravanaVisual: true, cuig: true } } } },
    },
    orderBy: [{ fechaNacimiento: "asc" }, { caravanaVisual: "asc" }],
    take: 3000,
  })
  return {
    lote,
    animales: animales.map(({ genealogia, ...a }) => ({
      ...a, fechaNacimiento: a.fechaNacimiento ? diaDe(a.fechaNacimiento) : null,
      edadDias: a.fechaNacimiento ? diasEntre(diaDe(a.fechaNacimiento), hoy) : null, madre: genealogia?.madre ? etiqueta(genealogia.madre) : null,
    })),
  }
}

/** Destete de varios animales en una operación (C3): pesada, cambio de grupo y edad para cada uno. */
export async function desteteMasivo(ctx: AuthContext, raw: unknown) {
  const v = desteteMasivoSchema.parse(raw)
  const previos = await prisma.evtDestete.count({ where: { operacionId: v.clave } })
  if (previos) return { operacionId: v.clave, cantidad: previos, movidos: 0, sinCaravana: 0, repetido: true }
  const ids = v.filas.map((f) => f.animalId)
  if (new Set(ids).size !== ids.length) throw new ReproduccionError("Hay un animal repetido", 400)
  const animales = await prisma.animal.findMany({ where: { id: { in: ids }, establecimientoId: { in: ctx.establecimientoIds } }, select: SEL_ANIMAL })
  if (animales.length !== ids.length) throw new ReproduccionError("Un animal no se encontró", 404)
  if (new Set(animales.map((a) => a.establecimientoId)).size !== 1) throw new ReproduccionError("Hay animales de otro campo", 400)
  const est = animales[0].establecimientoId!
  exigirRol(ctx, est, "destete")
  const errores = animales.flatMap((a) =>
    a.estadoVital !== "activo" ? [`${etiqueta(a)} está dado de baja`] : a.fechaNacimiento && diaDe(a.fechaNacimiento) >= v.fecha ? [`${etiqueta(a)} nació después de esa fecha`] : [])
  if (errores.length) throw new ReproduccionError(lista(errores), 400)
  const yaDestetados = await prisma.evtDestete.findMany({ where: { animalId: { in: ids }, ...vigente }, select: { animalId: true } })
  const porId = new Map(animales.map((a) => [a.id, a]))
  if (yaDestetados.length) throw new ReproduccionError(`Ya tienen destete: ${lista(yaDestetados.map((d) => etiqueta(porId.get(d.animalId)!)))}`, 409)
  if (v.loteDesteteId) {
    if (new Set(animales.map((a) => a.especieId)).size !== 1) throw new ReproduccionError("Hay animales de distintas especies", 400)
    await grupoDeDestete(v.loteDesteteId, est, animales[0].especieId)
  }
  const resultado = await prisma.$transaction(async (tx) => {
    let movidos = 0
    for (const f of v.filas) {
      const a = porId.get(f.animalId)!
      const pesada = f.pesoKg ? await tx.evtPesada.create({ data: { animalId: a.id, fecha: fechaDia(v.fecha), pesoKg: f.pesoKg, observ: "Destete" } }) : null
      await tx.evtDestete.create({
        data: {
          fecha: fechaDia(v.fecha), animalId: a.id, establecimientoId: est, pesoKg: f.pesoKg, metodo: v.metodo, loteDesteteId: v.loteDesteteId, observ: v.observ, operacionId: v.clave,
          edadDias: a.fechaNacimiento ? diasEntre(diaDe(a.fechaNacimiento), v.fecha) : null, pesadaId: pesada?.id ?? null,
        },
      })
      if (v.loteDesteteId && await moverAGrupo(tx, a.id, v.loteDesteteId, v.fecha, "destete")) movidos++
    }
    await auditar(tx, ctx, est, "evt_destete", v.clave, { masivo: true, fecha: v.fecha, cantidad: v.filas.length, loteDesteteId: v.loteDesteteId })
    return { operacionId: v.clave, cantidad: v.filas.length, movidos, sinCaravana: animales.filter(avisoCaravana).length, repetido: false }
  }, { timeout: 60_000 })
  await sincronizarTareasReproductivas(est)
  return resultado
}

// ─── Señalada (ovinos) ──────────────────────────────────────────────────────

/** Señalada de corderos de un grupo (spec 03 §3.4): por lote, idempotente por la clave. */
export async function registrarSenalada(ctx: AuthContext, raw: unknown) {
  const v = senaladaSchema.parse(raw)
  if (v.clave) {
    const previa = await prisma.evtSenalada.findUnique({ where: { clave: v.clave } })
    if (previa) return { ...previa, repetido: true }
  }
  const lote = await prisma.lote.findFirst({
    where: { id: v.loteId, establecimientoId: { in: ctx.establecimientoIds } },
    select: { establecimientoId: true, activo: true, especie: { select: { nombre: true } } },
  })
  if (!lote) throw new ReproduccionError("Grupo no encontrado", 404)
  exigirRol(ctx, lote.establecimientoId, "senalada")
  if (!lote.activo) throw new ReproduccionError("El grupo está inactivo", 400)
  if (tipoGrupoDeEspecie(lote.especie.nombre) !== "encarnerada") throw new ReproduccionError("La señalada es de corderos: el grupo tiene que ser de ovinos", 400)
  if (v.toradaId && !(await prisma.torada.count({ where: { id: v.toradaId, lote: { establecimientoId: lote.establecimientoId } } }))) {
    throw new ReproduccionError("La encarnerada no es del campo del grupo", 400)
  }
  if (v.productoClostridialId) {
    const org = ctx.organizacionDeEstablecimiento[lote.establecimientoId]
    const producto = await prisma.producto.findFirst({ where: { id: v.productoClostridialId, activo: true, OR: [{ organizacionId: org }, { organizacionId: null }] }, select: { organizacionId: true } })
    if (!producto) throw new ReproduccionError("El producto no es de la organización", 400)
    // Un producto del catálogo global no tiene stock: nunca se descuenta
    if (v.descontarStock != null && !producto.organizacionId) throw new ReproduccionError("Es un producto del catálogo general, sin stock: no se puede descontar", 400)
  }
  const resultado = await prisma.$transaction(async (tx) => {
    const s = await tx.evtSenalada.create({
      data: {
        fecha: fechaDia(v.fecha), loteId: v.loteId, toradaId: v.toradaId, clave: v.clave ?? null, productoClostridialId: v.productoClostridialId, observ: v.observ,
        corderosSenalados: v.corderosSenalados, corderosMuertos: v.corderosMuertos, machosMantenidos: v.machosMantenidos, machosCastrados: v.machosCastrados, hembras: v.hembras,
      },
    })
    // La vacuna sale del stock en la misma transacción (como en Sanidad: si no alcanza, 409)
    const stock = v.productoClostridialId && v.descontarStock != null
      ? await descontarAplicacion(tx, {
        productoId: v.productoClostridialId, cantidad: v.descontarStock, loteProductoId: v.loteProductoId, fecha: new Date(`${v.fecha}T12:00:00-03:00`),
        motivo: `Señalada · ${v.corderosSenalados} corderos`, origenTipo: "senalada", origenId: s.id,
      }, { establecimientoIds: ctx.establecimientoIds, establecimientoId: lote.establecimientoId, estricto: true, aceptarVencido: v.aceptarVencido })
      : null
    await auditar(tx, ctx, lote.establecimientoId, "evt_senalada", s.id, { loteId: v.loteId, toradaId: v.toradaId, fecha: v.fecha, corderosSenalados: v.corderosSenalados, stock: stock ? { descontado: stock.descontado, unidad: stock.unidad } : undefined })
    return { ...s, repetido: false, stock: stock && { descontado: stock.descontado, unidad: stock.unidad, ubicacion: stock.ubicacion } }
  })
  await sincronizarTareasReproductivas(lote.establecimientoId)
  return resultado
}

/** Calificación del % señalada según la referencia patagónica (spec 03 §3.5). */
export const calificarSenalada = (porcentaje: number) => (porcentaje >= 75 ? "bueno" : porcentaje >= 60 ? "regular" : "malo")

/** Señaladas del campo con el % señalada sobre las ovejas encarneradas de su encarnerada. */
export async function listarSenaladas(ctx: AuthContext, raw: unknown) {
  const f = filtrosReproduccionSchema.parse(raw)
  if (!ctx.establecimientoIds.includes(f.establecimientoId)) throw new ReproduccionError("Campo no encontrado", 404)
  const where: Prisma.EvtSenaladaWhereInput = { lote: { establecimientoId: f.establecimientoId }, ...(f.verAnulados ? {} : vigente), ...(f.toradaId ? { toradaId: f.toradaId } : {}) }
  const [filas, total] = await Promise.all([
    prisma.evtSenalada.findMany({
      where, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], skip: (f.page - 1) * f.limit, take: f.limit,
      include: {
        lote: { select: { id: true, nombre: true } }, productoClostridial: { select: { id: true, nombre: true } },
        torada: { select: { id: true, nombre: true, cantidadHembras: true, fechaInicio: true, loteId: true } },
      },
    }),
    prisma.evtSenalada.count({ where }),
  ])
  // Ovejas encarneradas: las cargadas en la encarnerada; si no, las servidas en ella; si no, las
  // hembras de su grupo al inicio (o, si entraron después, las que están hoy)
  const toradas = [...new Map(filas.filter((s) => s.torada).map((s) => [s.torada!.id, s.torada!])).values()]
  const contarEncarneradas = async (t: (typeof toradas)[number]) => {
    if (t.cantidadHembras) return t.cantidadHembras
    const servidas = (await prisma.evtServicio.groupBy({ by: ["hembraId"], where: { toradaId: t.id, ...vigente } })).length
    if (servidas) return servidas
    return (await prisma.animal.count({ where: { sexo: "F", loteHist: { some: enGrupoEl(t.loteId, diaDe(t.fechaInicio)) } } }))
      || prisma.animal.count({ where: { sexo: "F", estadoVital: "activo", loteHist: { some: { loteId: t.loteId, hasta: null } } } })
  }
  const encarneradas = new Map(await Promise.all(toradas.map(async (t) => [t.id, await contarEncarneradas(t)] as const)))
  // % de la encarnerada: suma de sus señaladas vigentes (puede haber varias tandas)
  const senaladosPorTorada = toradas.length
    ? new Map((await prisma.evtSenalada.groupBy({ by: ["toradaId"], where: { toradaId: { in: toradas.map((t) => t.id) }, ...vigente }, _sum: { corderosSenalados: true } }))
      .map((g) => [g.toradaId!, g._sum.corderosSenalados ?? 0]))
    : new Map<string, number>()
  const data = filas.map((s) => {
    const base = s.torada ? encarneradas.get(s.torada.id) ?? 0 : 0
    const porcentaje = s.torada && base ? Math.round(((senaladosPorTorada.get(s.torada.id) ?? 0) / base) * 100) : null
    return { ...s, encarneradas: s.torada ? base : null, porcentajeSenalada: porcentaje, calificacion: porcentaje != null ? calificarSenalada(porcentaje) : null }
  })
  return { data, pagination: { page: f.page, limit: f.limit, total, totalPages: Math.max(1, Math.ceil(total / f.limit)) } }
}
