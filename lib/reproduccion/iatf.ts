// Protocolos IATF (Fase E3): una plantilla (lib/reproduccion/iatf-plantillas.ts) aplicada a hembras
// de una torada desde el día 0. Cada paso es una Tarea con fecha (tipo «sanitario» si solo lleva
// hormonas; «reproduccion» si incluye la inseminación). Registrar un paso:
// - sus tratamientos van a Sanidad como aplicaciones a esas hembras (aplicarMasivo con animalIds:
//   libro sanitario, carencia, descuento de stock y anulación como cualquier aplicación masiva);
// - la inseminación es el servicio IATF por grupo (servicioMasivo, con pajuelas) y cierra el protocolo.
// Cada operación es idempotente: las claves derivan de la clave del paso.

import { createHash } from "node:crypto"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { aplicarMasivo } from "@/lib/sanidad/service"
import { estadosReproductivos } from "./estado"
import { servicioMasivo } from "./grupos"
import { ReproduccionError, auditar, diaDe, etiqueta, exigirRol, fechaDia, SEL_ANIMAL } from "./service"
import { fechaDelPaso, plantillaIatf, tratamientosConProducto } from "./iatf-plantillas"
import { pasoIatfSchema, protocoloIatfSchema, soloServicioNatural } from "./validation"
import { hoyArgentina } from "@/lib/inventario/fechas"

/** UUID estable a partir de la clave del paso (cada tratamiento y la inseminación tienen la suya). */
export function claveDerivada(base: string, sufijo: string) {
  const h = createHash("sha1").update(`${base}:${sufijo}`).digest("hex")
  const variante = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variante}${h.slice(18, 20)}-${h.slice(20, 32)}`
}

const lista = (nombres: string[], max = 5) => nombres.slice(0, max).join(", ") + (nombres.length > max ? ` y ${nombres.length - max} más` : "")

/** Aplica una plantilla IATF a hembras de una torada: crea el protocolo y una tarea por paso. */
export async function crearProtocoloIatf(ctx: AuthContext, raw: unknown) {
  const v = protocoloIatfSchema.parse(raw)
  const plantilla = plantillaIatf(v.plantilla)
  if (!plantilla) throw new ReproduccionError("Protocolo IATF desconocido", 400)
  const torada = await prisma.torada.findFirst({
    where: { id: v.toradaId, lote: { establecimientoId: { in: ctx.establecimientoIds } } },
    select: { id: true, nombre: true, tipo: true, fechaFin: true, loteId: true, lote: { select: { establecimientoId: true, especieId: true, especie: { select: { nombre: true } } } } },
  })
  if (!torada) throw new ReproduccionError("Torada no encontrada", 404)
  const est = torada.lote.establecimientoId
  exigirRol(ctx, est, "iatf")
  if (soloServicioNatural(torada.lote.especie.nombre)) throw new ReproduccionError("En ovinos el servicio es solo natural: no hay IATF", 400)
  if (torada.tipo === "natural") throw new ReproduccionError(`«${torada.nombre}» es de monta natural: elegí una torada de IATF, IA o mixta`, 400)
  if (torada.fechaFin) throw new ReproduccionError(`La torada «${torada.nombre}» está cerrada`, 400)
  const ultimo = plantilla.pasos[plantilla.pasos.length - 1]
  if (fechaDelPaso(v.fechaD0, 0) > fechaDelPaso(hoyArgentina(), 90)) throw new ReproduccionError("El día 0 no puede ser a más de 90 días", 400)

  const ids = [...new Set(v.hembraIds)]
  const hoy = hoyArgentina()
  const hembras = await prisma.animal.findMany({
    where: { id: { in: ids }, establecimientoId: est, estadoVital: "activo", sexo: "F", especieId: torada.lote.especieId, loteHist: { some: { loteId: torada.loteId, hasta: null } } },
    select: SEL_ANIMAL,
  })
  if (hembras.length !== ids.length) throw new ReproduccionError(`${ids.length - hembras.length} de las hembras elegidas no están activas en el grupo de la torada`, 400)
  // Terneras no: una hembra para IATF tiene al menos 10 meses al día 0
  const limite = fechaDelPaso(v.fechaD0, -300)
  const terneras = hembras.filter((h) => h.fechaNacimiento && diaDe(h.fechaNacimiento) > limite)
  if (terneras.length) throw new ReproduccionError(`Tienen menos de 10 meses: ${lista(terneras.map(etiqueta))}`, 400)
  const enOtro = await prisma.protocoloIatfHembra.findMany({ where: { animalId: { in: ids }, protocolo: { estado: "activo" } }, select: { animalId: true, protocolo: { select: { nombre: true } } } })
  if (enOtro.length) {
    const porId = new Map(hembras.map((h) => [h.id, h]))
    throw new ReproduccionError(`Ya están en un protocolo activo: ${lista(enOtro.map((e) => `${etiqueta(porId.get(e.animalId)!)} («${e.protocolo.nombre}»)`))}`, 409)
  }
  if (!v.aceptarPrenadas) {
    const estados = await estadosReproductivos(ids, hoy)
    const prenadas = hembras.filter((h) => estados.get(h.id)?.estado === "preñada")
    if (prenadas.length) throw new ReproduccionError(`Figuran preñadas: ${lista(prenadas.map(etiqueta))}. ¿Incluirlas igual?`, 409, "prenadas")
  }

  const nombre = v.nombre ?? `${plantilla.nombre.split(" (")[0]} · ${torada.nombre}`
  const resultado = await prisma.$transaction(async (tx) => {
    const p = await tx.protocoloIatf.create({
      data: { nombre, plantilla: plantilla.id, fechaD0: fechaDia(v.fechaD0), inseminador: v.inseminador, observ: v.observ, establecimientoId: est, toradaId: torada.id, creadoPorId: ctx.userId },
    })
    await tx.protocoloIatfHembra.createMany({ data: ids.map((animalId) => ({ protocoloId: p.id, animalId })) })
    await tx.tarea.createMany({
      data: plantilla.pasos.map((paso, i) => ({
        titulo: `IATF ${nombre} · D${paso.dia}: ${paso.titulo}`.slice(0, 200),
        descripcion: `${ids.length} hembras.${paso.tratamientos.length ? ` ${paso.tratamientos.map((t) => t.nombre).join(" + ")}.` : ""} Registralo en Reproducción › IATF.`,
        tipo: paso.inseminacion ? "reproduccion" : "sanitario", estado: "pendiente", prioridad: "alta",
        fechaLimite: new Date(`${fechaDelPaso(v.fechaD0, paso.dia)}T12:00:00-03:00`), establecimientoId: est, protocoloIatfId: p.id, pasoIatf: i,
      })),
    })
    await auditar(tx, ctx, est, "protocolos_iatf", p.id, { plantilla: plantilla.id, toradaId: torada.id, fechaD0: v.fechaD0, hembras: ids.length })
    return p
  })
  return { ...resultado, hembras: ids.length, pasos: plantilla.pasos.length, inseminacion: fechaDelPaso(v.fechaD0, ultimo.dia) }
}

async function protocoloDelUsuario(ctx: AuthContext, id: string) {
  const p = await prisma.protocoloIatf.findFirst({
    where: { id, establecimientoId: { in: ctx.establecimientoIds } },
    include: { hembras: { select: { animalId: true } }, tareas: { select: { id: true, pasoIatf: true, estado: true, tipo: true } }, torada: { select: { id: true, nombre: true } } },
  })
  if (!p) throw new ReproduccionError("Protocolo no encontrado", 404)
  return p
}

/**
 * Registra un paso: los tratamientos con producto van a Sanidad (uno por producto, a las hembras
 * elegidas) y, en el paso de la inseminación, el servicio IATF por grupo, que cierra el protocolo.
 */
export async function registrarPasoIatf(ctx: AuthContext, id: string, indice: number, raw: unknown) {
  const v = pasoIatfSchema.parse(raw)
  const p = await protocoloDelUsuario(ctx, id)
  exigirRol(ctx, p.establecimientoId, "iatf")
  if (p.estado === "cancelado") throw new ReproduccionError("El protocolo está cancelado", 400)
  const plantilla = plantillaIatf(p.plantilla)
  const paso = plantilla?.pasos[indice]
  if (!plantilla || !paso) throw new ReproduccionError("Paso no encontrado", 404)
  const tarea = p.tareas.find((t) => t.pasoIatf === indice)
  if (tarea?.estado === "completada" && !(paso.inseminacion && !p.operacionServicioId)) throw new ReproduccionError("Ese paso ya está registrado", 409)
  const d0 = diaDe(p.fechaD0)
  if (v.fecha < d0) throw new ReproduccionError("La fecha no puede ser anterior al día 0 del protocolo", 400)
  const delProtocolo = new Set(p.hembras.map((h) => h.animalId))
  const hembraIds = v.hembraIds ? [...new Set(v.hembraIds)] : [...delProtocolo]
  if (hembraIds.some((h) => !delProtocolo.has(h))) throw new ReproduccionError("Hay hembras que no son del protocolo", 400)
  const conProducto = tratamientosConProducto(paso)
  if (v.tratamientos.some((t) => !conProducto[t.indice]) || new Set(v.tratamientos.map((t) => t.indice)).size !== v.tratamientos.length) {
    throw new ReproduccionError("Los tratamientos no corresponden al paso", 400)
  }

  // Solo las hembras activas reciben el paso (alguna pudo darse de baja en el medio)
  const activas = await prisma.animal.findMany({ where: { id: { in: hembraIds }, estadoVital: "activo" }, select: { id: true } })
  const destino = activas.map((a) => a.id)
  if (!destino.length) throw new ReproduccionError("Ninguna de las hembras está activa", 400)

  const aplicaciones = []
  for (const t of v.tratamientos) {
    const ref = conProducto[t.indice]
    const r = await aplicarMasivo(ctx, {
      clave: claveDerivada(v.clave, `t${t.indice}`), destino: { establecimientoId: p.establecimientoId, animalIds: destino },
      productoId: t.productoId, fecha: v.fecha, dosis: t.dosis ?? ref.dosis, unidad: t.unidad ?? ref.unidad, via: t.via ?? ref.via, motivo: "preventivo",
      observ: `IATF ${p.nombre} · D${paso.dia}: ${ref.nombre}`, descontarPorAnimal: t.descontarPorAnimal, animalesEsperados: destino.length,
    })
    aplicaciones.push(r)
  }

  let servicios: { cantidad: number; pajuelas?: number } | null = null
  if (paso.inseminacion) {
    const claveServicio = claveDerivada(v.clave, "ia")
    servicios = await servicioMasivo(ctx, {
      clave: claveServicio, toradaId: p.toradaId, fecha: v.fecha, tipo: "iatf", hembraIds: destino,
      inseminador: v.inseminador ?? p.inseminador, productoSemenId: v.productoSemenId, loteProductoId: v.loteProductoId,
      observ: `IATF ${p.nombre}`,
    })
    await prisma.protocoloIatf.update({ where: { id: p.id }, data: { operacionServicioId: claveServicio, estado: "cerrado", inseminador: v.inseminador ?? p.inseminador } })
  }
  // Recién con todo registrado la tarea queda cumplida (así un reintento tras un error parcial
  // no duplica: las aplicaciones ya hechas se reconocen por su clave) y los tratamientos se vinculan a ella
  if (tarea) {
    if (v.tratamientos.length) {
      await prisma.evtSanidad.updateMany({ where: { operacionId: { in: v.tratamientos.map((t) => claveDerivada(v.clave, `t${t.indice}`)) } }, data: { tareaId: tarea.id } })
    }
    if (tarea.estado !== "completada") await prisma.tarea.update({ where: { id: tarea.id }, data: { estado: "completada", fechaCompletada: new Date() } })
  }
  return { paso: indice, hembras: destino.length, aplicaciones: aplicaciones.length, servicios: servicios?.cantidad ?? 0, pajuelas: servicios?.pajuelas ?? 0 }
}

/** Un protocolo con sus hembras (para registrar un paso). */
export async function detalleProtocoloIatf(ctx: AuthContext, id: string) {
  const p = await protocoloDelUsuario(ctx, id)
  const hembras = await prisma.animal.findMany({
    where: { id: { in: p.hembras.map((h) => h.animalId) } },
    select: { id: true, caravanaVisual: true, cuig: true, estadoVital: true }, orderBy: { caravanaVisual: "asc" },
  })
  return { id: p.id, nombre: p.nombre, plantilla: p.plantilla, estado: p.estado, fechaD0: diaDe(p.fechaD0), inseminador: p.inseminador, torada: p.torada, hembras }
}

/** Cancela un protocolo activo: sus pasos pendientes quedan cancelados (lo registrado no cambia). */
export async function cancelarProtocoloIatf(ctx: AuthContext, id: string) {
  const p = await protocoloDelUsuario(ctx, id)
  exigirRol(ctx, p.establecimientoId, "iatf")
  if (p.estado !== "activo") throw new ReproduccionError("El protocolo no está activo", 409)
  return prisma.$transaction(async (tx) => {
    await tx.protocoloIatf.update({ where: { id }, data: { estado: "cancelado" } })
    const { count } = await tx.tarea.updateMany({ where: { protocoloIatfId: id, estado: { in: ["pendiente", "en_progreso"] } }, data: { estado: "cancelada" } })
    await auditar(tx, ctx, p.establecimientoId, "protocolos_iatf", id, { cancelado: true, tareasCanceladas: count })
    return { tareasCanceladas: count }
  })
}

interface FilaConcepcion { protocolo_id: string | null; inseminador: string | null; inseminadas: number; tactadas: number; prenadas: number }

/** Protocolos del campo con sus pasos y, si se inseminó, la tasa de concepción; también por inseminador. */
export async function listarProtocolosIatf(ctx: AuthContext, establecimientoId: string) {
  if (!ctx.establecimientoIds.includes(establecimientoId)) throw new ReproduccionError("Campo no encontrado", 404)
  const protocolos = await prisma.protocoloIatf.findMany({
    where: { establecimientoId }, orderBy: [{ fechaD0: "desc" }, { createdAt: "desc" }], take: 50,
    include: { torada: { select: { id: true, nombre: true } }, _count: { select: { hembras: true } }, tareas: { select: { id: true, pasoIatf: true, estado: true, fechaLimite: true, fechaCompletada: true } } },
  })
  // Concepción: de cada servicio IATF del protocolo, el tacto vinculado o el primero sin vincular
  // de la hembra dentro de los 300 días (sin otro servicio en el medio). Por protocolo y por inseminador.
  const operaciones = protocolos.map((p) => p.operacionServicioId).filter((x): x is string => !!x)
  const consulta = (agrupar: "protocolo" | "inseminador") => prisma.$queryRawUnsafe<FilaConcepcion[]>(`
    WITH s AS (
      SELECT s.id, s.hembra_id, s.fecha, s.inseminador, pi.id AS protocolo_id FROM evt_servicio s
      JOIN protocolos_iatf pi ON pi.operacion_servicio_id = s.operacion_id
      WHERE s.anulado_at IS NULL AND s.operacion_id = ANY($1::uuid[])
    ),
    t AS (
      SELECT DISTINCT ON (s.id) s.id, x.resultado FROM s JOIN evt_tacto x ON x.hembra_id = s.hembra_id AND x.anulado_at IS NULL AND (
        x.servicio_id = s.id OR (x.servicio_id IS NULL AND x.fecha > s.fecha AND x.fecha <= s.fecha + 300
          AND NOT EXISTS (SELECT 1 FROM evt_servicio s2 WHERE s2.hembra_id = s.hembra_id AND s2.anulado_at IS NULL AND s2.fecha > s.fecha AND s2.fecha < x.fecha)))
      ORDER BY s.id, (x.servicio_id = s.id) DESC NULLS LAST, x.fecha ASC
    )
    SELECT ${agrupar === "protocolo" ? "s.protocolo_id, NULL::text AS inseminador" : "NULL::uuid AS protocolo_id, COALESCE(NULLIF(TRIM(s.inseminador), ''), 'Sin indicar') AS inseminador"},
      COUNT(*)::int AS inseminadas, COUNT(t.id) FILTER (WHERE t.resultado <> 'dudosa')::int AS tactadas, COUNT(t.id) FILTER (WHERE t.resultado = 'preñada')::int AS prenadas
    FROM s LEFT JOIN t ON t.id = s.id GROUP BY 1, 2`, operaciones)
  const [porProtocolo, porInseminador] = operaciones.length ? await Promise.all([consulta("protocolo"), consulta("inseminador")]) : [[], []]
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null)
  const hoy = hoyArgentina()
  return {
    protocolos: protocolos.map((p) => {
      const plantilla = plantillaIatf(p.plantilla)
      const c = porProtocolo.find((f) => f.protocolo_id === p.id)
      const d0 = diaDe(p.fechaD0)
      return {
        id: p.id, nombre: p.nombre, plantilla: p.plantilla, plantillaNombre: plantilla?.nombre ?? p.plantilla, estado: p.estado, fechaD0: d0,
        torada: p.torada, inseminador: p.inseminador, hembras: p._count.hembras,
        pasos: (plantilla?.pasos ?? []).map((paso, i) => {
          const t = p.tareas.find((x) => x.pasoIatf === i)
          const fecha = fechaDelPaso(d0, paso.dia)
          return { indice: i, dia: paso.dia, titulo: paso.titulo, fecha, inseminacion: !!paso.inseminacion, estado: t?.estado ?? "pendiente", vencido: (t?.estado ?? "pendiente") === "pendiente" && fecha < hoy, tareaId: t?.id ?? null }
        }),
        concepcion: c ? { inseminadas: c.inseminadas, tactadas: c.tactadas, prenadas: c.prenadas, porcentaje: pct(c.prenadas, c.tactadas) } : null,
      }
    }),
    porInseminador: porInseminador.map((f) => ({ inseminador: f.inseminador, inseminadas: f.inseminadas, tactadas: f.tactadas, prenadas: f.prenadas, porcentaje: pct(f.prenadas, f.tactadas) })),
  }
}

