// Vinculación de un número de WhatsApp con un usuario. Desde «Mi cuenta» se pide
// un código de un solo uso (vence a los 10 minutos; se guarda solo su SHA-256) y
// el usuario lo manda al bot desde su teléfono: como el mensaje llega desde ese
// número, queda probado que es suyo.

import { createHash, randomInt } from "node:crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { whatsappConfig } from "./config"

// Sin I, O, 0 ni 1 para que no se confundan al tipearlo
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
export const LARGO_CODIGO = 6
export const MINUTOS_CODIGO = 10

export const generarCodigo = () => Array.from({ length: LARGO_CODIGO }, () => ALFABETO[randomInt(ALFABETO.length)]).join("")
export const hashCodigo = (codigo: string) => createHash("sha256").update(codigo.toUpperCase()).digest("hex")

/** «VINCULAR K7Q2MZ» (con o sin espacios dentro del código, mayúsculas o minúsculas). */
export function leerCodigo(texto: string | null): string | null {
  const m = /^\s*vincular\s+([a-z0-9 ]{6,9})\s*$/i.exec(texto ?? "")
  if (!m) return null
  const codigo = m[1].replace(/\s/g, "").toUpperCase()
  return codigo.length === LARGO_CODIGO ? codigo : null
}

export const enlaceWhatsapp = (codigo: string) => {
  const numero = whatsappConfig().numero
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(`VINCULAR ${codigo}`)}` : null
}

/** Genera un código nuevo para el usuario (reemplaza el anterior). El número vinculado no cambia hasta usarlo. */
export async function crearCodigoVinculo(usuarioId: string) {
  for (let intento = 0; ; intento++) {
    const codigo = generarCodigo()
    const expira = new Date(Date.now() + MINUTOS_CODIGO * 60_000)
    try {
      await prisma.whatsappVinculo.upsert({
        where: { usuarioId },
        create: { usuarioId, codigoHash: hashCodigo(codigo), codigoExpira: expira },
        update: { codigoHash: hashCodigo(codigo), codigoExpira: expira },
      })
      return { codigo, expira, enlace: enlaceWhatsapp(codigo) }
    } catch (e) {
      // Choque improbable con el código vigente de otro usuario: se genera otro
      if (intento < 3 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue
      throw e
    }
  }
}

export type ResultadoVinculo =
  | { ok: true; usuarioId: string; vinculoId: string; nombre: string; reemplazado: boolean }
  | { ok: false }

/**
 * Vincula `waId` con el usuario dueño del código. Si el número estaba vinculado a otra
 * cuenta, se le quita (quien tiene el teléfono decide a qué cuenta pertenece).
 */
export async function vincularNumero(waId: string, codigo: string, ahora = new Date()): Promise<ResultadoVinculo> {
  return prisma.$transaction(async (tx) => {
    const v = await tx.whatsappVinculo.findFirst({
      where: { codigoHash: hashCodigo(codigo), codigoExpira: { gt: ahora }, usuario: { esActivo: true } },
      select: { id: true, usuarioId: true, usuario: { select: { nombre: true } } },
    })
    if (!v) return { ok: false as const }
    const previo = await tx.whatsappVinculo.findUnique({ where: { waId }, select: { id: true } })
    const reemplazado = !!previo && previo.id !== v.id
    if (reemplazado) await tx.whatsappVinculo.update({ where: { id: previo!.id }, data: { waId: null, verificadoAt: null } })
    await tx.whatsappVinculo.update({ where: { id: v.id }, data: { waId, verificadoAt: ahora, codigoHash: null, codigoExpira: null } })
    await tx.auditLog.create({ data: { usuarioId: v.usuarioId, tabla: "whatsapp_vinculos", rowPk: v.id, accion: "UPDATE", detalle: { vinculado: true, reemplazado } } })
    return { ok: true as const, usuarioId: v.usuarioId, vinculoId: v.id, nombre: v.usuario.nombre, reemplazado }
  })
}

export async function desvincular(usuarioId: string) {
  const v = await prisma.whatsappVinculo.findUnique({ where: { usuarioId }, select: { id: true } })
  if (!v) return
  await prisma.$transaction([
    prisma.whatsappVinculo.update({ where: { id: v.id }, data: { waId: null, verificadoAt: null, codigoHash: null, codigoExpira: null } }),
    prisma.auditLog.create({ data: { usuarioId, tabla: "whatsapp_vinculos", rowPk: v.id, accion: "UPDATE", detalle: { vinculado: false } } }),
  ])
}

/** Estado para la tarjeta de «Mi cuenta». */
export async function estadoVinculo(usuarioId: string) {
  const v = await prisma.whatsappVinculo.findUnique({
    where: { usuarioId },
    select: { waId: true, verificadoAt: true, recordatorios: true, codigoExpira: true, establecimientoActivo: { select: { nombre: true } } },
  })
  return {
    vinculado: !!v?.waId,
    numero: v?.waId ? `+${v.waId}` : null,
    desde: v?.verificadoAt?.toISOString() ?? null,
    campo: v?.establecimientoActivo?.nombre ?? null,
    recordatorios: v?.recordatorios ?? false,
    numeroBot: whatsappConfig().numero ? `+${whatsappConfig().numero}` : null,
  }
}
