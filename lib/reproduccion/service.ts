// Reproducción: un único camino de escritura por evento (servicio, tacto, parición, destete,
// torada) con permisos por campo (spec 10 §4), reglas del dominio y auditoría en la misma
// transacción; listados por campo y paginados; indicadores agregados en la base.

import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { altaDeCria, identificadoresDeCriasLibres } from "@/lib/ganado/alta"
import { estadosReproductivos } from "./estado"
import { sincronizarTareasReproductivas } from "./agenda"
import { normalizeEID } from "@/lib/hardware/eid"
import { diasEntre, formatoDia, hoyArgentina } from "@/lib/inventario/fechas"
import { InventarioError } from "@/lib/inventario/service"
import { SanidadError } from "@/lib/sanidad/errores"
import { descontarAplicacion, revertirAplicaciones } from "@/lib/inventario/aplicaciones"
import {
  ROLES_ANULAR, ROLES_REPRODUCCION, EDICION_POR_TIPO, anulacionSchema, busquedaAnimalesSchema, calcularParto, desteteSchema, edicionToradaSchema,
  filtrosReproduccionSchema, paricionSchema, servicioSchema, tactoSchema, toradaSchema,
  TIPOS_SERVICIO, RESULTADOS_TACTO, soloServicioNatural, tipoGrupoDeEspecie, type AccionReproduccion, type FiltrosReproduccion, type TipoEvento,
} from "./validation"

export class ReproduccionError extends Error {
  constructor(message: string, public status = 400, public codigo?: string) {
    super(message)
  }
}

export type Tx = Prisma.TransactionClient
export const fechaDia = (d: string) => new Date(`${d}T00:00:00Z`)
export const diaDe = (d: Date) => d.toISOString().slice(0, 10)
/** Límites del día en Argentina, para comparar con historiales guardados como instantes. */
export const inicioDia = (d: string) => new Date(`${d}T00:00:00-03:00`)
export const finDia = (d: string) => new Date(`${d}T23:59:59.999-03:00`)
/** Instante de un evento del día para los historiales (mediodía de Argentina, nunca futuro). */
export const instanteDe = (d: string) => new Date(Math.min(Date.parse(`${d}T12:00:00-03:00`), Date.now()))
export const vigente = { anuladoAt: null }

const NOMBRE_ACCION: Record<AccionReproduccion, string> = { servicio: "servicios", tacto: "tactos", paricion: "partos", destete: "destetes", torada: "toradas", senalada: "señaladas", iatf: "protocolos IATF" }
export const SEL_ANIMAL = {
  id: true, sexo: true, estadoVital: true, especieId: true, razaId: true, establecimientoId: true, fechaNacimiento: true, caravanaVisual: true, cuig: true, caravanaRfid: true,
  especie: { select: { nombre: true } },
} as const
type AnimalBase = Prisma.AnimalGetPayload<{ select: typeof SEL_ANIMAL }>
export const etiqueta = (a: { caravanaVisual: string | null; cuig: string | null }) => a.caravanaVisual || a.cuig || "sin caravana"

export function exigirRol(ctx: AuthContext, establecimientoId: string, accion: AccionReproduccion) {
  if (!ctx.establecimientoIdsConRol([...ROLES_REPRODUCCION[accion]]).includes(establecimientoId)) {
    throw new ReproduccionError(`Tu rol en ese campo no permite registrar ${NOMBRE_ACCION[accion]}`, 403)
  }
}

/** Hembra (o animal) del usuario, activa, con permiso para la acción en su campo. */
async function animalParaEvento(ctx: AuthContext, id: string, accion: AccionReproduccion, opts: { nombre: string; sexo?: "F" | "M" }) {
  const a = await prisma.animal.findFirst({ where: { id, establecimientoId: { in: ctx.establecimientoIds } }, select: SEL_ANIMAL })
  if (!a || !a.establecimientoId) throw new ReproduccionError(`${opts.nombre} no encontrado`, 404)
  exigirRol(ctx, a.establecimientoId, accion)
  if (opts.sexo && a.sexo !== opts.sexo) throw new ReproduccionError(`${etiqueta(a)} es ${a.sexo === "M" ? "macho" : "hembra"}: no puede ser ${opts.nombre.toLowerCase()}`, 400)
  if (a.estadoVital !== "activo") throw new ReproduccionError(`${etiqueta(a)} está dado de baja (${a.estadoVital})`, 400)
  return a as AnimalBase & { establecimientoId: string }
}

/** Macho de la misma organización y especie que la hembra. */
async function machoCompatible(ctx: AuthContext, id: string, hembra: AnimalBase & { establecimientoId: string }, opts: { nombre: string; exigirActivo: boolean }) {
  const m = await prisma.animal.findFirst({ where: { id, establecimientoId: { in: ctx.establecimientoIds } }, select: SEL_ANIMAL })
  const org = ctx.organizacionDeEstablecimiento[hembra.establecimientoId]
  if (!m || !m.establecimientoId || ctx.organizacionDeEstablecimiento[m.establecimientoId] !== org) throw new ReproduccionError(`${opts.nombre} no encontrado`, 404)
  if (m.sexo !== "M") throw new ReproduccionError(`${etiqueta(m)} es hembra: no puede ser ${opts.nombre.toLowerCase()}`, 400)
  if (m.especieId !== hembra.especieId) throw new ReproduccionError(`${etiqueta(m)} es de otra especie que ${etiqueta(hembra)}`, 400)
  if (opts.exigirActivo && m.estadoVital !== "activo") throw new ReproduccionError(`${etiqueta(m)} está dado de baja (${m.estadoVital})`, 400)
  return m
}

export function nacidoAntes(a: AnimalBase, fecha: string) {
  if (a.fechaNacimiento && fecha < diaDe(a.fechaNacimiento)) throw new ReproduccionError(`La fecha es anterior al nacimiento de ${etiqueta(a)} (${formatoDia(a.fechaNacimiento)})`, 400)
}

export async function auditar(tx: Tx, ctx: AuthContext, establecimientoId: string, tabla: string, rowPk: string, detalle: Record<string, unknown>) {
  await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[establecimientoId] ?? null, tabla, rowPk, accion: "INSERT", detalle: JSON.parse(JSON.stringify(detalle)) } })
}

// ─── Escrituras ─────────────────────────────────────────────────────────────

/**
 * Pajuela del inventario para un servicio de IA/IATF: producto tipo semen, activo y de la
 * organización del campo (los del catálogo general no tienen stock); la partida, si se elige, del producto.
 */
export async function pajuelaDelCampo(ctx: AuthContext, establecimientoId: string, productoSemenId: string, loteProductoId: string | null) {
  const org = ctx.organizacionDeEstablecimiento[establecimientoId]
  const producto = org ? await prisma.producto.findFirst({ where: { id: productoSemenId, organizacionId: org }, select: { id: true, nombre: true, tipo: true, activo: true } }) : null
  if (!producto || producto.tipo !== "semen") throw new ReproduccionError("La pajuela no se encontró en el inventario de la organización", 404)
  if (!producto.activo) throw new ReproduccionError(`${producto.nombre} está archivado en el inventario`, 400)
  const lote = loteProductoId ? await prisma.loteProducto.findFirst({ where: { id: loteProductoId, productoId: producto.id }, select: { id: true, nroLote: true } }) : null
  if (loteProductoId && !lote) throw new ReproduccionError("La partida no es de esa pajuela", 400)
  return { producto, lote }
}

/** Descuenta una pajuela por servicio (estricto: si no hay stock, 409) y devuelve la partida usada. */
export async function descontarPajuela(tx: Tx, ctx: AuthContext, d: { establecimientoId: string; productoId: string; loteProductoId: string | null; fecha: string; servicioId: string; motivo: string }) {
  const stock = await descontarAplicacion(tx, {
    productoId: d.productoId, cantidad: 1, loteProductoId: d.loteProductoId, fecha: new Date(`${d.fecha}T12:00:00-03:00`),
    motivo: d.motivo, origenTipo: "servicio", origenId: d.servicioId,
  }, { establecimientoIds: ctx.establecimientoIds, establecimientoId: d.establecimientoId, estricto: true, aceptarVencido: true })
  return d.loteProductoId ?? (stock.lotes.length === 1 ? stock.lotes[0].loteProductoId : null)
}

export async function registrarServicio(ctx: AuthContext, raw: unknown) {
  const v = servicioSchema.parse(raw)
  const hembra = await animalParaEvento(ctx, v.hembraId, "servicio", { nombre: "La hembra", sexo: "F" })
  nacidoAntes(hembra, v.fecha)
  if (v.tipo !== "natural" && soloServicioNatural(hembra.especie.nombre)) throw new ReproduccionError("En ovinos el servicio es solo natural (encarnerada con carneros)", 400)
  if (v.machoId) await machoCompatible(ctx, v.machoId, hembra, { nombre: "El macho", exigirActivo: true })
  if (v.toradaId) {
    const torada = await prisma.torada.findFirst({ where: { id: v.toradaId, lote: { establecimientoId: hembra.establecimientoId } }, select: { nombre: true, loteId: true, fechaInicio: true, fechaFin: true } })
    if (!torada) throw new ReproduccionError("Torada no encontrada en el campo de la hembra", 404)
    const inicio = diaDe(torada.fechaInicio), fin = torada.fechaFin ? diaDe(torada.fechaFin) : null
    if (v.fecha < inicio || (fin && v.fecha > fin)) {
      throw new ReproduccionError(`El servicio cae fuera de la torada «${torada.nombre}» (${formatoDia(inicio)}${fin ? ` al ${formatoDia(fin)}` : " en adelante"})`, 400)
    }
    const enGrupo = await prisma.animalLoteHist.count({ where: { animalId: hembra.id, loteId: torada.loteId, desde: { lte: finDia(v.fecha) }, OR: [{ hasta: null }, { hasta: { gte: inicioDia(v.fecha) } }] } })
    if (!enGrupo) throw new ReproduccionError(`${etiqueta(hembra)} no estaba en el grupo de la torada «${torada.nombre}» en esa fecha`, 400)
  }
  // Una hembra preñada (último tacto positivo sin parto posterior) se sirve solo confirmando
  const ultimoTacto = await prisma.evtTacto.findFirst({ where: { hembraId: hembra.id, fecha: { lte: fechaDia(v.fecha) }, ...vigente }, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], select: { fecha: true, resultado: true } })
  if (ultimoTacto?.resultado === "preñada" && !v.aceptarPrenada) {
    const parto = await prisma.evtParicion.count({ where: { madreId: hembra.id, fecha: { gte: ultimoTacto.fecha, lte: fechaDia(v.fecha) }, ...vigente } })
    if (!parto) throw new ReproduccionError(`${etiqueta(hembra)} figura preñada (tacto del ${formatoDia(ultimoTacto.fecha)}). ¿Registrar el servicio igual?`, 409, "prenada")
  }
  if (await prisma.evtServicio.count({ where: { hembraId: hembra.id, fecha: fechaDia(v.fecha), tipo: v.tipo, ...vigente } })) {
    throw new ReproduccionError(`Ya hay un servicio ${v.tipo === "natural" ? "natural" : v.tipo.toUpperCase()} de ${etiqueta(hembra)} ese día`, 409)
  }
  const pajuela = v.productoSemenId ? await pajuelaDelCampo(ctx, hembra.establecimientoId, v.productoSemenId, v.loteProductoId) : null
  const resultado = await prisma.$transaction(async (tx) => {
    // La pajuela sale del stock en la misma transacción (1 por servicio)
    const id = crypto.randomUUID()
    const loteProductoId = pajuela
      ? await descontarPajuela(tx, ctx, { establecimientoId: hembra.establecimientoId, productoId: pajuela.producto.id, loteProductoId: pajuela.lote?.id ?? null, fecha: v.fecha, servicioId: id, motivo: `Servicio ${v.tipo.toUpperCase()} · ${etiqueta(hembra)}` })
      : null
    const partida = pajuela ? (pajuela.lote ?? (loteProductoId ? await tx.loteProducto.findUnique({ where: { id: loteProductoId }, select: { nroLote: true } }) : null)) : null
    const servicio = await tx.evtServicio.create({
      data: {
        id, fecha: fechaDia(v.fecha), tipo: v.tipo, hembraId: hembra.id, establecimientoId: hembra.establecimientoId, machoId: v.machoId, toradaId: v.toradaId,
        toroNombre: v.toroNombre ?? pajuela?.producto.nombre ?? null, loteSemen: v.loteSemen ?? partida?.nroLote ?? null, inseminador: v.inseminador, observ: v.observ,
        productoSemenId: pajuela?.producto.id ?? null, loteProductoId,
      },
    })
    await auditar(tx, ctx, hembra.establecimientoId, "evt_servicio", servicio.id, { hembraId: hembra.id, fecha: v.fecha, tipo: v.tipo, machoId: v.machoId, toradaId: v.toradaId })
    return servicio
  })
  await sincronizarTareasReproductivas(hembra.establecimientoId)
  return resultado
}

export async function registrarTacto(ctx: AuthContext, raw: unknown) {
  const v = tactoSchema.parse(raw)
  const hembra = await animalParaEvento(ctx, v.hembraId, "tacto", { nombre: "La hembra", sexo: "F" })
  nacidoAntes(hembra, v.fecha)
  let servicioFecha: string | null = null
  if (v.servicioId) {
    const s = await prisma.evtServicio.findUnique({ where: { id: v.servicioId }, select: { hembraId: true, fecha: true, anuladoAt: true, tacto: { select: { id: true } } } })
    if (!s || s.hembraId !== hembra.id || s.anuladoAt) throw new ReproduccionError(`El servicio elegido no es de ${etiqueta(hembra)}`, 400)
    if (diaDe(s.fecha) > v.fecha) throw new ReproduccionError(`El tacto no puede ser anterior a su servicio (${formatoDia(s.fecha)})`, 400)
    if (s.tacto) throw new ReproduccionError("Ese servicio ya tiene un tacto registrado", 409)
    servicioFecha = diaDe(s.fecha)
  }
  if (await prisma.evtTacto.count({ where: { hembraId: hembra.id, fecha: fechaDia(v.fecha), ...vigente } })) {
    throw new ReproduccionError(`Ya hay un tacto de ${etiqueta(hembra)} ese día`, 409)
  }
  // Preñada: la fecha probable de parto se calcula del servicio o de los meses (spec 03 §3.7)
  let { mesesGest, fechaProbableParto } = v
  if (v.resultado === "preñada") {
    if (v.metodo === "ecografia" && mesesGest == null && !servicioFecha) throw new ReproduccionError("Por ecografía, indicá los meses de gestación (o vinculá el servicio)", 400)
    const calc = calcularParto(hembra.especie.nombre, v.fecha, { servicioFecha, mesesGest })
    mesesGest = mesesGest ?? calc.mesesGest
    fechaProbableParto = fechaProbableParto ?? calc.fecha
  }
  const resultado = await prisma.$transaction(async (tx) => {
    const tacto = await tx.evtTacto.create({
      data: {
        fecha: fechaDia(v.fecha), resultado: v.resultado, metodo: v.metodo, hembraId: hembra.id, establecimientoId: hembra.establecimientoId, servicioId: v.servicioId,
        mesesGest, fechaProbableParto: fechaProbableParto ? fechaDia(fechaProbableParto) : null, veterinario: v.veterinario, observ: v.observ,
      },
    })
    await auditar(tx, ctx, hembra.establecimientoId, "evt_tacto", tacto.id, { hembraId: hembra.id, fecha: v.fecha, resultado: v.resultado, servicioId: v.servicioId })
    return tacto
  })
  await sincronizarTareasReproductivas(hembra.establecimientoId)
  return resultado
}

export async function registrarParicion(ctx: AuthContext, raw: unknown) {
  const v = paricionSchema.parse(raw)
  const madre = await animalParaEvento(ctx, v.madreId, "paricion", { nombre: "La madre", sexo: "F" })
  nacidoAntes(madre, v.fecha)
  // El padre pudo haberse vendido después del servicio: no se exige que siga activo
  const padre = v.padreId ? await machoCompatible(ctx, v.padreId, madre, { nombre: "El padre", exigirActivo: false }) : null
  if (!v.confirmarMellizo && await prisma.evtParicion.count({ where: { madreId: madre.id, fecha: fechaDia(v.fecha), ...vigente } })) {
    throw new ReproduccionError(`Ya hay un parto de ${etiqueta(madre)} ese día. ¿Registrar otro?`, 409, "mellizo")
  }
  // Crías vivas: caravanas libres y EID válido
  const crias = v.crias.map((c, n) => {
    const rfid = c.caravanaRfid ? normalizeEID(c.caravanaRfid) : null
    if (c.caravanaRfid && !rfid) throw new ReproduccionError(`El EID de la cría ${n + 1} no es válido`, 400)
    return { ...c, caravanaRfid: c.resultado === "vivo" ? rfid : null, caravanaVisual: c.resultado === "vivo" ? c.caravanaVisual : null }
  })
  const vivas = crias.filter((c) => c.resultado === "vivo")
  const errores = vivas.length ? await identificadoresDeCriasLibres(madre.establecimientoId, vivas) : []
  if (errores.length) throw new ReproduccionError(errores[0], 409)
  // La cría queda con la madre: su grupo y su lugar; categoría inicial del catálogo según sexo
  const org = ctx.organizacionDeEstablecimiento[madre.establecimientoId]
  const [loteMadre, lugarMadre, categorias] = vivas.length
    ? await Promise.all([
        prisma.animalLoteHist.findFirst({ where: { animalId: madre.id, hasta: null }, orderBy: { desde: "desc" }, select: { loteId: true } }),
        prisma.ubicacionHist.findFirst({ where: { animalId: madre.id, hasta: null }, orderBy: { desde: "desc" }, select: { sectorId: true } }),
        prisma.categoria.findMany({ where: { especieId: madre.especieId, OR: [{ organizacionId: org }, { organizacionId: null }] }, select: { id: true, sexo: true, edadMinMeses: true, edadMaxMeses: true, organizacionId: true } }),
      ])
    : [null, null, []]
  const categoriaInicial = (sexo: string) =>
    categorias.filter((c) => c.sexo === sexo || c.sexo == null)
      // La de menor edad (sin mínimo = desde el nacimiento); a igual edad, la que tiene tope de edad,
      // la del sexo exacto y la de la organización antes que la global
      .sort((a, b) => (a.edadMinMeses ?? 0) - (b.edadMinMeses ?? 0) || Number(a.edadMaxMeses == null) - Number(b.edadMaxMeses == null)
        || Number(!a.sexo) - Number(!b.sexo) || Number(!a.organizacionId) - Number(!b.organizacionId))[0]?.id ?? null
  // Raza de la madre si el padre es de la misma raza o no se conoce
  const raza = !padre || padre.razaId === madre.razaId ? madre.razaId : null
  const partoId = crypto.randomUUID()
  const datosParto = { fecha: fechaDia(v.fecha), madreId: madre.id, establecimientoId: madre.establecimientoId, padreId: v.padreId, padreExterno: v.padreExterno, tipoParto: v.tipoParto, dificultad: v.dificultad, observ: v.observ, partoId }

  const resultado = await prisma.$transaction(async (tx) => {
    const filas: { id: string; resultado: string; criaId: string | null; caravanaVisual: string | null }[] = []
    if (v.aborto) {
      const f = await tx.evtParicion.create({ data: { ...datosParto, resultado: "aborto" } })
      filas.push({ id: f.id, resultado: "aborto", criaId: null, caravanaVisual: null })
    }
    for (const c of crias) {
      const criaId = c.resultado === "vivo"
        ? await altaDeCria(tx, {
            especieId: madre.especieId, razaId: raza, categoriaId: categoriaInicial(c.sexo!), sexo: c.sexo!, fechaNacimiento: fechaDia(v.fecha),
            establecimientoId: madre.establecimientoId, caravanaVisual: c.caravanaVisual, caravanaRfid: c.caravanaRfid,
            madreId: madre.id, padreId: v.padreId, padreExterno: v.padreExterno, loteId: loteMadre?.loteId ?? null, sectorId: lugarMadre?.sectorId ?? null, desde: instanteDe(v.fecha),
          })
        : null
      // El peso al nacer también es la primera pesada de la cría (base de su ganancia diaria)
      if (criaId && c.pesoNacerKg) await tx.evtPesada.create({ data: { animalId: criaId, fecha: fechaDia(v.fecha), pesoKg: c.pesoNacerKg, observ: "Peso al nacer" } })
      const f = await tx.evtParicion.create({ data: { ...datosParto, resultado: c.resultado, sexoCria: c.sexo, pesoNacerKg: c.pesoNacerKg, nacidoAnimalId: criaId } })
      filas.push({ id: f.id, resultado: c.resultado, criaId, caravanaVisual: c.caravanaVisual })
    }
    await auditar(tx, ctx, madre.establecimientoId, "evt_paricion", partoId, { madreId: madre.id, fecha: v.fecha, aborto: v.aborto, crias: filas, padreId: v.padreId })
    return { partoId, filas, madreId: madre.id, organizacionId: ctx.organizacionDeEstablecimiento[madre.establecimientoId] }
  })
  await sincronizarTareasReproductivas(madre.establecimientoId)
  return resultado
}

/** Caravana electrónica obligatoria post destete en bovinos (Res. 841/2025, spec 01 §1.4). */
export const avisoCaravana = (a: { especie: { nombre: string }; caravanaRfid: string | null }) => a.especie.nombre.toLowerCase() === "bovino" && !a.caravanaRfid

/** Cierra el grupo abierto del animal y lo pasa a otro (si no está ya). Devuelve si lo movió. */
export async function moverAGrupo(tx: Tx, animalId: string, loteId: string, fecha: string, motivo: string) {
  const abiertos = await tx.animalLoteHist.findMany({ where: { animalId, hasta: null }, select: { id: true, loteId: true, desde: true } })
  if (abiertos.some((h) => h.loteId === loteId)) return false
  // Nunca antes de que haya entrado al grupo actual
  const cuando = new Date(Math.max(instanteDe(fecha).getTime(), ...abiertos.map((h) => h.desde.getTime())))
  if (abiertos.length) await tx.animalLoteHist.updateMany({ where: { id: { in: abiertos.map((h) => h.id) } }, data: { hasta: cuando } })
  await tx.animalLoteHist.create({ data: { animalId, loteId, desde: cuando, motivo } })
  return true
}

/** Grupo de destete válido: del campo del animal, activo y de su especie. */
export async function grupoDeDestete(loteId: string, establecimientoId: string, especieId: string) {
  const lote = await prisma.lote.findFirst({ where: { id: loteId, establecimientoId }, select: { activo: true, especieId: true } })
  if (!lote) throw new ReproduccionError("El grupo de destete no es del campo del animal", 400)
  if (!lote.activo) throw new ReproduccionError("El grupo de destete está inactivo", 400)
  if (lote.especieId !== especieId) throw new ReproduccionError("El grupo de destete es de otra especie", 400)
}

export async function registrarDestete(ctx: AuthContext, raw: unknown) {
  const v = desteteSchema.parse(raw)
  const animal = await animalParaEvento(ctx, v.animalId, "destete", { nombre: "El animal" })
  nacidoAntes(animal, v.fecha)
  const previo = await prisma.evtDestete.findFirst({ where: { animalId: animal.id, ...vigente }, select: { fecha: true } })
  if (previo) throw new ReproduccionError(`${etiqueta(animal)} ya tiene un destete registrado (${formatoDia(previo.fecha)})`, 409)
  if (v.loteDesteteId) await grupoDeDestete(v.loteDesteteId, animal.establecimientoId, animal.especieId)
  // La edad sale de la fecha de nacimiento cuando se conoce
  const edadDias = animal.fechaNacimiento ? diasEntre(diaDe(animal.fechaNacimiento), v.fecha) : v.edadDias
  const aviso = avisoCaravana(animal) ? `${etiqueta(animal)} no tiene caravana electrónica: es obligatoria después del destete.` : null
  const destete = await prisma.$transaction(async (tx) => {
    // Pesada del destete (spec 03 §3.9), vinculada para poder quitarla si se anula
    const pesada = v.pesoKg ? await tx.evtPesada.create({ data: { animalId: animal.id, fecha: fechaDia(v.fecha), pesoKg: v.pesoKg, observ: "Destete" } }) : null
    const destete = await tx.evtDestete.create({
      data: { fecha: fechaDia(v.fecha), animalId: animal.id, establecimientoId: animal.establecimientoId, pesoKg: v.pesoKg, edadDias, metodo: v.metodo, loteDesteteId: v.loteDesteteId, observ: v.observ, pesadaId: pesada?.id ?? null },
    })
    // Pasa al grupo de destete: se cierra el grupo actual y se abre el nuevo
    const movido = v.loteDesteteId ? await moverAGrupo(tx, animal.id, v.loteDesteteId, v.fecha, "destete") : false
    await auditar(tx, ctx, animal.establecimientoId, "evt_destete", destete.id, { animalId: animal.id, fecha: v.fecha, pesoKg: v.pesoKg, loteDesteteId: v.loteDesteteId, movido })
    return destete
  })
  await sincronizarTareasReproductivas(animal.establecimientoId)
  return { ...destete, aviso }
}

export async function crearTorada(ctx: AuthContext, raw: unknown) {
  const v = toradaSchema.parse(raw)
  const lote = await prisma.lote.findFirst({ where: { id: v.loteId, establecimientoId: { in: ctx.establecimientoIds } }, select: { establecimientoId: true, activo: true, especie: { select: { nombre: true } } } })
  if (!lote) throw new ReproduccionError("Grupo no encontrado", 404)
  exigirRol(ctx, lote.establecimientoId, "torada")
  if (!lote.activo) throw new ReproduccionError("El grupo está inactivo", 400)
  // Ovinos: encarnerada, solo con carneros (spec 03 §3.3 y §3.6)
  const tipoGrupo = tipoGrupoDeEspecie(lote.especie.nombre)
  if (tipoGrupo === "encarnerada" && v.tipo !== "natural") throw new ReproduccionError("La encarnerada es solo con servicio natural", 400)
  return prisma.$transaction(async (tx) => {
    const torada = await tx.torada.create({
      data: {
        nombre: v.nombre, loteId: v.loteId, tipo: v.tipo, tipoGrupo, fechaInicio: fechaDia(v.fechaInicio), fechaFin: v.fechaFin ? fechaDia(v.fechaFin) : null,
        cantidadHembras: v.cantidadHembras, cantidadMachos: v.cantidadMachos, observ: v.observ,
      },
    })
    await auditar(tx, ctx, lote.establecimientoId, "toradas", torada.id, { nombre: v.nombre, loteId: v.loteId, tipo: v.tipo, fechaInicio: v.fechaInicio })
    return torada
  })
}

// ─── Anular y editar ────────────────────────────────────────────────────────

type EventoBase = { id: string; fecha: Date; anuladoAt: Date | null; establecimientoId: string | null }
const ACCION_DE_TIPO: Record<TipoEvento, AccionReproduccion> = { servicio: "servicio", tacto: "tacto", paricion: "paricion", destete: "destete", senalada: "senalada" }
const TABLA_DE_TIPO: Record<TipoEvento, string> = { servicio: "evt_servicio", tacto: "evt_tacto", paricion: "evt_paricion", destete: "evt_destete", senalada: "evt_senalada" }

/** Evento del usuario (por el campo donde ocurrió) con el que se va a operar. */
async function eventoDelUsuario(ctx: AuthContext, tipo: TipoEvento, id: string): Promise<EventoBase & Record<string, unknown>> {
  // El evento es del campo donde ocurrió (aunque el animal se haya movido a otro)
  const delCampo = { id, establecimientoId: { in: ctx.establecimientoIds } }
  const sel = { id: true, fecha: true, anuladoAt: true, establecimientoId: true } as const
  const ev =
    tipo === "servicio" ? await prisma.evtServicio.findFirst({ where: delCampo, select: { ...sel, tacto: { select: { fecha: true, anuladoAt: true } } } })
    : tipo === "tacto" ? await prisma.evtTacto.findFirst({ where: delCampo, select: { ...sel, servicioId: true } })
    : tipo === "paricion" ? await prisma.evtParicion.findFirst({ where: delCampo, select: { ...sel, partoId: true } })
    : tipo === "destete" ? await prisma.evtDestete.findFirst({ where: delCampo, select: sel })
    : await prisma.evtSenalada.findFirst({ where: { id, lote: { establecimientoId: { in: ctx.establecimientoIds } } }, select: { id: true, fecha: true, anuladoAt: true, lote: { select: { establecimientoId: true } } } }).then((e) => e && { ...e, establecimientoId: e.lote.establecimientoId })
  if (!ev || !ev.establecimientoId) throw new ReproduccionError("Evento no encontrado", 404)
  return ev
}

/**
 * Deshace lo que hizo un destete al anularlo (lo que el usuario elija):
 * - quita su pesada (la vinculada; en destetes viejos, la del mismo día, peso y observación);
 * - vuelve el animal al grupo anterior, solo si sigue en el grupo de destete desde ese día
 *   (si después se movió, el historial queda como está y se avisa).
 * Devuelve qué se deshizo, para la auditoría (incluye la pesada quitada).
 */
async function deshacerDestete(tx: Tx, id: string, v: { quitarPesada: boolean; volverGrupo: boolean }, avisos: string[]) {
  const d = await tx.evtDestete.findUniqueOrThrow({ where: { id }, select: { animalId: true, fecha: true, pesoKg: true, loteDesteteId: true, pesadaId: true } })
  const hecho: Record<string, unknown> = {}
  if (v.quitarPesada) {
    const pesada = d.pesadaId
      ? await tx.evtPesada.findUnique({ where: { id: d.pesadaId } })
      : d.pesoKg != null ? await tx.evtPesada.findFirst({ where: { animalId: d.animalId, fecha: d.fecha, pesoKg: d.pesoKg, observ: "Destete", destete: { is: null } }, orderBy: { createdAt: "desc" } }) : null
    if (pesada) {
      await tx.evtPesada.delete({ where: { id: pesada.id } })
      hecho.pesadaQuitada = { id: pesada.id, fecha: diaDe(pesada.fecha), pesoKg: pesada.pesoKg }
      avisos.push(`Se quitó la pesada del destete (${pesada.pesoKg} kg).`)
    }
  }
  if (v.volverGrupo && d.loteDesteteId) {
    // El tramo abierto en el grupo de destete que abrió este destete (desde ese día)
    const tramo = await tx.animalLoteHist.findFirst({
      where: { animalId: d.animalId, loteId: d.loteDesteteId, motivo: "destete", desde: { gte: instanteDe(diaDe(d.fecha)) } },
      orderBy: { desde: "asc" }, select: { id: true, desde: true, hasta: true },
    })
    if (tramo && !tramo.hasta) {
      // Los tramos que el destete cerró (moverAGrupo cierra todos los abiertos en ese instante)
      const anteriores = await tx.animalLoteHist.findMany({
        where: { animalId: d.animalId, hasta: tramo.desde, id: { not: tramo.id } },
        select: { id: true, lote: { select: { nombre: true, activo: true } } },
      })
      const inactivo = anteriores.find((a) => !a.lote.activo)
      if (inactivo) {
        avisos.push(`El grupo anterior (${inactivo.lote.nombre}) está inactivo: el animal sigue en el grupo de destete.`)
      } else {
        await tx.animalLoteHist.delete({ where: { id: tramo.id } })
        if (anteriores.length) await tx.animalLoteHist.updateMany({ where: { id: { in: anteriores.map((a) => a.id) } }, data: { hasta: null } })
        hecho.grupo = { quitado: tramo.id, reabiertos: anteriores.map((a) => a.id) }
        avisos.push(anteriores.length ? `Volvió al grupo ${anteriores.map((a) => a.lote.nombre).join(", ")}.` : "Salió del grupo de destete (no tenía grupo antes).")
      }
    } else if (tramo) {
      avisos.push("El animal se movió de grupo después del destete: el historial de grupos queda como está.")
    }
  }
  return hecho
}

/**
 * Anula un evento (no se borra): admin o encargado del campo, con motivo. Un servicio con
 * tacto vigente no se anula (primero el tacto); un tacto libera su servicio para un nuevo
 * tacto; un parto se anula entero (todas sus crías) y, si hay crías dadas de alta, se pide
 * confirmar porque quedan en el rodeo (se dan de baja desde su ficha si fue un error).
 */
export async function anularEvento(ctx: AuthContext, tipo: TipoEvento, id: string, raw: unknown) {
  const v = anulacionSchema.parse(raw)
  const ev = await eventoDelUsuario(ctx, tipo, id)
  const est = ev.establecimientoId!
  if (!ctx.establecimientoIdsConRol([...ROLES_ANULAR]).includes(est)) throw new ReproduccionError("Solo un administrador o encargado del campo puede anular eventos", 403)
  if (ev.anuladoAt) throw new ReproduccionError("El evento ya está anulado", 409)
  const anulacion = { anuladoAt: new Date(), anuladoPorId: ctx.userId, motivoAnulacion: v.motivo }
  let aviso: string | null = null
  let ids = [id]

  if (tipo === "servicio") {
    const tacto = ev.tacto as { fecha: Date; anuladoAt: Date | null } | null
    if (tacto && !tacto.anuladoAt) throw new ReproduccionError(`El servicio tiene un tacto del ${formatoDia(tacto.fecha)}: anulá primero el tacto`, 409)
  }
  if (tipo === "paricion") {
    const filas = ev.partoId
      ? await prisma.evtParicion.findMany({ where: { partoId: ev.partoId as string, ...vigente }, select: { id: true, nacido: { select: { caravanaVisual: true, cuig: true } } } })
      : await prisma.evtParicion.findMany({ where: { id }, select: { id: true, nacido: { select: { caravanaVisual: true, cuig: true } } } })
    ids = filas.map((f) => f.id)
    const crias = filas.flatMap((f) => (f.nacido ? [etiqueta(f.nacido)] : []))
    if (crias.length && !v.aceptarCria) {
      throw new ReproduccionError(`${crias.length === 1 ? `La cría ${crias[0]} queda` : `Las crías ${crias.join(", ")} quedan`} en el rodeo con su genealogía. Si fue un error de carga, dalas de baja desde su ficha. ¿Anular el parto?`, 409, "paricion_con_cria")
    }
  }
  const avisos: string[] = []
  let deshecho: Record<string, unknown> | undefined

  await prisma.$transaction(async (tx) => {
    if (tipo === "destete") {
      deshecho = await deshacerDestete(tx, id, v, avisos)
    }
    if (tipo === "senalada") {
      const r = await revertirAplicaciones(tx, ids, v.motivo, "senalada")
      if (r.revertido) { deshecho = { stockDevuelto: r.revertido }; avisos.push("La vacuna descontada volvió al stock.") }
    }
    if (tipo === "servicio") {
      await tx.evtServicio.updateMany({ where: { id: { in: ids } }, data: anulacion })
      // La pajuela descontada vuelve al stock
      const r = await revertirAplicaciones(tx, ids, v.motivo, "servicio")
      if (r.revertido) avisos.push("La pajuela volvió al stock.")
    }
    // El tacto anulado libera su servicio (se puede volver a tactar)
    if (tipo === "tacto") await tx.evtTacto.updateMany({ where: { id: { in: ids } }, data: { ...anulacion, servicioId: null } })
    if (tipo === "paricion") await tx.evtParicion.updateMany({ where: { id: { in: ids } }, data: anulacion })
    if (tipo === "destete") await tx.evtDestete.updateMany({ where: { id: { in: ids } }, data: anulacion })
    if (tipo === "senalada") await tx.evtSenalada.updateMany({ where: { id: { in: ids } }, data: anulacion })
    await tx.auditLog.create({
      data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[est] ?? null, tabla: TABLA_DE_TIPO[tipo], rowPk: id, accion: "UPDATE", detalle: JSON.parse(JSON.stringify({ anulado: true, motivo: v.motivo, ids, servicioId: ev.servicioId ?? undefined, deshecho })) },
    })
  })
  await sincronizarTareasReproductivas(est)
  aviso = avisos.join(" ") || null
  return { anulados: ids.length, aviso }
}

/** Edita datos no críticos de un evento (quien puede registrarlo en ese campo). */
export async function editarEvento(ctx: AuthContext, tipo: TipoEvento, id: string, raw: unknown) {
  const datos = EDICION_POR_TIPO[tipo].parse(raw) as Record<string, unknown>
  const cambios = Object.fromEntries(Object.entries(datos).filter(([, x]) => x !== undefined))
  if (!Object.keys(cambios).length) throw new ReproduccionError("No hay cambios para guardar", 400)
  const ev = await eventoDelUsuario(ctx, tipo, id)
  exigirRol(ctx, ev.establecimientoId!, ACCION_DE_TIPO[tipo])
  if (ev.anuladoAt) throw new ReproduccionError("No se puede editar un evento anulado", 409)
  return prisma.$transaction(async (tx) => {
    const r =
      tipo === "servicio" ? await tx.evtServicio.update({ where: { id }, data: cambios })
      : tipo === "tacto" ? await tx.evtTacto.update({ where: { id }, data: cambios })
      : tipo === "paricion" ? await tx.evtParicion.update({ where: { id }, data: cambios })
      : tipo === "destete" ? await tx.evtDestete.update({ where: { id }, data: cambios })
      : await tx.evtSenalada.update({ where: { id }, data: cambios })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[ev.establecimientoId!] ?? null, tabla: TABLA_DE_TIPO[tipo], rowPk: id, accion: "UPDATE", detalle: JSON.parse(JSON.stringify(cambios)) } })
    return r
  })
}

/** Cierra una torada (fecha de fin), cambia sus datos o los toros asignados. */
export async function editarTorada(ctx: AuthContext, id: string, raw: unknown) {
  const v = edicionToradaSchema.parse(raw)
  const torada = await prisma.torada.findFirst({
    where: { id, lote: { establecimientoId: { in: ctx.establecimientoIds } } },
    select: { id: true, fechaInicio: true, lote: { select: { establecimientoId: true, especieId: true } } },
  })
  if (!torada) throw new ReproduccionError("Torada no encontrada", 404)
  const est = torada.lote.establecimientoId
  exigirRol(ctx, est, "torada")
  if (v.fechaFin) {
    if (v.fechaFin < diaDe(torada.fechaInicio)) throw new ReproduccionError("El fin no puede ser anterior al inicio", 400)
    const ultimo = await prisma.evtServicio.findFirst({ where: { toradaId: id, ...vigente }, orderBy: { fecha: "desc" }, select: { fecha: true } })
    if (ultimo && v.fechaFin < diaDe(ultimo.fecha)) throw new ReproduccionError(`La torada tiene servicios hasta el ${formatoDia(ultimo.fecha)}: el fin no puede ser anterior`, 400)
  }
  if (v.machoIds?.length) {
    const org = ctx.organizacionDeEstablecimiento[est]
    const machos = await prisma.animal.findMany({ where: { id: { in: v.machoIds }, establecimientoId: { in: ctx.establecimientoIds } }, select: SEL_ANIMAL })
    for (const mid of new Set(v.machoIds)) {
      const m = machos.find((x) => x.id === mid)
      if (!m || !m.establecimientoId || ctx.organizacionDeEstablecimiento[m.establecimientoId] !== org) throw new ReproduccionError("Un toro no es de la organización", 404)
      if (m.sexo !== "M") throw new ReproduccionError(`${etiqueta(m)} es hembra: no puede ser toro de la torada`, 400)
      if (m.especieId !== torada.lote.especieId) throw new ReproduccionError(`${etiqueta(m)} es de otra especie que el grupo`, 400)
      if (m.estadoVital !== "activo") throw new ReproduccionError(`${etiqueta(m)} está dado de baja (${m.estadoVital})`, 400)
    }
  }
  const { machoIds, fechaFin, ...datos } = v
  const data = Object.fromEntries(Object.entries({ ...datos, ...(fechaFin !== undefined ? { fechaFin: fechaFin ? fechaDia(fechaFin) : null } : {}) }).filter(([, x]) => x !== undefined))
  return prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) await tx.torada.update({ where: { id }, data })
    if (machoIds) {
      // Reemplaza los toros asignados de esta torada
      await tx.toradaMacho.deleteMany({ where: { toradaId: id } })
      if (machoIds.length) await tx.toradaMacho.createMany({ data: [...new Set(machoIds)].map((animalId) => ({ toradaId: id, animalId })) })
    }
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[est] ?? null, tabla: "toradas", rowPk: id, accion: "UPDATE", detalle: JSON.parse(JSON.stringify({ ...v })) } })
    return tx.torada.findUniqueOrThrow({ where: { id }, include: { machos: { include: { animal: { select: { id: true, caravanaVisual: true, cuig: true } } } } } })
  })
}

// ─── Lecturas ───────────────────────────────────────────────────────────────

function filtros(ctx: AuthContext, raw: unknown) {
  const f = filtrosReproduccionSchema.parse(raw)
  if (!ctx.establecimientoIds.includes(f.establecimientoId)) throw new ReproduccionError("Campo no encontrado", 404)
  return f
}
const rangoFechas = (f: FiltrosReproduccion) =>
  f.desde || f.hasta ? { fecha: { ...(f.desde ? { gte: fechaDia(f.desde) } : {}), ...(f.hasta ? { lte: fechaDia(f.hasta) } : {}) } } : {}
const buscarAnimal = (q?: string): Prisma.AnimalWhereInput =>
  q ? { OR: [{ caravanaVisual: { contains: q, mode: "insensitive" } }, { cuig: { contains: q, mode: "insensitive" } }, { caravanaRfid: { contains: q } }] } : {}
const paginacion = (f: FiltrosReproduccion, total: number) => ({ page: f.page, limit: f.limit, total, totalPages: Math.max(1, Math.ceil(total / f.limit)) })
const pagina = (f: FiltrosReproduccion) => ({ skip: (f.page - 1) * f.limit, take: f.limit })
const SEL_ID = { id: true, caravanaVisual: true, cuig: true } as const
const SEL_ANULACION = { anuladoAt: true, motivoAnulacion: true } as const
/** Por defecto solo los vigentes; con verAnulados, también los anulados. */
const soloVigentes = (f: FiltrosReproduccion) => (f.verAnulados ? {} : vigente)

export async function listarServicios(ctx: AuthContext, raw: unknown) {
  const f = filtros(ctx, raw)
  const where: Prisma.EvtServicioWhereInput = {
    establecimientoId: f.establecimientoId, hembra: buscarAnimal(f.q), ...rangoFechas(f), ...soloVigentes(f),
    ...(f.hembraId ? { hembraId: f.hembraId } : {}), ...(f.machoId ? { machoId: f.machoId } : {}), ...(f.toradaId ? { toradaId: f.toradaId } : {}),
    ...(f.tipo && (TIPOS_SERVICIO as readonly string[]).includes(f.tipo) ? { tipo: f.tipo } : {}),
    ...(f.sinTacto ? { tacto: { is: null } } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.evtServicio.findMany({
      where, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], ...pagina(f),
      include: { hembra: { select: { ...SEL_ID, categoria: { select: { nombre: true } } } }, macho: { select: SEL_ID }, torada: { select: { id: true, nombre: true } }, tacto: { select: { id: true, fecha: true, resultado: true, anuladoAt: true } } },
    }),
    prisma.evtServicio.count({ where }),
  ])
  return { data, pagination: paginacion(f, total) }
}

export async function listarTactos(ctx: AuthContext, raw: unknown) {
  const f = filtros(ctx, raw)
  const where: Prisma.EvtTactoWhereInput = {
    establecimientoId: f.establecimientoId, hembra: buscarAnimal(f.q), ...rangoFechas(f), ...soloVigentes(f),
    ...(f.hembraId ? { hembraId: f.hembraId } : {}),
    ...(f.resultado && (RESULTADOS_TACTO as readonly string[]).includes(f.resultado) ? { resultado: f.resultado } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.evtTacto.findMany({ where, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], ...pagina(f), include: { hembra: { select: SEL_ID }, servicio: { select: { id: true, fecha: true, tipo: true } } } }),
    prisma.evtTacto.count({ where }),
  ])
  return { data, pagination: paginacion(f, total) }
}

export async function listarPariciones(ctx: AuthContext, raw: unknown) {
  const f = filtros(ctx, raw)
  const where: Prisma.EvtParicionWhereInput = {
    establecimientoId: f.establecimientoId, madre: buscarAnimal(f.q), ...rangoFechas(f), ...soloVigentes(f),
    ...(f.hembraId ? { madreId: f.hembraId } : {}), ...(f.resultado === "vivo" || f.resultado === "muerto" || f.resultado === "aborto" ? { resultado: f.resultado } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.evtParicion.findMany({ where, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], ...pagina(f), include: { madre: { select: SEL_ID }, padre: { select: SEL_ID }, nacido: { select: { ...SEL_ID, sexo: true } } } }),
    prisma.evtParicion.count({ where }),
  ])
  return { data, pagination: paginacion(f, total) }
}

export async function listarDestetes(ctx: AuthContext, raw: unknown) {
  const f = filtros(ctx, raw)
  const where: Prisma.EvtDesteteWhereInput = { establecimientoId: f.establecimientoId, animal: buscarAnimal(f.q), ...rangoFechas(f), ...soloVigentes(f) }
  const [filas, total] = await Promise.all([
    prisma.evtDestete.findMany({
      where, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], ...pagina(f),
      include: {
        animal: { select: { ...SEL_ID, sexo: true, raza: { select: { nombre: true } }, nacimiento: { select: { pesoNacerKg: true, anuladoAt: true } } } },
        loteDestete: { select: { id: true, nombre: true } },
      },
    }),
    prisma.evtDestete.count({ where }),
  ])
  // Ganancia diaria nacer→destete y peso ajustado a 205 días (necesitan el peso al nacer)
  const data = filas.map(({ animal: { nacimiento, ...animal }, ...d }) => {
    const pesoNacer = nacimiento && !nacimiento.anuladoAt ? nacimiento.pesoNacerKg : null
    const gdp = d.pesoKg != null && pesoNacer != null && d.edadDias ? (d.pesoKg - pesoNacer) / d.edadDias : null
    return { ...d, animal, pesoNacerKg: pesoNacer, gdpKg: gdp != null ? Math.round(gdp * 1000) / 1000 : null, peso205: gdp != null ? Math.round(pesoNacer! + gdp * 205) : null }
  })
  return { data, pagination: paginacion(f, total) }
}

export async function listarToradas(ctx: AuthContext, raw: unknown) {
  const f = filtros(ctx, raw)
  const where: Prisma.ToradaWhereInput = {
    lote: { establecimientoId: f.establecimientoId }, ...(f.activa ? { fechaFin: null } : {}), ...(f.tipo ? { tipo: f.tipo } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.torada.findMany({
      where, orderBy: [{ fechaInicio: "desc" }, { createdAt: "desc" }], ...pagina(f),
      include: {
        lote: { select: { id: true, nombre: true, especieId: true } },
        machos: { include: { animal: { select: { ...SEL_ID, sexo: true, especieId: true, especie: { select: { nombre: true } }, categoria: { select: { nombre: true } }, caravanaRfid: true } } } },
        _count: { select: { servicios: { where: vigente } } },
      },
    }),
    prisma.torada.count({ where }),
  ])
  return { data, pagination: paginacion(f, total) }
}

/** Animales activos del campo para los selectores (búsqueda en el servidor). */
export async function buscarAnimales(ctx: AuthContext, raw: unknown) {
  const f = busquedaAnimalesSchema.parse(raw)
  if (!ctx.establecimientoIds.includes(f.establecimientoId)) throw new ReproduccionError("Campo no encontrado", 404)
  const animales = await prisma.animal.findMany({
    where: { establecimientoId: f.establecimientoId, estadoVital: "activo", ...(f.id ? { id: f.id } : {}), ...(f.sexo ? { sexo: f.sexo } : {}), ...(f.especieId ? { especieId: f.especieId } : {}), ...buscarAnimal(f.q) },
    select: { id: true, caravanaVisual: true, cuig: true, caravanaRfid: true, sexo: true, especieId: true, especie: { select: { nombre: true } }, categoria: { select: { nombre: true } } },
    orderBy: [{ caravanaVisual: "asc" }, { id: "asc" }], take: f.limit,
  })
  // Estado reproductivo de las hembras (para elegir con criterio: no servir a una preñada)
  const estados = await estadosReproductivos(animales.filter((a) => a.sexo === "F").map((a) => a.id))
  return animales.map((a) => ({ ...a, estadoReproductivo: estados.get(a.id) ?? null }))
}

// ─── Indicadores ────────────────────────────────────────────────────────────

/**
 * Hembras activas preñadas sin parto posterior a su último tacto, con fecha probable de
 * parto entre `desde` y `hasta` (una vez por hembra). La usan el resumen y el Panel.
 */
export async function partosPrevistos(establecimientoIds: string[], desde: string, hasta: string) {
  if (!establecimientoIds.length) return 0
  const [r] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM (
      SELECT DISTINCT ON (t.hembra_id) t.hembra_id, t.fecha, t.resultado, t.fecha_probable_parto
      FROM evt_tacto t JOIN animales a ON a.id = t.hembra_id
      WHERE a.establecimiento_id = ANY(${establecimientoIds}::uuid[]) AND a.estado_vital = 'activo' AND t.anulado_at IS NULL
      ORDER BY t.hembra_id, t.fecha DESC, t.created_at DESC
    ) u
    WHERE u.resultado = 'preñada' AND u.fecha_probable_parto BETWEEN ${desde}::date AND ${hasta}::date
      AND NOT EXISTS (SELECT 1 FROM evt_paricion p WHERE p.madre_id = u.hembra_id AND p.fecha >= u.fecha AND p.anulado_at IS NULL)`
  return r?.n ?? 0
}

/**
 * KPIs de la pantalla, del campo:
 * - servidas sin tactar: hembras activas con servicio en los últimos 12 meses y sin tacto posterior;
 * - % preñez: último tacto de cada hembra activa en los últimos 12 meses (las dudosas no cuentan);
 * - preñadas a parir y partos previstos en 30 días;
 * - partos y destetes del año (calendario de Argentina).
 */
export async function resumenReproduccion(ctx: AuthContext, establecimientoId: string) {
  if (!ctx.establecimientoIds.includes(establecimientoId)) throw new ReproduccionError("Campo no encontrado", 404)
  const hoy = hoyArgentina()
  const anio = hoy.slice(0, 4)
  const hace12 = diaDe(new Date(Date.parse(`${hoy}T00:00:00Z`) - 365 * 86_400_000))
  const en30 = diaDe(new Date(Date.parse(`${hoy}T00:00:00Z`) + 30 * 86_400_000))
  const [sinTacto, tactos, aParir, partos, destetes, previstos] = await Promise.all([
    prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM (
        SELECT s.hembra_id, MAX(s.fecha) AS f FROM evt_servicio s JOIN animales a ON a.id = s.hembra_id
        WHERE a.establecimiento_id = ${establecimientoId}::uuid AND a.estado_vital = 'activo' AND s.fecha >= ${hace12}::date AND s.anulado_at IS NULL
        GROUP BY s.hembra_id
      ) u WHERE NOT EXISTS (SELECT 1 FROM evt_tacto t WHERE t.hembra_id = u.hembra_id AND t.fecha >= u.f AND t.anulado_at IS NULL)`,
    prisma.$queryRaw<{ resultado: string; n: number }[]>`
      SELECT resultado, COUNT(*)::int AS n FROM (
        SELECT DISTINCT ON (t.hembra_id) t.resultado FROM evt_tacto t JOIN animales a ON a.id = t.hembra_id
        WHERE a.establecimiento_id = ${establecimientoId}::uuid AND a.estado_vital = 'activo' AND t.fecha >= ${hace12}::date AND t.anulado_at IS NULL
        ORDER BY t.hembra_id, t.fecha DESC, t.created_at DESC
      ) u GROUP BY resultado`,
    prisma.$queryRaw<{ n: number; atrasadas: number }[]>`
      SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE u.fecha_probable_parto < ${hoy}::date)::int AS atrasadas FROM (
        SELECT DISTINCT ON (t.hembra_id) t.hembra_id, t.fecha, t.resultado, t.fecha_probable_parto
        FROM evt_tacto t JOIN animales a ON a.id = t.hembra_id
        WHERE a.establecimiento_id = ${establecimientoId}::uuid AND a.estado_vital = 'activo' AND t.anulado_at IS NULL
        ORDER BY t.hembra_id, t.fecha DESC, t.created_at DESC
      ) u WHERE u.resultado = 'preñada' AND NOT EXISTS (SELECT 1 FROM evt_paricion p WHERE p.madre_id = u.hembra_id AND p.fecha >= u.fecha AND p.anulado_at IS NULL)`,
    prisma.evtParicion.groupBy({ by: ["resultado"], where: { establecimientoId, ...vigente, fecha: { gte: fechaDia(`${anio}-01-01`), lte: fechaDia(`${anio}-12-31`) } }, _count: { _all: true } }),
    prisma.evtDestete.count({ where: { establecimientoId, ...vigente, fecha: { gte: fechaDia(`${anio}-01-01`), lte: fechaDia(`${anio}-12-31`) } } }),
    partosPrevistos([establecimientoId], hoy, en30),
  ])
  const porResultado = Object.fromEntries(tactos.map((t) => [t.resultado, t.n])) as Record<string, number>
  const prenadas = porResultado["preñada"] ?? 0
  const diagnosticadas = prenadas + (porResultado.vacia ?? 0) + (porResultado.absorcion ?? 0)
  const nacidos = (r: string) => partos.find((p) => p.resultado === r)?._count._all ?? 0
  return {
    anio: Number(anio),
    servidasSinTacto: sinTacto[0]?.n ?? 0,
    tacto: { prenadas, vacias: porResultado.vacia ?? 0, dudosas: porResultado.dudosa ?? 0, absorcion: porResultado.absorcion ?? 0, porcentajePrenez: diagnosticadas ? Math.round((prenadas / diagnosticadas) * 100) : null },
    aParir: aParir[0]?.n ?? 0,
    partosAtrasados: aParir[0]?.atrasadas ?? 0,
    partosProximos30: previstos,
    partosAnio: { vivos: nacidos("vivo"), muertos: nacidos("muerto"), abortos: nacidos("aborto") },
    destetesAnio: destetes,
  }
}

/** Respuesta de error para las rutas (null = error inesperado → 500). */
export function errorReproduccion(error: unknown) {
  if (error instanceof ReproduccionError) return { body: { success: false, error: error.message, codigo: error.codigo }, status: error.status }
  // Descuento de stock (vacuna de la señalada): 409 si no alcanza o el lote está vencido
  if (error instanceof InventarioError) return { body: { success: false, error: error.message, codigo: error.codigo }, status: error.status }
  // Pasos hormonales de un protocolo IATF (se registran como aplicaciones de Sanidad)
  if (error instanceof SanidadError) return { body: { success: false, error: error.message, codigo: error.codigo }, status: error.status }
  if (error instanceof z.ZodError) return { body: { success: false, error: error.issues[0]?.message ?? "Datos inválidos", errores: error.issues.map((i) => i.message) }, status: 400 }
  if (error instanceof SyntaxError) return { body: { success: false, error: "Datos inválidos" }, status: 400 }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { body: { success: false, error: "Ese registro ya existe (el servicio ya tiene tacto o el animal ya fue destetado)" }, status: 409 }
  }
  return null
}
