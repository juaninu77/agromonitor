// Eventos de hacienda propuestos por WhatsApp. El asistente nunca escribe: arma un borrador
// (herramientas/hacienda.ts) y quien lo mandó lo confirma con un botón. Si su rol en el campo
// alcanza (APLICA_DIRECTO) se aplica con el mismo servicio que usa la web; si no, queda «por
// validar» hasta que un administrador o encargado de ESE campo lo apruebe (con sus permisos,
// y vuelven a correr todas las validaciones) o lo rechace. Nunca valida el administrador de
// la plataforma por serlo.

import { Prisma } from "@prisma/client"
import { z } from "zod"
import type { AppRole, AuthContext } from "@/lib/api/with-auth"
import { logAudit } from "@/lib/api/audit-log"
import { prisma } from "@/lib/prisma"
import { BajaError, registrarBaja } from "@/lib/ganado/baja"
import { EventoGanadoError, moverDeLote, registrarPesadas } from "@/lib/ganado/eventos"
import { InventarioError } from "@/lib/inventario/service"
import { ReproduccionError, registrarParicion, registrarServicio } from "@/lib/reproduccion/service"
import { tactoMasivo } from "@/lib/reproduccion/grupos"
import { cargaRapidaCelos } from "@/lib/reproduccion/celo"
import { SanidadError, aplicarMasivo, contarDestino } from "@/lib/sanidad/service"
import { bajaSchema, movimientoLoteSchema, pesadaSchema } from "@/lib/validations/eventos-schema"
import { enviarTexto } from "./cliente"

export const ACCIONES = ["sanidad", "pesada", "movimiento", "baja", "servicio", "tacto", "parto", "celo"] as const
export type AccionBorrador = (typeof ACCIONES)[number]

export const ETIQUETA_ACCION: Record<AccionBorrador, string> = {
  sanidad: "Sanidad", pesada: "Pesadas", movimiento: "Cambio de grupo", baja: "Baja",
  servicio: "Servicio", tacto: "Tacto", parto: "Parto", celo: "Celos",
}

/** Roles del campo con los que lo confirmado se aplica directo; con otro rol queda por validar. */
export const APLICA_DIRECTO: Record<AccionBorrador, readonly AppRole[]> = {
  sanidad: ["admin", "encargado", "vet"],
  tacto: ["admin", "encargado", "vet"],
  servicio: ["admin", "encargado", "vet"],
  parto: ["admin", "encargado", "vet"],
  celo: ["admin", "encargado", "vet"],
  pesada: ["admin", "encargado"],
  movimiento: ["admin", "encargado"],
  baja: ["admin", "encargado"],
}

/** Quiénes validan lo que llega por WhatsApp: administradores y encargados de ese campo. */
export const ROLES_VALIDADOR = ["admin", "encargado"] as const satisfies readonly AppRole[]

export const MINUTOS_PENDIENTE = 30
export const DIAS_POR_VALIDAR = 7
export const URL_BANDEJA = "/whatsapp"

export class BorradorError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export const aplicaDirecto = (accion: string, rol: AppRole | undefined) =>
  !!rol && (APLICA_DIRECTO[accion as AccionBorrador] ?? []).includes(rol)

export async function crearBorrador(d: {
  id: string
  vinculoId: string | null
  usuarioId: string
  establecimientoId: string
  accion: AccionBorrador
  payload: Record<string, unknown>
  resumen: string
  origen?: string | null
}) {
  return prisma.whatsappBorrador.create({
    data: { ...d, payload: d.payload as Prisma.InputJsonValue, origen: d.origen?.slice(0, 2000) ?? null, expira: new Date(Date.now() + MINUTOS_PENDIENTE * 60_000) },
    select: { id: true, resumen: true },
  })
}

// ---------------------------------------------------------------- ejecución

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Corre el servicio real del evento con los permisos de `ctx` (quien confirma o aprueba). */
export async function ejecutarAccion(ctx: AuthContext, accion: string, payload: Record<string, unknown>): Promise<{ texto: string; resultado: unknown }> {
  switch (accion as AccionBorrador) {
    case "sanidad": {
      const r = await aplicarMasivo(ctx, payload)
      return { texto: `Sanidad registrada a ${plural(r.cantidad, "animal", "animales")}.`, resultado: { operacionId: r.operacionId, cantidad: r.cantidad } }
    }
    case "pesada": {
      const pesadas = z.array(z.unknown()).parse(payload.pesadas).map((p) => pesadaSchema.parse(p))
      const r = await registrarPesadas(ctx, pesadas)
      return { texto: `${plural(r.length, "pesada registrada", "pesadas registradas")}.`, resultado: { ids: r.map((p) => p.id) } }
    }
    case "movimiento": {
      const r = await moverDeLote(ctx, movimientoLoteSchema.parse(payload))
      return { texto: `${plural(r.moved, "animal movido", "animales movidos")} a «${r.loteDestino}»${r.omitidos ? ` (${r.omitidos} ya estaban)` : ""}.`, resultado: r }
    }
    case "baja": {
      const input = bajaSchema.parse(payload)
      const { baja, animal } = await registrarBaja(input, { establecimientoIds: ctx.establecimientoIdsConRol(["admin", "encargado"]), organizacionIds: ctx.organizacionIds, userId: ctx.userId })
      await logAudit({
        userId: ctx.userId, tabla: "evt_baja", rowPk: baja.id, accion: "INSERT",
        detalle: { animalId: input.animalId, motivo: input.motivo, estadoVital: animal.estadoVital, precioTotal: input.precioTotal ?? null, origen: "whatsapp" },
        organizacionId: animal.establecimientoId ? ctx.organizacionDeEstablecimiento[animal.establecimientoId] : null,
      })
      return { texto: `Baja registrada (${animal.caravanaVisual ?? "animal"}).`, resultado: { bajaId: baja.id } }
    }
    case "servicio": {
      const r = await registrarServicio(ctx, payload)
      return { texto: "Servicio registrado.", resultado: { servicioId: r.id } }
    }
    case "tacto": {
      const r = await tactoMasivo(ctx, payload)
      return { texto: `${plural(r.cantidad, "tacto registrado", "tactos registrados")}${r.prenadas ? ` (${plural(r.prenadas, "preñada", "preñadas")})` : ""}.`, resultado: { operacionId: r.operacionId, cantidad: r.cantidad } }
    }
    case "parto": {
      const r = await registrarParicion(ctx, payload)
      const vivas = r.filas.filter((f) => f.criaId).length
      return { texto: `Parto registrado${vivas ? ` (${plural(vivas, "cría dada de alta", "crías dadas de alta")})` : ""}.`, resultado: { partoId: r.partoId, crias: r.filas.map((f) => f.criaId).filter(Boolean) } }
    }
    case "celo": {
      const r = await cargaRapidaCelos(ctx, payload)
      const omitidos = r.omitidos.length ? `\nNo se cargaron: ${r.omitidos.map((o) => `${o.identificador} (${o.motivo})`).join(", ")}` : ""
      return { texto: `${plural(r.registrados, "celo registrado", "celos registrados")}.${omitidos}`, resultado: { registrados: r.registrados } }
    }
    default:
      throw new BorradorError("Acción desconocida")
  }
}

/** Avisos del dominio que se pueden aceptar y volver a intentar (como en la web). */
const CONFIRMABLES: Record<string, (p: Record<string, unknown>) => Record<string, unknown>> = {
  bajo_retiro_confirmar: (p) => ({ ...p, aceptarRetiro: true }),
  lote_vencido: (p) => ({ ...p, aceptarVencido: true }),
  prenada: (p) => ({ ...p, aceptarPrenada: true }),
  mellizo: (p) => ({ ...p, confirmarMellizo: true }),
  stock: (p) => ({ ...p, descontarPorAnimal: null }),
}

const PREGUNTA: Record<string, string> = {
  bajo_retiro_confirmar: "¿Confirmás que la venta NO es a faena?",
  lote_vencido: "¿Lo registro igual con el lote vencido?",
  prenada: "¿La registro igual?",
  mellizo: "¿Es un mellizo? Si confirmás, se registra como otro parto del mismo día.",
  stock: "¿Lo registro igual SIN descontar stock?",
  destino_cambio: "¿Lo registro con la cantidad nueva?",
}

/** Error conocido del dominio (con mensaje para el usuario) o null si es un error interno. */
function errorConocido(e: unknown): { message: string; status: number; codigo?: string } | null {
  if (e instanceof SanidadError || e instanceof ReproduccionError || e instanceof BajaError || e instanceof EventoGanadoError || e instanceof BorradorError) {
    return { message: e.message, status: e.status, codigo: (e as { codigo?: string }).codigo }
  }
  if (e instanceof InventarioError) return { message: e.message, status: e.status, codigo: e.codigo ?? (e.status === 409 ? "stock" : undefined) }
  if (e instanceof z.ZodError) return { message: e.issues[0]?.message ?? "Datos inválidos", status: 400 }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") return { message: "Otro movimiento se registró al mismo tiempo. Probá de nuevo.", status: 409, codigo: "reintentar" }
  return null
}

export type ResultadoBorrador =
  | { tipo: "aplicado" | "por_validar" | "rechazado" | "error" | "nada"; texto: string }
  /** Hace falta aceptar un aviso: el borrador vuelve a su estado y se pregunta de nuevo */
  | { tipo: "confirmar"; texto: string }

type FilaBorrador = NonNullable<Awaited<ReturnType<typeof prisma.whatsappBorrador.findUnique>>>

/** Aplica un borrador ya reservado (estado «procesando»). `validadorId`: quien lo aprobó. */
async function aplicar(ctx: AuthContext, b: FilaBorrador, previo: "pendiente" | "por_validar", validadorId: string | null): Promise<ResultadoBorrador> {
  const payload = (b.payload ?? {}) as Record<string, unknown>
  try {
    const r = await ejecutarAccion(ctx, b.accion, payload)
    await prisma.whatsappBorrador.update({
      where: { id: b.id },
      data: { estado: "aplicado", resultado: JSON.parse(JSON.stringify(r.resultado ?? null)) as Prisma.InputJsonValue, error: null, ...(validadorId ? { validadoPorId: validadorId, validadoAt: new Date() } : {}) },
    })
    await logAudit({
      userId: ctx.userId, tabla: "whatsapp_borradores", rowPk: b.id, accion: "UPDATE",
      detalle: { estado: "aplicado", accion: b.accion, autorId: b.usuarioId, validadoPorId: validadorId, resultado: r.resultado as Record<string, unknown> },
      organizacionId: ctx.organizacionDeEstablecimiento[b.establecimientoId] ?? null,
    })
    return { tipo: "aplicado", texto: `✅ ${r.texto}` }
  } catch (e) {
    const err = errorConocido(e)
    if (!err) {
      // Los servicios son transaccionales: un error interno no deja nada a medias y se puede reintentar
      await prisma.whatsappBorrador.update({ where: { id: b.id }, data: { estado: previo } })
      throw e
    }
    if (err.codigo === "destino_cambio") {
      const { cantidad } = await contarDestino(ctx, payload.destino)
      await prisma.whatsappBorrador.update({ where: { id: b.id }, data: { estado: previo, payload: { ...payload, animalesEsperados: cantidad } as Prisma.InputJsonValue } })
      return { tipo: "confirmar", texto: `⚠️ ${err.message}\n${PREGUNTA.destino_cambio}` }
    }
    if (err.codigo === "reintentar") {
      await prisma.whatsappBorrador.update({ where: { id: b.id }, data: { estado: previo } })
      return { tipo: "confirmar", texto: `⚠️ ${err.message}` }
    }
    const ajustar = err.codigo ? CONFIRMABLES[err.codigo] : undefined
    if (ajustar) {
      await prisma.whatsappBorrador.update({ where: { id: b.id }, data: { estado: previo, payload: ajustar(payload) as Prisma.InputJsonValue } })
      return { tipo: "confirmar", texto: `⚠️ ${err.message}\n${PREGUNTA[err.codigo!]}` }
    }
    await prisma.whatsappBorrador.update({ where: { id: b.id }, data: { estado: "error", error: err.message.slice(0, 500), ...(validadorId ? { validadoPorId: validadorId, validadoAt: new Date() } : {}) } })
    return { tipo: "error", texto: `❌ No se pudo registrar: ${err.message}` }
  }
}

const TEXTO_ESTADO: Record<string, string> = {
  aplicado: "Eso ya quedó registrado.",
  procesando: "Lo estoy registrando, esperá un momento.",
  por_validar: "Eso ya está esperando la validación del encargado.",
  cancelado: "Eso ya estaba cancelado.",
  rechazado: "Eso fue rechazado.",
  error: "Eso no se pudo registrar. Mandalo de nuevo si querés.",
}

/** Botón «Confirmar» de quien lo mandó. Se reserva con un update condicional: un doble toque no duplica. */
export async function confirmarBorrador(ctx: AuthContext, vinculoId: string, id: string): Promise<ResultadoBorrador> {
  const reservado = await prisma.whatsappBorrador.updateMany({ where: { id, vinculoId, estado: "pendiente", expira: { gt: new Date() } }, data: { estado: "procesando" } })
  const b = await prisma.whatsappBorrador.findFirst({ where: { id, vinculoId } })
  if (!b) return { tipo: "nada", texto: "No encontré eso para confirmar." }
  if (!reservado.count) {
    if (b.estado === "pendiente") {
      await prisma.whatsappBorrador.update({ where: { id }, data: { estado: "vencido" } })
      return { tipo: "nada", texto: `Pasaron más de ${MINUTOS_PENDIENTE} minutos y eso venció. Mandámelo de nuevo.` }
    }
    return { tipo: "nada", texto: TEXTO_ESTADO[b.estado] ?? "Eso ya no está pendiente." }
  }
  if (!ctx.establecimientoIds.includes(b.establecimientoId)) {
    await prisma.whatsappBorrador.update({ where: { id }, data: { estado: "error", error: "Sin acceso al campo" } })
    return { tipo: "error", texto: "Ya no tenés acceso a ese campo." }
  }
  if (!aplicaDirecto(b.accion, ctx.rolPorEstablecimiento[b.establecimientoId])) {
    await prisma.whatsappBorrador.update({ where: { id }, data: { estado: "por_validar", expira: new Date(Date.now() + DIAS_POR_VALIDAR * 86_400_000) } })
    await avisarValidadores(b)
    return { tipo: "por_validar", texto: "📨 Listo, lo mandé a validar. Cuando un encargado o administrador del campo lo revise, te aviso por acá." }
  }
  return aplicar(ctx, b, "pendiente", null)
}

export async function cancelarBorrador(vinculoId: string, id: string): Promise<ResultadoBorrador> {
  const r = await prisma.whatsappBorrador.updateMany({ where: { id, vinculoId, estado: "pendiente" }, data: { estado: "cancelado" } })
  return { tipo: "nada", texto: r.count ? "Listo, lo cancelé. No se registró nada." : "Eso ya no estaba pendiente." }
}

/** Reserva un borrador por validar de un campo donde `ctx` es administrador o encargado. */
async function reservarParaValidar(ctx: AuthContext, id: string) {
  const campos = ctx.establecimientoIdsConRol([...ROLES_VALIDADOR])
  const r = await prisma.whatsappBorrador.updateMany({
    where: { id, estado: "por_validar", expira: { gt: new Date() }, establecimientoId: { in: campos } },
    data: { estado: "procesando" },
  })
  const b = await prisma.whatsappBorrador.findFirst({ where: { id, establecimientoId: { in: campos } } })
  if (!b) throw new BorradorError("Carga no encontrada", 404)
  if (!r.count) throw new BorradorError(b.estado === "por_validar" ? "Venció: pasaron más de 7 días" : "Esa carga ya fue revisada", 409)
  return b
}

/** «Aprobar» de la bandeja: se aplica con los permisos de quien aprueba. */
export async function aprobarBorrador(ctx: AuthContext, id: string): Promise<ResultadoBorrador> {
  const b = await reservarParaValidar(ctx, id)
  const r = await aplicar(ctx, b, "por_validar", ctx.userId)
  if (r.tipo === "aplicado" || r.tipo === "error") await avisarAutor(b, ctx.userId, r.tipo === "aplicado" ? `fue aprobada y quedó registrada. ${r.texto}` : `fue aprobada pero no se pudo registrar: ${r.texto.replace(/^❌ No se pudo registrar: /, "")}`)
  return r
}

export async function rechazarBorrador(ctx: AuthContext, id: string, motivo: string): Promise<ResultadoBorrador> {
  const b = await reservarParaValidar(ctx, id)
  await prisma.whatsappBorrador.update({ where: { id }, data: { estado: "rechazado", motivoRechazo: motivo, validadoPorId: ctx.userId, validadoAt: new Date() } })
  await logAudit({
    userId: ctx.userId, tabla: "whatsapp_borradores", rowPk: id, accion: "UPDATE",
    detalle: { estado: "rechazado", accion: b.accion, autorId: b.usuarioId, motivo },
    organizacionId: ctx.organizacionDeEstablecimiento[b.establecimientoId] ?? null,
  })
  await avisarAutor(b, ctx.userId, `fue rechazada. Motivo: ${motivo}`)
  return { tipo: "rechazado", texto: "Carga rechazada." }
}

/** Marca como vencidos los borradores sin respuesta (se llama al listar). */
export function vencerBorradores() {
  return prisma.whatsappBorrador.updateMany({ where: { estado: { in: ["pendiente", "por_validar"] }, expira: { lte: new Date() } }, data: { estado: "vencido" } })
}

// ---------------------------------------------------------------- avisos

const ROLES_MEMBRESIA_VALIDADOR = ["propietario", "admin", "administrador", "encargado"]

/** Usuarios que validan en un campo: admin/encargado activos de su organización con acceso a ese campo. */
export async function validadoresDelCampo(establecimientoId: string): Promise<string[]> {
  const est = await prisma.establecimiento.findUnique({ where: { id: establecimientoId }, select: { organizacionId: true } })
  if (!est?.organizacionId) return []
  const miembros = await prisma.membresia.findMany({
    where: {
      organizacionId: est.organizacionId, esActivo: true, rol: { in: ROLES_MEMBRESIA_VALIDADOR }, usuario: { esActivo: true },
      // Igual que contextoDeUsuario: propietarios y administradores ven todos los campos
      OR: [{ accesoTotal: true }, { rol: { not: "encargado" } }, { establecimientosAcceso: { some: { establecimientoId } } }],
    },
    select: { usuarioId: true },
  })
  return [...new Set(miembros.map((m) => m.usuarioId))]
}

/** Notificación en la app (no por WhatsApp: fuera de la ventana de 24 h Meta exige plantillas). */
async function avisarValidadores(b: FilaBorrador) {
  try {
    const [usuarios, autor, campo] = await Promise.all([
      validadoresDelCampo(b.establecimientoId),
      prisma.usuario.findUnique({ where: { id: b.usuarioId }, select: { nombre: true, apellido: true } }),
      prisma.establecimiento.findUnique({ where: { id: b.establecimientoId }, select: { nombre: true } }),
    ])
    // Una sola notificación sin leer por persona: la bandeja muestra todas las cargas
    const yaAvisados = new Set((await prisma.notificacion.findMany({ where: { usuarioId: { in: usuarios }, tipo: "whatsapp_validar", leida: false }, select: { usuarioId: true } })).map((n) => n.usuarioId))
    const data = usuarios.filter((u) => !yaAvisados.has(u)).map((usuarioId) => ({
      usuarioId, tipo: "whatsapp_validar", url: URL_BANDEJA,
      titulo: "Hay cargas de WhatsApp para validar",
      mensaje: `${[autor?.nombre, autor?.apellido].filter(Boolean).join(" ") || "Un operario"} mandó ${ETIQUETA_ACCION[b.accion as AccionBorrador]?.toLowerCase() ?? "una carga"} en ${campo?.nombre ?? "el campo"}.`,
    }))
    if (data.length) await prisma.notificacion.createMany({ data })
  } catch (e) {
    console.error("[whatsapp] No se pudo avisar a los validadores", e)
  }
}

/** Le cuenta a quien lo mandó qué pasó: en la app y, si escribió en las últimas 24 h, por WhatsApp. */
async function avisarAutor(b: FilaBorrador, validadorId: string, que: string) {
  try {
    const validador = await prisma.usuario.findUnique({ where: { id: validadorId }, select: { nombre: true } })
    const titulo = b.resumen.split("\n")[0].replace(/\*/g, "")
    const texto = `Tu carga «${titulo}» ${que}${validador?.nombre ? ` (revisó ${validador.nombre})` : ""}`
    await prisma.notificacion.create({ data: { usuarioId: b.usuarioId, tipo: "whatsapp_resultado", titulo: "Revisaron tu carga de WhatsApp", mensaje: texto.slice(0, 500), url: URL_BANDEJA } })
    const vinculo = await prisma.whatsappVinculo.findUnique({ where: { usuarioId: b.usuarioId }, select: { id: true, waId: true } })
    if (!vinculo?.waId) return
    const ventana = await prisma.whatsappMensaje.count({ where: { vinculoId: vinculo.id, sentido: "entrante", createdAt: { gte: new Date(Date.now() - 23.5 * 3_600_000) } } })
    if (!ventana) return
    const wamid = await enviarTexto(vinculo.waId, texto)
    await prisma.whatsappMensaje.create({ data: { wamid, vinculoId: vinculo.id, waId: vinculo.waId, sentido: "saliente", tipo: "texto", texto, estado: "enviado" } })
  } catch (e) {
    console.error("[whatsapp] No se pudo avisar al autor de la carga", e)
  }
}

// ---------------------------------------------------------------- bandeja

const SELECT_BANDEJA = {
  id: true, accion: true, resumen: true, origen: true, estado: true, error: true, motivoRechazo: true,
  createdAt: true, expira: true, validadoAt: true, establecimientoId: true, usuarioId: true,
  usuario: { select: { nombre: true, apellido: true } },
  validadoPor: { select: { nombre: true, apellido: true } },
  establecimiento: { select: { nombre: true } },
} satisfies Prisma.WhatsappBorradorSelect

type FilaBandeja = Prisma.WhatsappBorradorGetPayload<{ select: typeof SELECT_BANDEJA }>

const nombre = (u: { nombre: string | null; apellido: string | null } | null) => (u ? [u.nombre, u.apellido].filter(Boolean).join(" ") || "Sin nombre" : null)

const serializar = (b: FilaBandeja) => ({
  id: b.id, accion: b.accion, etiqueta: ETIQUETA_ACCION[b.accion as AccionBorrador] ?? b.accion, resumen: b.resumen, origen: b.origen,
  estado: b.estado, error: b.error, motivoRechazo: b.motivoRechazo, createdAt: b.createdAt.toISOString(), expira: b.expira.toISOString(),
  validadoAt: b.validadoAt?.toISOString() ?? null, autor: nombre(b.usuario), validadoPor: nombre(b.validadoPor),
  campo: b.establecimiento.nombre, establecimientoId: b.establecimientoId, propio: false,
})
export type CargaWhatsapp = ReturnType<typeof serializar>

/**
 * Bandeja: lo que espera validación en los campos donde el usuario es admin/encargado, y lo
 * revisado o mandado recientemente (de esos campos o propio).
 */
export async function bandejaWhatsapp(ctx: AuthContext) {
  await vencerBorradores()
  const campos = ctx.establecimientoIdsConRol([...ROLES_VALIDADOR])
  const [porValidar, recientes] = await Promise.all([
    campos.length
      ? prisma.whatsappBorrador.findMany({ where: { estado: "por_validar", establecimientoId: { in: campos } }, orderBy: { createdAt: "asc" }, take: 100, select: SELECT_BANDEJA })
      : [],
    prisma.whatsappBorrador.findMany({
      where: {
        estado: { in: ["por_validar", "aplicado", "rechazado", "error", "vencido"] },
        OR: [{ usuarioId: ctx.userId }, ...(campos.length ? [{ establecimientoId: { in: campos }, estado: { not: "por_validar" } }] : [])],
        createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
      },
      orderBy: { createdAt: "desc" }, take: 50, select: SELECT_BANDEJA,
    }),
  ])
  const marcar = (b: FilaBandeja) => ({ ...serializar(b), propio: b.usuarioId === ctx.userId })
  return { puedeValidar: campos.length > 0, porValidar: porValidar.map(marcar), recientes: recientes.map(marcar) }
}

/** Cantidad por validar en los campos del usuario (tarjeta del Panel). */
export async function contarPorValidar(ctx: AuthContext, establecimientoId?: string) {
  const campos = ctx.establecimientoIdsConRol([...ROLES_VALIDADOR]).filter((c) => !establecimientoId || c === establecimientoId)
  if (!campos.length) return 0
  return prisma.whatsappBorrador.count({ where: { estado: "por_validar", expira: { gt: new Date() }, establecimientoId: { in: campos } } })
}
