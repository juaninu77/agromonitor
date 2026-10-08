// Equipo de una organización: miembros, roles, acceso por campo e invitaciones.
// - Solo propietarios y administradores gestionan (ver puedeGestionar en roles.ts).
// - Siempre queda al menos un propietario activo.
// - La invitación guarda solo el hash del token; vence a los 7 días y se usa una vez.
//   Queda ligada al email invitado: se acepta con una cuenta de ese email.

import { createHash, randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { enviarCorreo } from "@/lib/email"
import { emailSchema, normalizarEmail, passwordSchema } from "@/lib/validations/auth-schema"
import { admiteAccesoParcial, esGestor, normalizarRolOrg, puedeGestionar, ROL_INFO, ROLES_INVITABLES, ROLES_ORG, type RolOrg } from "./roles"

export class EquipoError extends Error { constructor(message: string, public status = 400) { super(message) } }

const DIAS_VIGENCIA = 7
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")
const nuevoToken = () => randomBytes(32).toString("base64url")
const venceEn = () => new Date(Date.now() + DIAS_VIGENCIA * 86_400_000)
const uuid = z.string().uuid()

const accesoSchema = {
  accesoTotal: z.boolean().default(true),
  establecimientoIds: z.array(uuid).max(200).default([]),
}
export const invitacionSchema = z.object({
  email: emailSchema,
  rol: z.enum(ROLES_INVITABLES, { errorMap: () => ({ message: "Elegí un rol" }) }),
  mensaje: z.string().trim().max(500).nullish().transform((v) => v || null),
  ...accesoSchema,
}).strict()
export const miembroUpdateSchema = z.object({
  rol: z.enum(ROLES_ORG).optional(),
  esActivo: z.boolean().optional(),
  accesoTotal: z.boolean().optional(),
  establecimientoIds: z.array(uuid).max(200).optional(),
}).strict()
export const registroInvitacionSchema = z.object({
  nombre: z.string().trim().min(1, "Ingresá tu nombre").max(80),
  apellido: z.string().trim().min(1, "Ingresá tu apellido").max(80),
  password: passwordSchema,
}).strict()

/** Rol real (sin normalizar a admin) del usuario en la organización. */
async function miRol(db: Prisma.TransactionClient, ctx: AuthContext, organizacionId: string): Promise<RolOrg> {
  if (!ctx.organizacionIds.includes(organizacionId)) throw new EquipoError("Organización no encontrada", 404)
  const m = await db.membresia.findUnique({ where: { usuarioId_organizacionId: { usuarioId: ctx.userId, organizacionId } }, select: { rol: true } })
  if (!m) throw new EquipoError("Organización no encontrada", 404)
  return normalizarRolOrg(m.rol)
}
async function exigirGestor(db: Prisma.TransactionClient, ctx: AuthContext, organizacionId: string) {
  const rol = await miRol(db, ctx, organizacionId)
  if (!esGestor(rol)) throw new EquipoError("Solo un propietario o administrador puede gestionar el equipo", 403)
  return rol
}

/** Valida los campos elegidos (de esa organización) y si el rol admite acceso parcial. */
async function validarAcceso(db: Prisma.TransactionClient, organizacionId: string, rol: RolOrg, accesoTotal: boolean, ids: string[]) {
  if (accesoTotal) return []
  if (!admiteAccesoParcial(rol)) throw new EquipoError("Propietarios y administradores acceden a todos los campos")
  const unicos = [...new Set(ids)]
  if (!unicos.length) throw new EquipoError("Elegí al menos un campo")
  const n = await db.establecimiento.count({ where: { id: { in: unicos }, organizacionId } })
  if (n !== unicos.length) throw new EquipoError("Algún campo no pertenece a la organización")
  return unicos
}

const auditar = (db: Prisma.TransactionClient, ctx: AuthContext, organizacionId: string, tabla: string, rowPk: string, accion: "INSERT" | "UPDATE" | "DELETE", detalle: object) =>
  db.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId, tabla, rowPk, accion, detalle: JSON.parse(JSON.stringify(detalle)) } })

// ------------------------------------------------------------
// Miembros
// ------------------------------------------------------------

export async function listarEquipo(ctx: AuthContext, organizacionId: string) {
  const rol = await miRol(prisma, ctx, organizacionId)
  const gestor = esGestor(rol)
  const [org, miembros, invitaciones, campos] = await Promise.all([
    prisma.organizacion.findUnique({ where: { id: organizacionId }, select: { id: true, nombre: true } }),
    prisma.membresia.findMany({
      where: { organizacionId, ...(gestor ? {} : { esActivo: true }) },
      include: { usuario: { select: { id: true, nombre: true, apellido: true, email: true, esActivo: true } }, establecimientosAcceso: { select: { establecimientoId: true } } },
      orderBy: [{ createdAt: "asc" }],
    }),
    gestor ? prisma.invitacion.findMany({ where: { organizacionId, estado: "pendiente" }, include: { invitadoPor: { select: { nombre: true, apellido: true } } }, orderBy: { createdAt: "desc" } }) : [],
    prisma.establecimiento.findMany({ where: { organizacionId }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  ])
  const ahora = new Date()
  return {
    organizacion: org,
    miRol: rol,
    puedeGestionar: gestor,
    campos,
    miembros: miembros.map((m) => ({
      id: m.id,
      usuarioId: m.usuarioId,
      nombre: m.usuario.nombre,
      apellido: m.usuario.apellido,
      // El email solo lo ven quienes gestionan el equipo (y cada uno el suyo)
      email: gestor || m.usuarioId === ctx.userId ? m.usuario.email : null,
      rol: normalizarRolOrg(m.rol),
      esActivo: m.esActivo && m.usuario.esActivo,
      accesoTotal: m.accesoTotal,
      establecimientoIds: m.establecimientosAcceso.map((e) => e.establecimientoId),
      soyYo: m.usuarioId === ctx.userId,
      desde: m.createdAt,
    })),
    invitaciones: invitaciones.map((i) => ({
      id: i.id, email: i.email, rol: i.rol, accesoTotal: i.accesoTotal, establecimientoIds: i.establecimientoIds,
      vencida: i.expiraAt < ahora, expiraAt: i.expiraAt, createdAt: i.createdAt,
      invitadoPor: `${i.invitadoPor.nombre} ${i.invitadoPor.apellido}`.trim(),
    })),
  }
}

export async function actualizarMiembro(ctx: AuthContext, organizacionId: string, membresiaId: string, raw: unknown) {
  const v = miembroUpdateSchema.parse(raw)
  return prisma.$transaction(async (tx) => {
    const actor = await exigirGestor(tx, ctx, organizacionId)
    const m = await tx.membresia.findFirst({ where: { id: membresiaId, organizacionId }, include: { establecimientosAcceso: true } })
    if (!m) throw new EquipoError("Miembro no encontrado", 404)
    const actual = normalizarRolOrg(m.rol)
    const nuevo = v.rol ?? actual
    if (!puedeGestionar(actor, actual, nuevo)) throw new EquipoError(actor === "admin" ? "Solo un propietario puede cambiar a administradores o propietarios" : "No podés hacer este cambio", 403)
    if (m.usuarioId === ctx.userId && (v.esActivo === false || (v.rol && v.rol !== actual))) throw new EquipoError("No podés cambiar tu propio rol ni desactivarte: pedíselo a otro propietario")
    await asegurarPropietario(tx, organizacionId, m.id, actual === "propietario" && (nuevo !== "propietario" || v.esActivo === false))
    const accesoTotal = esGestor(nuevo) ? true : (v.accesoTotal ?? m.accesoTotal)
    const ids = v.establecimientoIds ?? m.establecimientosAcceso.map((e) => e.establecimientoId)
    const campos = await validarAcceso(tx, organizacionId, nuevo, accesoTotal, ids)
    await tx.membresia.update({ where: { id: m.id }, data: { rol: nuevo, accesoTotal, ...(v.esActivo !== undefined ? { esActivo: v.esActivo } : {}) } })
    await tx.membresiaEstablecimiento.deleteMany({ where: { membresiaId: m.id } })
    if (!accesoTotal) await tx.membresiaEstablecimiento.createMany({ data: campos.map((establecimientoId) => ({ membresiaId: m.id, establecimientoId })) })
    await auditar(tx, ctx, organizacionId, "membresias", m.id, "UPDATE", { antes: { rol: actual, esActivo: m.esActivo, accesoTotal: m.accesoTotal }, despues: { rol: nuevo, esActivo: v.esActivo ?? m.esActivo, accesoTotal, establecimientoIds: campos } })
    return { id: m.id, rol: nuevo, accesoTotal, establecimientoIds: campos }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

/** Quitar a un miembro (o salir uno mismo). No borra datos: la persona deja de acceder. */
export async function quitarMiembro(ctx: AuthContext, organizacionId: string, membresiaId: string) {
  return prisma.$transaction(async (tx) => {
    const actor = await miRol(tx, ctx, organizacionId)
    const m = await tx.membresia.findFirst({ where: { id: membresiaId, organizacionId } })
    if (!m) throw new EquipoError("Miembro no encontrado", 404)
    const actual = normalizarRolOrg(m.rol)
    const propio = m.usuarioId === ctx.userId
    if (!propio && !puedeGestionar(actor, actual, null)) throw new EquipoError(esGestor(actor) ? "Solo un propietario puede quitar a administradores o propietarios" : "Solo un propietario o administrador puede quitar miembros", 403)
    await asegurarPropietario(tx, organizacionId, m.id, actual === "propietario")
    await tx.membresia.delete({ where: { id: m.id } })
    await auditar(tx, ctx, organizacionId, "membresias", m.id, "DELETE", { usuarioId: m.usuarioId, rol: actual, salio: propio })
    return { id: m.id }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

/** Impide quedar sin ningún propietario activo. */
async function asegurarPropietario(tx: Prisma.TransactionClient, organizacionId: string, membresiaId: string, afectaPropietario: boolean) {
  if (!afectaPropietario) return
  const otros = await tx.membresia.count({ where: { organizacionId, rol: "propietario", esActivo: true, id: { not: membresiaId }, usuario: { esActivo: true } } })
  if (!otros) throw new EquipoError("La organización tiene que tener al menos un propietario. Nombrá a otro propietario antes.", 409)
}

export async function renombrarOrganizacion(ctx: AuthContext, organizacionId: string, raw: unknown) {
  const { nombre } = z.object({ nombre: z.string().trim().min(2, "El nombre es muy corto").max(120) }).strict().parse(raw)
  return prisma.$transaction(async (tx) => {
    await exigirGestor(tx, ctx, organizacionId)
    const org = await tx.organizacion.update({ where: { id: organizacionId }, data: { nombre }, select: { id: true, nombre: true } })
    await auditar(tx, ctx, organizacionId, "organizaciones", organizacionId, "UPDATE", { nombre })
    return org
  })
}

// ------------------------------------------------------------
// Invitaciones
// ------------------------------------------------------------

function textoInvitacion(o: { invitador: string; organizacion: string; rol: RolOrg; enlace: string; mensaje: string | null }) {
  return [
    `${o.invitador} te invitó a sumarte a «${o.organizacion}» en AgroMonitor como ${ROL_INFO[o.rol].label.toLowerCase()}.`,
    o.mensaje ? `\n"${o.mensaje}"\n` : "",
    `Aceptá la invitación acá (vence en ${DIAS_VIGENCIA} días): ${o.enlace}`,
  ].join("\n")
}

export async function invitar(ctx: AuthContext, organizacionId: string, raw: unknown, origen: string) {
  const v = invitacionSchema.parse(raw)
  const token = nuevoToken()
  const r = await prisma.$transaction(async (tx) => {
    const actor = await exigirGestor(tx, ctx, organizacionId)
    if (!puedeGestionar(actor, null, v.rol)) throw new EquipoError("No podés invitar con ese rol", 403)
    const campos = await validarAcceso(tx, organizacionId, v.rol, v.accesoTotal, v.establecimientoIds)
    const existente = await tx.usuario.findFirst({ where: { email: { equals: v.email, mode: "insensitive" } }, select: { id: true } })
    if (existente && await tx.membresia.findUnique({ where: { usuarioId_organizacionId: { usuarioId: existente.id, organizacionId } } })) {
      throw new EquipoError("Esa persona ya es parte de la organización", 409)
    }
    // Reemplaza una invitación pendiente anterior al mismo email
    await tx.invitacion.updateMany({ where: { organizacionId, estado: "pendiente", email: { equals: v.email, mode: "insensitive" } }, data: { estado: "revocada" } })
    const inv = await tx.invitacion.create({
      data: { organizacionId, email: v.email, rol: v.rol, accesoTotal: v.accesoTotal, establecimientoIds: campos, mensaje: v.mensaje, tokenHash: hashToken(token), expiraAt: venceEn(), invitadoPorId: ctx.userId },
      include: { organizacion: { select: { nombre: true } }, invitadoPor: { select: { nombre: true, apellido: true } } },
    })
    const enlace = `${origen}/invitacion/${token}`
    // Si ya tiene cuenta, se le avisa dentro de la app (sin el enlace: el token solo viaja por el canal que elija quien invita)
    if (existente) await tx.notificacion.create({ data: { usuarioId: existente.id, tipo: "invitacion", titulo: `Invitación a ${inv.organizacion.nombre}`, mensaje: `Te invitaron como ${ROL_INFO[v.rol].label.toLowerCase()}. Abrí el enlace que te compartieron para aceptarla.`, url: "/configuracion/cuenta" } })
    await auditar(tx, ctx, organizacionId, "invitaciones", inv.id, "INSERT", { email: v.email, rol: v.rol, accesoTotal: v.accesoTotal, establecimientoIds: campos })
    return { inv, enlace, tieneCuenta: !!existente }
  })
  const texto = textoInvitacion({ invitador: `${r.inv.invitadoPor.nombre} ${r.inv.invitadoPor.apellido}`.trim(), organizacion: r.inv.organizacion.nombre, rol: v.rol, enlace: r.enlace, mensaje: v.mensaje })
  const { enviado } = await enviarCorreo({ para: v.email, asunto: `Invitación a ${r.inv.organizacion.nombre} en AgroMonitor`, texto })
  return { id: r.inv.id, enlace: r.enlace, texto, emailEnviado: enviado, tieneCuenta: r.tieneCuenta, expiraAt: r.inv.expiraAt }
}

export async function revocarInvitacion(ctx: AuthContext, organizacionId: string, invitacionId: string) {
  return prisma.$transaction(async (tx) => {
    await exigirGestor(tx, ctx, organizacionId)
    const r = await tx.invitacion.updateMany({ where: { id: invitacionId, organizacionId, estado: "pendiente" }, data: { estado: "revocada" } })
    if (!r.count) throw new EquipoError("La invitación ya no está pendiente", 404)
    await auditar(tx, ctx, organizacionId, "invitaciones", invitacionId, "UPDATE", { estado: "revocada" })
    return { id: invitacionId }
  })
}

/** Nuevo enlace (el anterior deja de servir) y 7 días más de vigencia. */
export async function regenerarInvitacion(ctx: AuthContext, organizacionId: string, invitacionId: string, origen: string) {
  const token = nuevoToken()
  const inv = await prisma.$transaction(async (tx) => {
    await exigirGestor(tx, ctx, organizacionId)
    const r = await tx.invitacion.updateMany({ where: { id: invitacionId, organizacionId, estado: "pendiente" }, data: { tokenHash: hashToken(token), expiraAt: venceEn() } })
    if (!r.count) throw new EquipoError("La invitación ya no está pendiente", 404)
    return tx.invitacion.findUniqueOrThrow({ where: { id: invitacionId }, include: { organizacion: { select: { nombre: true } }, invitadoPor: { select: { nombre: true, apellido: true } } } })
  })
  const enlace = `${origen}/invitacion/${token}`
  const texto = textoInvitacion({ invitador: `${inv.invitadoPor.nombre} ${inv.invitadoPor.apellido}`.trim(), organizacion: inv.organizacion.nombre, rol: normalizarRolOrg(inv.rol), enlace, mensaje: inv.mensaje })
  const { enviado } = await enviarCorreo({ para: inv.email, asunto: `Invitación a ${inv.organizacion.nombre} en AgroMonitor`, texto })
  return { id: inv.id, enlace, texto, emailEnviado: enviado, expiraAt: inv.expiraAt }
}

/** Invitación vigente por token (o error con el motivo). */
async function invitacionVigente(db: Prisma.TransactionClient, token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw new EquipoError("El enlace de invitación no es válido", 404)
  const inv = await db.invitacion.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organizacion: { select: { id: true, nombre: true, esActivo: true } }, invitadoPor: { select: { nombre: true, apellido: true } } },
  })
  if (!inv || !inv.organizacion.esActivo) throw new EquipoError("El enlace de invitación no es válido", 404)
  if (inv.estado === "aceptada") throw new EquipoError("Esta invitación ya fue aceptada. Iniciá sesión para entrar.", 410)
  if (inv.estado === "revocada") throw new EquipoError("Esta invitación fue anulada. Pedí una nueva a quien te invitó.", 410)
  if (inv.expiraAt < new Date()) throw new EquipoError("La invitación venció. Pedí una nueva a quien te invitó.", 410)
  return inv
}

/** Datos públicos para la pantalla de la invitación (solo para quien tiene el enlace). */
export async function verInvitacion(token: string) {
  const inv = await invitacionVigente(prisma, token)
  const tieneCuenta = !!await prisma.usuario.findFirst({ where: { email: { equals: inv.email, mode: "insensitive" } }, select: { id: true } })
  const campos = inv.accesoTotal ? [] : await prisma.establecimiento.findMany({ where: { id: { in: inv.establecimientoIds } }, select: { nombre: true } })
  return {
    organizacion: inv.organizacion.nombre,
    email: inv.email,
    rol: normalizarRolOrg(inv.rol),
    invitadoPor: `${inv.invitadoPor.nombre} ${inv.invitadoPor.apellido}`.trim(),
    mensaje: inv.mensaje,
    campos: inv.accesoTotal ? null : campos.map((c) => c.nombre),
    expiraAt: inv.expiraAt,
    tieneCuenta,
  }
}

async function crearMembresia(tx: Prisma.TransactionClient, inv: Awaited<ReturnType<typeof invitacionVigente>>, usuarioId: string) {
  const previa = await tx.membresia.findUnique({ where: { usuarioId_organizacionId: { usuarioId, organizacionId: inv.organizacionId } } })
  if (previa?.esActivo) throw new EquipoError("Ya sos parte de esta organización", 409)
  const campos = inv.accesoTotal ? [] : (await tx.establecimiento.findMany({ where: { id: { in: inv.establecimientoIds }, organizacionId: inv.organizacionId }, select: { id: true } })).map((e) => e.id)
  const accesoTotal = inv.accesoTotal || !campos.length
  // Reingreso de alguien que había sido desactivado: se reactiva con el rol nuevo
  const m = previa
    ? await tx.membresia.update({ where: { id: previa.id }, data: { rol: inv.rol, esActivo: true, accesoTotal, invitadoPorId: inv.invitadoPorId } })
    : await tx.membresia.create({ data: { usuarioId, organizacionId: inv.organizacionId, rol: inv.rol, accesoTotal, invitadoPorId: inv.invitadoPorId } })
  await tx.membresiaEstablecimiento.deleteMany({ where: { membresiaId: m.id } })
  if (!accesoTotal) await tx.membresiaEstablecimiento.createMany({ data: campos.map((establecimientoId) => ({ membresiaId: m.id, establecimientoId })) })
  await tx.invitacion.update({ where: { id: inv.id }, data: { estado: "aceptada", aceptadaPorId: usuarioId, aceptadaAt: new Date() } })
  await tx.auditLog.create({ data: { usuarioId, organizacionId: inv.organizacionId, tabla: "membresias", rowPk: m.id, accion: "INSERT", detalle: { invitacionId: inv.id, rol: inv.rol } } })
  return m
}

/** Aceptar estando logueado: la cuenta tiene que ser la del email invitado. */
export async function aceptarInvitacion(token: string, usuario: { id: string; email: string }) {
  return prisma.$transaction(async (tx) => {
    const inv = await invitacionVigente(tx, token)
    if (normalizarEmail(usuario.email) !== normalizarEmail(inv.email)) {
      throw new EquipoError(`La invitación es para ${inv.email}. Cerrá sesión e ingresá con esa cuenta.`, 403)
    }
    const m = await crearMembresia(tx, inv, usuario.id)
    return { organizacionId: inv.organizacionId, organizacion: inv.organizacion.nombre, membresiaId: m.id }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

/** Crear la cuenta desde la invitación: sin organización propia, directo al espacio compartido. */
export async function registrarConInvitacion(token: string, raw: unknown) {
  const v = registroInvitacionSchema.parse(raw)
  const passwordHash = await bcrypt.hash(v.password, 12)
  return prisma.$transaction(async (tx) => {
    const inv = await invitacionVigente(tx, token)
    const email = normalizarEmail(inv.email)
    if (await tx.usuario.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })) {
      throw new EquipoError("Ya existe una cuenta con ese email: iniciá sesión para aceptar la invitación", 409)
    }
    const usuario = await tx.usuario.create({ data: { email, passwordHash, nombre: v.nombre, apellido: v.apellido, rol: "usuario", esActivo: true, emailVerificado: new Date() } })
    await crearMembresia(tx, inv, usuario.id)
    return { email, organizacionId: inv.organizacionId, organizacion: inv.organizacion.nombre }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

/**
 * Invitaciones pendientes dirigidas al email del usuario logueado. Aceptarlas sin el
 * enlace exige el email verificado (una cuenta registrada con un email ajeno no las toma).
 */
export async function misInvitaciones(usuario: { email: string }) {
  const invs = await prisma.invitacion.findMany({
    where: { estado: "pendiente", expiraAt: { gt: new Date() }, email: { equals: normalizarEmail(usuario.email), mode: "insensitive" }, organizacion: { esActivo: true } },
    include: { organizacion: { select: { nombre: true } }, invitadoPor: { select: { nombre: true, apellido: true } } },
    orderBy: { createdAt: "desc" },
  })
  return invs.map((i) => ({ id: i.id, organizacion: i.organizacion.nombre, rol: normalizarRolOrg(i.rol), invitadoPor: `${i.invitadoPor.nombre} ${i.invitadoPor.apellido}`.trim(), expiraAt: i.expiraAt }))
}

/** Aceptar una invitación propia por id (desde «Mi cuenta», sin el enlace). */
export async function aceptarInvitacionPorId(invitacionId: string, usuario: { id: string; email: string }) {
  return prisma.$transaction(async (tx) => {
    const u = await tx.usuario.findUnique({ where: { id: usuario.id }, select: { emailVerificado: true } })
    if (!u?.emailVerificado) throw new EquipoError("Para aceptar sin el enlace tu email tiene que estar verificado. Abrí el enlace de la invitación que te compartieron.", 403)
    const inv = await tx.invitacion.findFirst({ where: { id: invitacionId, estado: "pendiente", email: { equals: normalizarEmail(usuario.email), mode: "insensitive" } }, include: { organizacion: { select: { id: true, nombre: true, esActivo: true } }, invitadoPor: { select: { nombre: true, apellido: true } } } })
    if (!inv || !inv.organizacion.esActivo) throw new EquipoError("Invitación no encontrada", 404)
    if (inv.expiraAt < new Date()) throw new EquipoError("La invitación venció. Pedí una nueva.", 410)
    const m = await crearMembresia(tx, inv, usuario.id)
    return { organizacionId: inv.organizacionId, organizacion: inv.organizacion.nombre, membresiaId: m.id }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export function respuestaEquipo(error: unknown) {
  if (error instanceof EquipoError) return { body: { error: error.message }, status: error.status }
  if (error instanceof z.ZodError) return { body: { error: error.issues[0]?.message ?? "Datos inválidos", fieldErrors: error.flatten().fieldErrors }, status: 400 }
  if (error instanceof SyntaxError) return { body: { error: "Solicitud inválida" }, status: 400 }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { body: { error: "Ya hay una invitación pendiente para ese email" }, status: 409 }
    if (error.code === "P2034") return { body: { error: "Otro cambio se hizo al mismo tiempo. Reintentá." }, status: 409 }
  }
  return null
}
