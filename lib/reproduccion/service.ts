// Reproducción: un único camino de escritura por evento (servicio, tacto, parición, destete,
// torada) con permisos por campo (spec 10 §4), reglas del dominio y auditoría en la misma
// transacción; listados por campo y paginados; indicadores agregados en la base.

import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { diasEntre, formatoDia, hoyArgentina } from "@/lib/inventario/fechas"
import {
  ROLES_REPRODUCCION, busquedaAnimalesSchema, desteteSchema, filtrosReproduccionSchema, paricionSchema, servicioSchema, tactoSchema, toradaSchema,
  TIPOS_SERVICIO, RESULTADOS_TACTO, type AccionReproduccion, type FiltrosReproduccion,
} from "./validation"

export class ReproduccionError extends Error {
  constructor(message: string, public status = 400, public codigo?: string) {
    super(message)
  }
}

type Tx = Prisma.TransactionClient
const fechaDia = (d: string) => new Date(`${d}T00:00:00Z`)
const diaDe = (d: Date) => d.toISOString().slice(0, 10)
/** Límites del día en Argentina, para comparar con historiales guardados como instantes. */
const inicioDia = (d: string) => new Date(`${d}T00:00:00-03:00`)
const finDia = (d: string) => new Date(`${d}T23:59:59.999-03:00`)

const NOMBRE_ACCION: Record<AccionReproduccion, string> = { servicio: "servicios", tacto: "tactos", paricion: "partos", destete: "destetes", torada: "toradas" }
const SEL_ANIMAL = { id: true, sexo: true, estadoVital: true, especieId: true, establecimientoId: true, fechaNacimiento: true, caravanaVisual: true, cuig: true } as const
type AnimalBase = Prisma.AnimalGetPayload<{ select: typeof SEL_ANIMAL }>
const etiqueta = (a: { caravanaVisual: string | null; cuig: string | null }) => a.caravanaVisual || a.cuig || "sin caravana"

function exigirRol(ctx: AuthContext, establecimientoId: string, accion: AccionReproduccion) {
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

function nacidoAntes(a: AnimalBase, fecha: string) {
  if (a.fechaNacimiento && fecha < diaDe(a.fechaNacimiento)) throw new ReproduccionError(`La fecha es anterior al nacimiento de ${etiqueta(a)} (${formatoDia(a.fechaNacimiento)})`, 400)
}

async function auditar(tx: Tx, ctx: AuthContext, establecimientoId: string, tabla: string, rowPk: string, detalle: Record<string, unknown>) {
  await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[establecimientoId] ?? null, tabla, rowPk, accion: "INSERT", detalle: JSON.parse(JSON.stringify(detalle)) } })
}

// ─── Escrituras ─────────────────────────────────────────────────────────────

export async function registrarServicio(ctx: AuthContext, raw: unknown) {
  const v = servicioSchema.parse(raw)
  const hembra = await animalParaEvento(ctx, v.hembraId, "servicio", { nombre: "La hembra", sexo: "F" })
  nacidoAntes(hembra, v.fecha)
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
  const ultimoTacto = await prisma.evtTacto.findFirst({ where: { hembraId: hembra.id, fecha: { lte: fechaDia(v.fecha) } }, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], select: { fecha: true, resultado: true } })
  if (ultimoTacto?.resultado === "preñada" && !v.aceptarPrenada) {
    const parto = await prisma.evtParicion.count({ where: { madreId: hembra.id, fecha: { gte: ultimoTacto.fecha, lte: fechaDia(v.fecha) } } })
    if (!parto) throw new ReproduccionError(`${etiqueta(hembra)} figura preñada (tacto del ${formatoDia(ultimoTacto.fecha)}). ¿Registrar el servicio igual?`, 409, "prenada")
  }
  if (await prisma.evtServicio.count({ where: { hembraId: hembra.id, fecha: fechaDia(v.fecha), tipo: v.tipo } })) {
    throw new ReproduccionError(`Ya hay un servicio ${v.tipo === "natural" ? "natural" : v.tipo.toUpperCase()} de ${etiqueta(hembra)} ese día`, 409)
  }
  return prisma.$transaction(async (tx) => {
    const servicio = await tx.evtServicio.create({
      data: {
        fecha: fechaDia(v.fecha), tipo: v.tipo, hembraId: hembra.id, machoId: v.machoId, toradaId: v.toradaId,
        toroNombre: v.toroNombre, loteSemen: v.loteSemen, inseminador: v.inseminador, observ: v.observ,
      },
    })
    await auditar(tx, ctx, hembra.establecimientoId, "evt_servicio", servicio.id, { hembraId: hembra.id, fecha: v.fecha, tipo: v.tipo, machoId: v.machoId, toradaId: v.toradaId })
    return servicio
  })
}

export async function registrarTacto(ctx: AuthContext, raw: unknown) {
  const v = tactoSchema.parse(raw)
  const hembra = await animalParaEvento(ctx, v.hembraId, "tacto", { nombre: "La hembra", sexo: "F" })
  nacidoAntes(hembra, v.fecha)
  if (v.servicioId) {
    const s = await prisma.evtServicio.findUnique({ where: { id: v.servicioId }, select: { hembraId: true, fecha: true, tacto: { select: { id: true } } } })
    if (!s || s.hembraId !== hembra.id) throw new ReproduccionError(`El servicio elegido no es de ${etiqueta(hembra)}`, 400)
    if (diaDe(s.fecha) > v.fecha) throw new ReproduccionError(`El tacto no puede ser anterior a su servicio (${formatoDia(s.fecha)})`, 400)
    if (s.tacto) throw new ReproduccionError("Ese servicio ya tiene un tacto registrado", 409)
  }
  if (await prisma.evtTacto.count({ where: { hembraId: hembra.id, fecha: fechaDia(v.fecha) } })) {
    throw new ReproduccionError(`Ya hay un tacto de ${etiqueta(hembra)} ese día`, 409)
  }
  return prisma.$transaction(async (tx) => {
    const tacto = await tx.evtTacto.create({
      data: {
        fecha: fechaDia(v.fecha), resultado: v.resultado, metodo: v.metodo, hembraId: hembra.id, servicioId: v.servicioId,
        mesesGest: v.mesesGest, fechaProbableParto: v.fechaProbableParto ? fechaDia(v.fechaProbableParto) : null, veterinario: v.veterinario, observ: v.observ,
      },
    })
    await auditar(tx, ctx, hembra.establecimientoId, "evt_tacto", tacto.id, { hembraId: hembra.id, fecha: v.fecha, resultado: v.resultado, servicioId: v.servicioId })
    return tacto
  })
}

export async function registrarParicion(ctx: AuthContext, raw: unknown) {
  const v = paricionSchema.parse(raw)
  const madre = await animalParaEvento(ctx, v.madreId, "paricion", { nombre: "La madre", sexo: "F" })
  nacidoAntes(madre, v.fecha)
  // El padre pudo haberse vendido después del servicio: no se exige que siga activo
  if (v.padreId) await machoCompatible(ctx, v.padreId, madre, { nombre: "El padre", exigirActivo: false })
  if (!v.confirmarMellizo && await prisma.evtParicion.count({ where: { madreId: madre.id, fecha: fechaDia(v.fecha) } })) {
    throw new ReproduccionError(`Ya hay un parto de ${etiqueta(madre)} ese día. ¿Es un mellizo?`, 409, "mellizo")
  }
  return prisma.$transaction(async (tx) => {
    const paricion = await tx.evtParicion.create({
      data: {
        fecha: fechaDia(v.fecha), resultado: v.resultado, madreId: madre.id, padreId: v.padreId, padreExterno: v.padreExterno,
        pesoNacerKg: v.pesoNacerKg, tipoParto: v.tipoParto, dificultad: v.dificultad, sexoCria: v.sexoCria, observ: v.observ,
      },
    })
    await auditar(tx, ctx, madre.establecimientoId, "evt_paricion", paricion.id, { madreId: madre.id, fecha: v.fecha, resultado: v.resultado, padreId: v.padreId })
    return paricion
  })
}

export async function registrarDestete(ctx: AuthContext, raw: unknown) {
  const v = desteteSchema.parse(raw)
  const animal = await animalParaEvento(ctx, v.animalId, "destete", { nombre: "El animal" })
  nacidoAntes(animal, v.fecha)
  const previo = await prisma.evtDestete.findUnique({ where: { animalId: animal.id }, select: { fecha: true } })
  if (previo) throw new ReproduccionError(`${etiqueta(animal)} ya tiene un destete registrado (${formatoDia(previo.fecha)})`, 409)
  if (v.loteDesteteId) {
    const lote = await prisma.lote.findFirst({ where: { id: v.loteDesteteId, establecimientoId: animal.establecimientoId }, select: { activo: true } })
    if (!lote) throw new ReproduccionError("El grupo de destete no es del campo del animal", 400)
    if (!lote.activo) throw new ReproduccionError("El grupo de destete está inactivo", 400)
  }
  // La edad sale de la fecha de nacimiento cuando se conoce
  const edadDias = animal.fechaNacimiento ? diasEntre(diaDe(animal.fechaNacimiento), v.fecha) : v.edadDias
  return prisma.$transaction(async (tx) => {
    const destete = await tx.evtDestete.create({
      data: { fecha: fechaDia(v.fecha), animalId: animal.id, pesoKg: v.pesoKg, edadDias, metodo: v.metodo, loteDesteteId: v.loteDesteteId, observ: v.observ },
    })
    await auditar(tx, ctx, animal.establecimientoId, "evt_destete", destete.id, { animalId: animal.id, fecha: v.fecha, pesoKg: v.pesoKg })
    return destete
  })
}

export async function crearTorada(ctx: AuthContext, raw: unknown) {
  const v = toradaSchema.parse(raw)
  const lote = await prisma.lote.findFirst({ where: { id: v.loteId, establecimientoId: { in: ctx.establecimientoIds } }, select: { establecimientoId: true, activo: true } })
  if (!lote) throw new ReproduccionError("Grupo no encontrado", 404)
  exigirRol(ctx, lote.establecimientoId, "torada")
  if (!lote.activo) throw new ReproduccionError("El grupo está inactivo", 400)
  return prisma.$transaction(async (tx) => {
    const torada = await tx.torada.create({
      data: {
        nombre: v.nombre, loteId: v.loteId, tipo: v.tipo, fechaInicio: fechaDia(v.fechaInicio), fechaFin: v.fechaFin ? fechaDia(v.fechaFin) : null,
        cantidadHembras: v.cantidadHembras, cantidadMachos: v.cantidadMachos, observ: v.observ,
      },
    })
    await auditar(tx, ctx, lote.establecimientoId, "toradas", torada.id, { nombre: v.nombre, loteId: v.loteId, tipo: v.tipo, fechaInicio: v.fechaInicio })
    return torada
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

export async function listarServicios(ctx: AuthContext, raw: unknown) {
  const f = filtros(ctx, raw)
  const where: Prisma.EvtServicioWhereInput = {
    hembra: { establecimientoId: f.establecimientoId, ...buscarAnimal(f.q) }, ...rangoFechas(f),
    ...(f.hembraId ? { hembraId: f.hembraId } : {}), ...(f.machoId ? { machoId: f.machoId } : {}), ...(f.toradaId ? { toradaId: f.toradaId } : {}),
    ...(f.tipo && (TIPOS_SERVICIO as readonly string[]).includes(f.tipo) ? { tipo: f.tipo } : {}),
    ...(f.sinTacto ? { tacto: { is: null } } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.evtServicio.findMany({
      where, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], ...pagina(f),
      include: { hembra: { select: { ...SEL_ID, categoria: { select: { nombre: true } } } }, macho: { select: SEL_ID }, torada: { select: { id: true, nombre: true } }, tacto: { select: { id: true, fecha: true, resultado: true } } },
    }),
    prisma.evtServicio.count({ where }),
  ])
  return { data, pagination: paginacion(f, total) }
}

export async function listarTactos(ctx: AuthContext, raw: unknown) {
  const f = filtros(ctx, raw)
  const where: Prisma.EvtTactoWhereInput = {
    hembra: { establecimientoId: f.establecimientoId, ...buscarAnimal(f.q) }, ...rangoFechas(f),
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
    madre: { establecimientoId: f.establecimientoId, ...buscarAnimal(f.q) }, ...rangoFechas(f),
    ...(f.hembraId ? { madreId: f.hembraId } : {}), ...(f.resultado === "vivo" || f.resultado === "muerto" ? { resultado: f.resultado } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.evtParicion.findMany({ where, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], ...pagina(f), include: { madre: { select: SEL_ID }, padre: { select: SEL_ID }, nacido: { select: { ...SEL_ID, sexo: true } } } }),
    prisma.evtParicion.count({ where }),
  ])
  return { data, pagination: paginacion(f, total) }
}

export async function listarDestetes(ctx: AuthContext, raw: unknown) {
  const f = filtros(ctx, raw)
  const where: Prisma.EvtDesteteWhereInput = { animal: { establecimientoId: f.establecimientoId, ...buscarAnimal(f.q) }, ...rangoFechas(f) }
  const [data, total] = await Promise.all([
    prisma.evtDestete.findMany({
      where, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], ...pagina(f),
      include: { animal: { select: { ...SEL_ID, sexo: true, raza: { select: { nombre: true } } } }, loteDestete: { select: { id: true, nombre: true } } },
    }),
    prisma.evtDestete.count({ where }),
  ])
  return { data, pagination: paginacion(f, total) }
}

export async function listarToradas(ctx: AuthContext, raw: unknown) {
  const f = filtros(ctx, raw)
  const where: Prisma.ToradaWhereInput = {
    lote: { establecimientoId: f.establecimientoId }, ...(f.activa ? { fechaFin: null } : {}), ...(f.tipo ? { tipo: f.tipo } : {}),
  }
  const [data, total] = await Promise.all([
    prisma.torada.findMany({ where, orderBy: [{ fechaInicio: "desc" }, { createdAt: "desc" }], ...pagina(f), include: { lote: { select: { id: true, nombre: true } }, _count: { select: { servicios: true } } } }),
    prisma.torada.count({ where }),
  ])
  return { data, pagination: paginacion(f, total) }
}

/** Animales activos del campo para los selectores (búsqueda en el servidor). */
export async function buscarAnimales(ctx: AuthContext, raw: unknown) {
  const f = busquedaAnimalesSchema.parse(raw)
  if (!ctx.establecimientoIds.includes(f.establecimientoId)) throw new ReproduccionError("Campo no encontrado", 404)
  return prisma.animal.findMany({
    where: { establecimientoId: f.establecimientoId, estadoVital: "activo", ...(f.sexo ? { sexo: f.sexo } : {}), ...(f.especieId ? { especieId: f.especieId } : {}), ...buscarAnimal(f.q) },
    select: { id: true, caravanaVisual: true, cuig: true, caravanaRfid: true, sexo: true, especieId: true, especie: { select: { nombre: true } }, categoria: { select: { nombre: true } } },
    orderBy: [{ caravanaVisual: "asc" }, { id: "asc" }], take: f.limit,
  })
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
      WHERE a.establecimiento_id = ANY(${establecimientoIds}::uuid[]) AND a.estado_vital = 'activo'
      ORDER BY t.hembra_id, t.fecha DESC, t.created_at DESC
    ) u
    WHERE u.resultado = 'preñada' AND u.fecha_probable_parto BETWEEN ${desde}::date AND ${hasta}::date
      AND NOT EXISTS (SELECT 1 FROM evt_paricion p WHERE p.madre_id = u.hembra_id AND p.fecha >= u.fecha)`
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
        WHERE a.establecimiento_id = ${establecimientoId}::uuid AND a.estado_vital = 'activo' AND s.fecha >= ${hace12}::date
        GROUP BY s.hembra_id
      ) u WHERE NOT EXISTS (SELECT 1 FROM evt_tacto t WHERE t.hembra_id = u.hembra_id AND t.fecha >= u.f)`,
    prisma.$queryRaw<{ resultado: string; n: number }[]>`
      SELECT resultado, COUNT(*)::int AS n FROM (
        SELECT DISTINCT ON (t.hembra_id) t.resultado FROM evt_tacto t JOIN animales a ON a.id = t.hembra_id
        WHERE a.establecimiento_id = ${establecimientoId}::uuid AND a.estado_vital = 'activo' AND t.fecha >= ${hace12}::date
        ORDER BY t.hembra_id, t.fecha DESC, t.created_at DESC
      ) u GROUP BY resultado`,
    prisma.$queryRaw<{ n: number; atrasadas: number }[]>`
      SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE u.fecha_probable_parto < ${hoy}::date)::int AS atrasadas FROM (
        SELECT DISTINCT ON (t.hembra_id) t.hembra_id, t.fecha, t.resultado, t.fecha_probable_parto
        FROM evt_tacto t JOIN animales a ON a.id = t.hembra_id
        WHERE a.establecimiento_id = ${establecimientoId}::uuid AND a.estado_vital = 'activo'
        ORDER BY t.hembra_id, t.fecha DESC, t.created_at DESC
      ) u WHERE u.resultado = 'preñada' AND NOT EXISTS (SELECT 1 FROM evt_paricion p WHERE p.madre_id = u.hembra_id AND p.fecha >= u.fecha)`,
    prisma.evtParicion.groupBy({ by: ["resultado"], where: { madre: { establecimientoId }, fecha: { gte: fechaDia(`${anio}-01-01`), lte: fechaDia(`${anio}-12-31`) } }, _count: { _all: true } }),
    prisma.evtDestete.count({ where: { animal: { establecimientoId }, fecha: { gte: fechaDia(`${anio}-01-01`), lte: fechaDia(`${anio}-12-31`) } } }),
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
    partosAnio: { vivos: nacidos("vivo"), muertos: nacidos("muerto") },
    destetesAnio: destetes,
  }
}

/** Respuesta de error para las rutas (null = error inesperado → 500). */
export function errorReproduccion(error: unknown) {
  if (error instanceof ReproduccionError) return { body: { success: false, error: error.message, codigo: error.codigo }, status: error.status }
  if (error instanceof z.ZodError) return { body: { success: false, error: error.issues[0]?.message ?? "Datos inválidos", errores: error.issues.map((i) => i.message) }, status: 400 }
  if (error instanceof SyntaxError) return { body: { success: false, error: "Datos inválidos" }, status: 400 }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { body: { success: false, error: "Ese registro ya existe (el servicio ya tiene tacto o el animal ya fue destetado)" }, status: 409 }
  }
  return null
}
