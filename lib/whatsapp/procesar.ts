// Procesa un mensaje entrante ya guardado (lo llama el webhook con after(), después
// de responderle 200 a Meta): vinculación, elección de campo, límite de mensajes y
// respuesta del asistente con los permisos del usuario.

import { contextoDeUsuario, type AuthContext } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { asistenteConfigurado, LIMITE_MENSAJES, LIMITE_SIN_VINCULAR } from "./config"
import { enviarLista, enviarTexto, marcarLeido } from "./cliente"
import { responderConsulta, type TurnoHistorial } from "./agente"
import { leerCodigo, vincularNumero } from "./vinculo"
import type { MensajeEntrante } from "./webhook"

const ETIQUETA_ROL: Record<string, string> = { admin: "administrador", encargado: "encargado", vet: "veterinario", operario: "operario" }

export const TEXTO_SIN_VINCULAR =
  "Hola 👋 Este número todavía no está vinculado a AgroMonitor.\n\n" +
  "Para usarlo, entrá a la app → *Configuración → Mi cuenta* → «Vincular WhatsApp» y mandá desde este teléfono el código que te aparece."

export const TEXTO_AYUDA =
  "Soy el asistente de AgroMonitor. Podés preguntarme, por ejemplo:\n" +
  "• ¿Cuánta ivermectina queda?\n• ¿Qué vacas paren este mes?\n• ¿Qué animales están en retiro?\n• Buscame la caravana 1234\n• ¿Qué tareas tengo pendientes?\n• ¿Cuánto gastamos este mes?\n\n" +
  "Escribí *campo* para cambiar de campo."

export const PREFIJO_CAMPO = "campo:"

/** Guarda el mensaje entrante; devuelve su id o null si ya estaba (reintento de Meta). */
export async function guardarEntrante(m: MensajeEntrante): Promise<string | null> {
  const r = await prisma.whatsappMensaje.createMany({
    data: [{ wamid: m.wamid, waId: m.waId, sentido: "entrante", tipo: m.tipo, texto: m.texto, respuestaId: m.respuestaId, mediaId: m.mediaId, createdAt: m.fecha }],
    skipDuplicates: true,
  })
  if (!r.count) return null
  const fila = await prisma.whatsappMensaje.findUnique({ where: { wamid: m.wamid }, select: { id: true } })
  return fila?.id ?? null
}

async function responder(waId: string, vinculoId: string | null, texto: string) {
  const wamid = await enviarTexto(waId, texto)
  await prisma.whatsappMensaje.create({ data: { wamid, vinculoId, waId, sentido: "saliente", tipo: "texto", texto, estado: "enviado" } })
}

async function contarEntrantes(where: { waId: string; vinculoId?: null }, minutos: number) {
  return prisma.whatsappMensaje.count({ where: { ...where, sentido: "entrante", createdAt: { gte: new Date(Date.now() - minutos * 60_000) } } })
}

async function ofrecerCampos(waId: string, vinculoId: string, campos: { id: string; nombre: string }[], texto: string) {
  await enviarLista(waId, texto, "Elegir campo", campos.map((c) => ({ id: `${PREFIJO_CAMPO}${c.id}`, titulo: c.nombre })))
  await prisma.whatsappMensaje.create({ data: { vinculoId, waId, sentido: "saliente", tipo: "lista", texto, estado: "enviado" } })
}

/** Últimos intercambios de texto de las últimas 24 h, para que el asistente tenga contexto. */
async function historial(vinculoId: string, antesDe: Date): Promise<TurnoHistorial[]> {
  const filas = await prisma.whatsappMensaje.findMany({
    where: { vinculoId, tipo: "texto", texto: { not: null }, estado: { in: ["procesado", "enviado"] }, createdAt: { gte: new Date(antesDe.getTime() - 86_400_000), lt: antesDe } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { sentido: true, texto: true },
  })
  return filas.reverse().map((f) => ({ rol: f.sentido === "entrante" ? "user" : "assistant", texto: f.texto! }))
}

export async function procesarMensaje(mensajeId: string): Promise<void> {
  const m = await prisma.whatsappMensaje.findUnique({ where: { id: mensajeId } })
  if (!m || m.sentido !== "entrante" || m.estado !== "recibido") return
  const { texto, respuestaId } = m
  const terminar = (estado: string, error?: string) => prisma.whatsappMensaje.update({ where: { id: m.id }, data: { estado, error: error ?? null } })

  try {
    // 1. Código de vinculación (desde un número nuevo o para mover el número a otra cuenta)
    const codigo = leerCodigo(texto)
    if (codigo) {
      if (await contarEntrantes({ waId: m.waId, vinculoId: null }, LIMITE_SIN_VINCULAR.minutos) > LIMITE_SIN_VINCULAR.cantidad) return void (await terminar("ignorado", "demasiados intentos"))
      const r = await vincularNumero(m.waId, codigo)
      if (!r.ok) {
        await responder(m.waId, null, "Ese código no es válido o ya venció. Generá uno nuevo en *Mi cuenta → Vincular WhatsApp* (dura 10 minutos).")
        return void (await terminar("procesado"))
      }
      await prisma.whatsappMensaje.update({ where: { id: m.id }, data: { vinculoId: r.vinculoId } })
      await responder(m.waId, r.vinculoId, `¡Listo, ${r.nombre}! Este número quedó vinculado a tu cuenta de AgroMonitor.${r.reemplazado ? " (Estaba vinculado a otra cuenta y se desvinculó de ella.)" : ""}\n\n${TEXTO_AYUDA}`)
      await terminar("procesado")
      return
    }

    // 2. Número vinculado y usuario activo
    const vinculo = await prisma.whatsappVinculo.findUnique({
      where: { waId: m.waId },
      select: { id: true, establecimientoActivoId: true, usuario: { select: { id: true, nombre: true, rol: true, esActivo: true } } },
    })
    if (!vinculo || !vinculo.usuario.esActivo) {
      // Se contesta una vez cada tanto: no se le da conversación a números desconocidos
      if (await contarEntrantes({ waId: m.waId, vinculoId: null }, LIMITE_SIN_VINCULAR.minutos) > 3) return void (await terminar("ignorado", "sin vincular"))
      await responder(m.waId, null, TEXTO_SIN_VINCULAR)
      return void (await terminar("procesado"))
    }
    await prisma.whatsappMensaje.update({ where: { id: m.id }, data: { vinculoId: vinculo.id } })

    // 3. Límite de mensajes por número (acota el costo del asistente)
    const recientes = await contarEntrantes({ waId: m.waId }, LIMITE_MENSAJES.minutos)
    if (recientes > LIMITE_MENSAJES.cantidad) {
      if (recientes === LIMITE_MENSAJES.cantidad + 1) await responder(m.waId, vinculo.id, `Recibí muchos mensajes seguidos. Esperá unos ${LIMITE_MENSAJES.minutos} minutos y seguimos.`)
      return void (await terminar("ignorado", "límite de mensajes"))
    }
    await marcarLeido(m.wamid!)

    // 4. Permisos del usuario, recalculados en cada mensaje
    const ctx: AuthContext = await contextoDeUsuario(vinculo.usuario.id, vinculo.usuario.rol)
    const campos = ctx.establecimientoIds.length
      ? await prisma.establecimiento.findMany({ where: { id: { in: ctx.establecimientoIds } }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } })
      : []
    if (!campos.length) {
      await responder(m.waId, vinculo.id, "Tu usuario no tiene campos activos en AgroMonitor. Pedile acceso al administrador de tu organización.")
      return void (await terminar("procesado"))
    }

    // 5. Campo activo: elegido de la lista, único, o se pregunta
    let campoId = vinculo.establecimientoActivoId && ctx.establecimientoIds.includes(vinculo.establecimientoActivoId) ? vinculo.establecimientoActivoId : null
    const elegido = respuestaId?.startsWith(PREFIJO_CAMPO) ? respuestaId.slice(PREFIJO_CAMPO.length) : null
    if (elegido && ctx.establecimientoIds.includes(elegido)) {
      await prisma.whatsappVinculo.update({ where: { id: vinculo.id }, data: { establecimientoActivoId: elegido } })
      await responder(m.waId, vinculo.id, `Listo, trabajamos en *${campos.find((c) => c.id === elegido)!.nombre}*. ¿Qué necesitás?`)
      return void (await terminar("procesado"))
    }
    if (!campoId && campos.length === 1) {
      campoId = campos[0].id
      await prisma.whatsappVinculo.update({ where: { id: vinculo.id }, data: { establecimientoActivoId: campoId } })
    }
    const pideCambio = /^\s*(cambiar\s+(de\s+)?)?campos?\s*$/i.test(texto ?? "")
    if (!campoId || pideCambio) {
      if (campos.length === 1) await responder(m.waId, vinculo.id, `Tenés un solo campo: *${campos[0].nombre}*.`)
      else await ofrecerCampos(m.waId, vinculo.id, campos, campoId ? "¿Con qué campo querés trabajar?" : "Tenés más de un campo. ¿Con cuál trabajamos?")
      return void (await terminar("procesado"))
    }
    const campo = campos.find((c) => c.id === campoId)!

    // 6. Contenido
    if (/^\s*(ayuda|men[uú]|\?)\s*$/i.test(texto ?? "")) {
      await responder(m.waId, vinculo.id, TEXTO_AYUDA)
      return void (await terminar("procesado"))
    }
    if (m.tipo === "imagen" || m.tipo === "documento" || m.tipo === "audio") {
      await responder(m.waId, vinculo.id, "Por ahora leo solo mensajes de texto. Muy pronto vas a poder mandar audios y fotos o PDF de facturas.")
      return void (await terminar("procesado"))
    }
    if (!texto?.trim()) {
      await responder(m.waId, vinculo.id, "No entendí el mensaje. Escribime tu consulta o *ayuda* para ver ejemplos.")
      return void (await terminar("procesado"))
    }
    if (!asistenteConfigurado()) {
      await responder(m.waId, vinculo.id, "El asistente todavía no está configurado. Avisale al administrador de AgroMonitor.")
      return void (await terminar("error", "falta ANTHROPIC_API_KEY"))
    }
    const respuesta = await responderConsulta({
      ctx, establecimientoId: campo.id, organizacionId: ctx.organizacionDeEstablecimiento[campo.id],
      texto, historial: await historial(vinculo.id, m.createdAt),
      usuarioNombre: vinculo.usuario.nombre, campoNombre: campo.nombre, rol: ETIQUETA_ROL[ctx.rolPorEstablecimiento[campo.id]] ?? "operario",
    })
    await responder(m.waId, vinculo.id, respuesta)
    await terminar("procesado")
  } catch (e) {
    console.error("Error procesando un mensaje de WhatsApp", e)
    await terminar("error", e instanceof Error ? e.message.slice(0, 500) : "error")
    try {
      await enviarTexto(m.waId, "Tuve un problema para responderte. Probá de nuevo en un rato.")
    } catch {
      // Si tampoco se puede avisar, queda registrado el error del mensaje
    }
  }
}
