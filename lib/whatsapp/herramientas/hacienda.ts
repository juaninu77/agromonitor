// Herramientas «proponer_*» del asistente de WhatsApp: entienden un evento de hacienda,
// resuelven caravanas, grupos y productos dentro del campo activo, validan con los mismos
// schemas que la web y crean un borrador. Nunca escriben eventos: eso pasa recién cuando
// la persona toca «Confirmar» (y, según su rol, cuando lo valida un encargado).

import { randomUUID } from "node:crypto"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { normalizeEID } from "@/lib/hardware/eid"
import { hoyArgentina } from "@/lib/inventario/fechas"
import { consumoSugerido } from "@/lib/inventario/consumo"
import { esSanitario } from "@/lib/inventario/validation"
import { contarDestino } from "@/lib/sanidad/service"
import { aplicacionMasivaSchema, ETIQUETA_MOTIVO, ETIQUETA_VIA, MOTIVOS_SANIDAD, VIAS_SANIDAD } from "@/lib/sanidad/validation"
import {
  cargaRapidaCeloSchema, ETIQUETA_RESULTADO_TACTO, METODOS_CELO, METODOS_TACTO, MOMENTOS_CELO, paricionSchema, RESULTADOS_TACTO,
  servicioSchema, tactoMasivoSchema, TIPOS_PARTO, TIPOS_SERVICIO,
} from "@/lib/reproduccion/validation"
import { bajaSchema, MOTIVOS_BAJA, movimientoLoteSchema, pesadaSchema } from "@/lib/validations/eventos-schema"
import { aplicaDirecto, crearBorrador, ETIQUETA_ACCION, type AccionBorrador } from "../borradores"
import { herramienta, type ContextoConsulta, type Herramienta } from "./consultas"

export interface ContextoPropuesta extends ContextoConsulta {
  vinculoId: string | null
  /** Texto del mensaje (o transcripción del audio) que originó la propuesta */
  origen: string
  /** Borradores creados en este mensaje: procesar.ts manda cada uno con sus botones */
  borradores: { id: string; resumen: string }[]
}

const MAX_BORRADORES = 5
const MAX_ANIMALES = 300

const json = (v: unknown) => JSON.stringify(v)
const str = (v: unknown, max = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined)
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v.replace(",", "."))) ? Number(v.replace(",", ".")) : undefined)
const lista = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x, 40)).filter((x): x is string => !!x) : [])
const enumDe = <T extends string>(opciones: readonly T[], v: unknown): T | undefined => (opciones as readonly string[]).includes(v as string) ? (v as T) : undefined
const dm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 3 })

class Problema extends Error {
  constructor(message: string, public detalles?: string[]) {
    super(message)
  }
}

/** Día del evento: el que indicó el modelo (YYYY-MM-DD, no futuro) u hoy. */
function diaDe(v: unknown) {
  const hoy = hoyArgentina()
  if (v === undefined || v === null || v === "") return hoy
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Problema("La fecha tiene que ser AAAA-MM-DD.")
  if (v > hoy) throw new Problema("La fecha no puede ser futura.")
  return v
}

// ---------------------------------------------------------------- resolución dentro del campo

interface AnimalResuelto { id: string; etiqueta: string; sexo: string; especieId: string; identificador: string }

/** Animales activos del campo por caravana, CUIG, número interno o EID (exacto). Todos o error. */
async function resolverAnimales(establecimientoId: string, identificadores: string[], sexo?: "M" | "F"): Promise<AnimalResuelto[]> {
  const ids = [...new Set(identificadores.map((i) => i.trim()).filter(Boolean))]
  if (!ids.length) throw new Problema("Faltan las caravanas de los animales.")
  if (ids.length > MAX_ANIMALES) throw new Problema(`Son demasiados animales (máximo ${MAX_ANIMALES}): cargalo por grupo o desde la app.`)
  const eids = ids.map((i) => normalizeEID(i)).filter((e): e is string => !!e)
  const candidatos = await prisma.animal.findMany({
    where: {
      establecimientoId, estadoVital: "activo",
      OR: [
        { caravanaVisual: { in: ids, mode: "insensitive" } },
        { cuig: { in: ids, mode: "insensitive" } },
        { otroId: { in: ids, mode: "insensitive" } },
        ...(eids.length ? [{ caravanaRfid: { in: eids } }] : []),
      ],
    },
    select: { id: true, caravanaVisual: true, caravanaRfid: true, cuig: true, otroId: true, sexo: true, especieId: true },
    take: MAX_ANIMALES * 3,
  })
  const igual = (a: string | null, b: string) => !!a && a.toLowerCase() === b.toLowerCase()
  const problemas: string[] = []
  const res: AnimalResuelto[] = []
  for (const id of ids) {
    const eid = normalizeEID(id)
    const m = candidatos.filter((a) => igual(a.caravanaVisual, id) || igual(a.cuig, id) || igual(a.otroId, id) || (!!eid && a.caravanaRfid === eid))
    if (!m.length) problemas.push(`${id}: no está entre los animales activos del campo`)
    else if (m.length > 1) problemas.push(`${id}: coincide con ${m.length} animales (decime la caravana electrónica)`)
    else if (sexo && m[0].sexo !== sexo) problemas.push(`${id}: es ${m[0].sexo === "M" ? "macho" : "hembra"}`)
    else if (!res.some((r) => r.id === m[0].id)) res.push({ id: m[0].id, etiqueta: m[0].caravanaVisual ?? m[0].caravanaRfid ?? m[0].cuig ?? m[0].otroId ?? id, sexo: m[0].sexo, especieId: m[0].especieId, identificador: id })
  }
  if (problemas.length) throw new Problema("No pude identificar todos los animales.", problemas)
  return res
}

/** Grupo (lote) activo del campo por nombre: exacto o el único que lo contiene. */
async function resolverGrupo(establecimientoId: string, nombre: string) {
  const grupos = await prisma.lote.findMany({ where: { establecimientoId, activo: true }, select: { id: true, nombre: true, especieId: true }, orderBy: { nombre: "asc" } })
  const n = nombre.trim().toLowerCase()
  const exacto = grupos.filter((g) => g.nombre.trim().toLowerCase() === n)
  const parecidos = exacto.length ? exacto : grupos.filter((g) => g.nombre.toLowerCase().includes(n))
  if (parecidos.length === 1) return parecidos[0]
  if (!parecidos.length) throw new Problema(`No hay un grupo activo «${nombre}» en el campo.`, grupos.slice(0, 15).map((g) => `Grupo: ${g.nombre}`))
  throw new Problema(`Hay varios grupos que coinciden con «${nombre}».`, parecidos.slice(0, 10).map((g) => `Grupo: ${g.nombre}`))
}

/** Producto sanitario de la organización o del catálogo general, por nombre o principio activo. */
async function resolverProducto(organizacionId: string, nombre: string) {
  const productos = (await prisma.producto.findMany({
    where: {
      activo: true, OR: [{ organizacionId }, { organizacionId: null }],
      AND: [{ OR: [{ nombre: { contains: nombre.trim(), mode: "insensitive" } }, { principioActivo: { contains: nombre.trim(), mode: "insensitive" } }] }],
    },
    select: { id: true, nombre: true, tipo: true, unidad: true, organizacionId: true, retiroDias: true },
    take: 30,
  })).filter((p) => esSanitario(p.tipo))
  const exacto = productos.filter((p) => p.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())
  // Si hay uno propio y uno del catálogo con el mismo nombre, el propio (tiene stock)
  const candidatos = exacto.length ? exacto : productos
  const propios = candidatos.filter((p) => p.organizacionId)
  const elegidos = propios.length ? propios : candidatos
  if (elegidos.length === 1) return elegidos[0]
  if (!elegidos.length) throw new Problema(`No encontré un producto sanitario «${nombre}» en Inventario ni en el catálogo.`)
  throw new Problema(`Hay varios productos que coinciden con «${nombre}».`, elegidos.slice(0, 8).map((p) => `Producto: ${p.nombre}`))
}

const listaAnimales = (a: { etiqueta: string }[], max = 12) =>
  a.length <= max ? a.map((x) => x.etiqueta).join(", ") : `${a.slice(0, max).map((x) => x.etiqueta).join(", ")} y ${a.length - max} más`

// ---------------------------------------------------------------- herramientas

const FECHA = { type: "string", description: "Día del evento AAAA-MM-DD (por defecto hoy). Calculala vos si dicen «ayer» o «el lunes»." }
const CARAVANAS = { type: "array", items: { type: "string" }, description: "Caravanas (visual, CUIG, número interno o EID) tal como las dijo el usuario" }

export function herramientasHacienda(c: ContextoPropuesta): Herramienta[] {
  const { ctx, establecimientoId, organizacionId } = c
  const rol = ctx.rolPorEstablecimiento[establecimientoId]

  /** Valida, arma el resumen y guarda el borrador; los problemas vuelven al modelo para que pregunte. */
  const proponer = (accion: AccionBorrador, armar: (id: string) => Promise<{ payload: Record<string, unknown>; resumen: string }>) =>
    async (): Promise<string> => {
      try {
        if (c.borradores.length >= MAX_BORRADORES) return json({ error: "Ya propusiste varias cargas en este mensaje: que confirme esas primero." })
        const id = randomUUID()
        const { payload, resumen } = await armar(id)
        const nota = aplicaDirecto(accion, rol) ? "" : "\n_Al confirmar queda para que lo valide un encargado o administrador del campo._"
        const b = await crearBorrador({ id, vinculoId: c.vinculoId, usuarioId: ctx.userId, establecimientoId, accion, payload, resumen: resumen + nota, origen: c.origen })
        c.borradores.push(b)
        return json({ ok: true, resumen: b.resumen, aviso: "El sistema ya le mandó este resumen con los botones Confirmar/Cancelar. No lo repitas." })
      } catch (e) {
        if (e instanceof Problema) return json({ error: e.message, detalles: e.detalles })
        if (e instanceof z.ZodError) return json({ error: e.issues.map((i) => i.message).join(". ") })
        const status = (e as { status?: number }).status
        if (status && status < 500 && e instanceof Error) return json({ error: e.message })
        console.error("Error al proponer una carga por WhatsApp", e)
        return json({ error: "No se pudo preparar la carga ahora." })
      }
    }

  return [
    herramienta({
      name: "proponer_sanidad",
      description: "Prepara el registro de una aplicación sanitaria (vacuna, antiparasitario, antibiótico…) a animales por caravana o a todos los de un grupo. Descuenta del stock cuando se puede calcular. Pedí los datos que falten (producto y a quiénes) antes de llamarla.",
      inputSchema: {
        type: "object",
        properties: {
          producto: { type: "string", description: "Nombre comercial o principio activo" },
          caravanas: CARAVANAS,
          grupo: { type: "string", description: "Nombre del grupo (en vez de caravanas)" },
          dosis: { type: "number", description: "Dosis por animal" },
          unidad: { type: "string", enum: ["ml", "cc", "comprimido", "dosis", "g"] },
          via: { type: "string", enum: [...VIAS_SANIDAD] },
          motivo: { type: "string", enum: [...MOTIVOS_SANIDAD] },
          carenciaDias: { type: "integer", description: "Solo si el usuario la dice; si no, se usa la del producto" },
          veterinario: { type: "string" },
          observ: { type: "string" },
          fecha: FECHA,
        },
        required: ["producto"],
        additionalProperties: false,
      },
      run: (i) => proponer("sanidad", async (id) => {
        const caravanas = lista(i.caravanas), grupoNombre = str(i.grupo)
        if (!!caravanas.length === !!grupoNombre) throw new Problema("Indicá las caravanas o el grupo (uno de los dos).")
        const producto = await resolverProducto(organizacionId, str(i.producto) ?? "")
        const fecha = diaDe(i.fecha)
        const animales = caravanas.length ? await resolverAnimales(establecimientoId, caravanas) : null
        const grupo = grupoNombre ? await resolverGrupo(establecimientoId, grupoNombre) : null
        const destino = { establecimientoId, ...(grupo ? { loteId: grupo.id } : { animalIds: animales!.map((a) => a.id) }) }
        const { cantidad, excede } = await contarDestino(ctx, destino)
        if (!cantidad) throw new Problema(grupo ? `El grupo «${grupo.nombre}» no tiene animales activos.` : "No hay animales activos para aplicar.")
        if (excede) throw new Problema("Son demasiados animales: cargalo desde la app.")
        const dosis = num(i.dosis), unidad = str(i.unidad, 20)
        const descontar = producto.organizacionId ? consumoSugerido(producto.unidad, dosis, unidad, 1) : null
        const payload = {
          clave: id, destino, productoId: producto.id, fecha, dosis: dosis ?? null, unidad: unidad ?? null,
          via: enumDe(VIAS_SANIDAD, i.via) ?? null, motivo: enumDe(MOTIVOS_SANIDAD, i.motivo) ?? null,
          carenciaDias: num(i.carenciaDias) ?? null, veterinario: str(i.veterinario) ?? null, observ: str(i.observ, 1000) ?? null,
          descontarPorAnimal: descontar, animalesEsperados: cantidad,
        }
        aplicacionMasivaSchema.parse(payload)
        const aplicacion = [dosis ? `${fmt(dosis)} ${unidad ?? ""}`.trim() : null, payload.via ? ETIQUETA_VIA[payload.via] : null, payload.motivo ? ETIQUETA_MOTIVO[payload.motivo] : null].filter(Boolean).join(" · ")
        const stock = !producto.organizacionId ? "no se descuenta (producto del catálogo general)"
          : descontar != null ? `descuenta ${fmt(descontar * cantidad)} ${producto.unidad}`
          : "no se descuenta (no pude calcular la cantidad con esa dosis)"
        return {
          payload,
          resumen: [
            `💉 *${ETIQUETA_ACCION.sanidad}* · ${dm(fecha)}`,
            `• Producto: ${producto.nombre}`,
            ...(aplicacion ? [`• Aplicación: ${aplicacion}`] : []),
            `• A: ${grupo ? `grupo «${grupo.nombre}» (${cantidad} animales)` : `${cantidad === 1 ? "" : `${cantidad} animales: `}${listaAnimales(animales!)}`}`,
            `• Carencia: ${payload.carenciaDias != null ? `${payload.carenciaDias} días` : producto.retiroDias ? `${producto.retiroDias} días (del producto)` : "sin carencia"}`,
            `• Stock: ${stock}`,
          ].join("\n"),
        }
      })(),
    }),

    herramienta({
      name: "proponer_pesadas",
      description: "Prepara el registro de pesadas: uno o varios animales con su peso en kg.",
      inputSchema: {
        type: "object",
        properties: {
          pesadas: {
            type: "array",
            items: {
              type: "object",
              properties: { caravana: { type: "string" }, kg: { type: "number" }, cc: { type: "number", description: "Condición corporal 1–9, si la dicen" } },
              required: ["caravana", "kg"],
              additionalProperties: false,
            },
          },
          fecha: FECHA,
          notas: { type: "string" },
        },
        required: ["pesadas"],
        additionalProperties: false,
      },
      run: (i) => proponer("pesada", async () => {
        const filas = (Array.isArray(i.pesadas) ? i.pesadas : []).map((p) => p as Record<string, unknown>)
        if (!filas.length) throw new Problema("Faltan las pesadas.")
        const animales = await resolverAnimales(establecimientoId, filas.map((p) => str(p.caravana, 40) ?? ""))
        if (animales.length !== filas.length) throw new Problema("Hay un animal repetido en las pesadas.")
        const fecha = diaDe(i.fecha), notas = str(i.notas, 500)
        const pesadas = filas.map((p, k) => ({ animalId: animales[k].id, peso: num(p.kg), cc: num(p.cc) ?? null, fecha, notas: notas ?? null }))
        for (const p of pesadas) pesadaSchema.parse(p)
        return {
          payload: { pesadas },
          resumen: [`⚖️ *${ETIQUETA_ACCION.pesada}* · ${dm(fecha)}`, ...pesadas.map((p, k) => `• ${animales[k].etiqueta}: ${fmt(p.peso!)} kg${p.cc != null ? ` · CC ${fmt(p.cc)}` : ""}`), ...(notas ? [`• Notas: ${notas}`] : [])].join("\n"),
        }
      })(),
    }),

    herramienta({
      name: "proponer_movimiento",
      description: "Prepara el pase de animales a otro grupo (lote) del campo.",
      inputSchema: {
        type: "object",
        properties: { caravanas: CARAVANAS, grupo: { type: "string", description: "Grupo destino" }, fecha: FECHA, motivo: { type: "string" } },
        required: ["caravanas", "grupo"],
        additionalProperties: false,
      },
      run: (i) => proponer("movimiento", async () => {
        const animales = await resolverAnimales(establecimientoId, lista(i.caravanas))
        const grupo = await resolverGrupo(establecimientoId, str(i.grupo) ?? "")
        if (animales.some((a) => a.especieId !== grupo.especieId)) throw new Problema(`El grupo «${grupo.nombre}» es de otra especie que alguno de los animales.`)
        const fecha = diaDe(i.fecha), motivo = str(i.motivo, 200)
        const payload = { animalIds: animales.map((a) => a.id), loteDestinoId: grupo.id, fecha, motivo: motivo ?? null }
        movimientoLoteSchema.parse(payload)
        return {
          payload,
          resumen: [`🔀 *${ETIQUETA_ACCION.movimiento}* · ${dm(fecha)}`, `• Al grupo: ${grupo.nombre}`, `• Animales (${animales.length}): ${listaAnimales(animales)}`, ...(motivo ? [`• Motivo: ${motivo}`] : [])].join("\n"),
        }
      })(),
    }),

    herramienta({
      name: "proponer_baja",
      description: "Prepara la baja de UN animal (venta, muerte, faena, descarte, robo u otro). Para varios, llamala una vez por animal.",
      inputSchema: {
        type: "object",
        properties: {
          caravana: { type: "string" },
          motivo: { type: "string", enum: [...MOTIVOS_BAJA] },
          fecha: FECHA,
          pesoKg: { type: "number" },
          precioTotal: { type: "number", description: "Importe total en pesos, si es venta" },
          observ: { type: "string", description: "Causa de muerte u otro detalle" },
        },
        required: ["caravana", "motivo"],
        additionalProperties: false,
      },
      run: (i) => proponer("baja", async () => {
        const [animal] = await resolverAnimales(establecimientoId, [str(i.caravana, 40) ?? ""])
        const motivo = enumDe(MOTIVOS_BAJA, i.motivo)
        if (!motivo) throw new Problema("Falta el motivo de la baja.")
        const fecha = diaDe(i.fecha), observ = str(i.observ, 500)
        const payload = { animalId: animal.id, motivo, fecha, pesoVivoKg: num(i.pesoKg) ?? null, precioTotal: num(i.precioTotal) ?? null, observ: observ ?? null }
        bajaSchema.parse(payload)
        return {
          payload,
          resumen: [
            `🏷️ *${ETIQUETA_ACCION.baja}* · ${dm(fecha)}`, `• Animal: ${animal.etiqueta}`, `• Motivo: ${motivo}`,
            ...(payload.pesoVivoKg ? [`• Peso: ${fmt(payload.pesoVivoKg)} kg`] : []),
            ...(payload.precioTotal ? [`• Precio total: $ ${fmt(payload.precioTotal)}`] : []),
            ...(observ ? [`• Detalle: ${observ}`] : []),
          ].join("\n"),
        }
      })(),
    }),

    herramienta({
      name: "proponer_servicio",
      description: "Prepara el registro de un servicio (monta natural, IA o IATF) de UNA hembra.",
      inputSchema: {
        type: "object",
        properties: {
          caravana: { type: "string", description: "Caravana de la hembra" },
          tipo: { type: "string", enum: [...TIPOS_SERVICIO] },
          toro: { type: "string", description: "Caravana del toro del rodeo o nombre del toro/semen" },
          inseminador: { type: "string" },
          fecha: FECHA,
          observ: { type: "string" },
        },
        required: ["caravana", "tipo"],
        additionalProperties: false,
      },
      run: (i) => proponer("servicio", async () => {
        const [hembra] = await resolverAnimales(establecimientoId, [str(i.caravana, 40) ?? ""], "F")
        const tipo = enumDe(TIPOS_SERVICIO, i.tipo)
        if (!tipo) throw new Problema("Falta el tipo de servicio (natural, IA o IATF).")
        const toro = str(i.toro)
        const macho = toro ? await resolverAnimales(establecimientoId, [toro], "M").then((a) => a[0]).catch(() => null) : null
        const fecha = diaDe(i.fecha)
        const payload = {
          hembraId: hembra.id, tipo, fecha, machoId: macho?.id ?? null, toroNombre: macho ? null : toro ?? null,
          inseminador: str(i.inseminador) ?? null, observ: str(i.observ, 1000) ?? null,
        }
        servicioSchema.parse(payload)
        return {
          payload,
          resumen: [`🐂 *${ETIQUETA_ACCION.servicio}* · ${dm(fecha)}`, `• Hembra: ${hembra.etiqueta}`, `• Tipo: ${tipo === "natural" ? "natural" : tipo.toUpperCase()}`, ...(toro ? [`• Toro: ${macho ? `${macho.etiqueta} (del rodeo)` : toro}`] : []), ...(payload.inseminador ? [`• Inseminador: ${payload.inseminador}`] : [])].join("\n"),
        }
      })(),
    }),

    herramienta({
      name: "proponer_tactos",
      description: "Prepara el registro de tactos (diagnóstico de preñez) de una o varias hembras, con el resultado de cada una.",
      inputSchema: {
        type: "object",
        properties: {
          resultados: {
            type: "array",
            items: {
              type: "object",
              properties: { caravana: { type: "string" }, resultado: { type: "string", enum: [...RESULTADOS_TACTO] }, meses: { type: "number", description: "Meses de gestación si es preñada y lo dicen" } },
              required: ["caravana", "resultado"],
              additionalProperties: false,
            },
          },
          metodo: { type: "string", enum: [...METODOS_TACTO] },
          veterinario: { type: "string" },
          fecha: FECHA,
        },
        required: ["resultados"],
        additionalProperties: false,
      },
      run: (i) => proponer("tacto", async (id) => {
        const filas = (Array.isArray(i.resultados) ? i.resultados : []).map((p) => p as Record<string, unknown>)
        if (!filas.length) throw new Problema("Faltan los resultados del tacto.")
        const hembras = await resolverAnimales(establecimientoId, filas.map((f) => str(f.caravana, 40) ?? ""), "F")
        if (hembras.length !== filas.length) throw new Problema("Hay una hembra repetida.")
        const fecha = diaDe(i.fecha)
        const payload = {
          clave: id, fecha, metodo: enumDe(METODOS_TACTO, i.metodo) ?? "palpacion", veterinario: str(i.veterinario) ?? null,
          filas: filas.map((f, k) => ({ hembraId: hembras[k].id, resultado: enumDe(RESULTADOS_TACTO, f.resultado), mesesGest: f.resultado === "preñada" ? num(f.meses) ?? null : null })),
        }
        tactoMasivoSchema.parse(payload)
        const prenadas = payload.filas.filter((f) => f.resultado === "preñada").length
        return {
          payload,
          resumen: [
            `🩺 *${ETIQUETA_ACCION.tacto}* · ${dm(fecha)} (${filas.length}${filas.length > 1 ? `, ${prenadas} preñadas` : ""})`,
            ...payload.filas.slice(0, 30).map((f, k) => `• ${hembras[k].etiqueta}: ${ETIQUETA_RESULTADO_TACTO[f.resultado!]}${f.mesesGest ? ` (${fmt(f.mesesGest)} meses)` : ""}`),
            ...(filas.length > 30 ? [`• … y ${filas.length - 30} más`] : []),
            ...(payload.veterinario ? [`• Veterinario: ${payload.veterinario}`] : []),
          ].join("\n"),
        }
      })(),
    }),

    herramienta({
      name: "proponer_parto",
      description: "Prepara el registro de un parto (o aborto) de UNA madre, con sus crías. Las crías vivas se dan de alta en el rodeo.",
      inputSchema: {
        type: "object",
        properties: {
          caravana: { type: "string", description: "Caravana de la madre" },
          aborto: { type: "boolean" },
          crias: {
            type: "array",
            items: {
              type: "object",
              properties: { viva: { type: "boolean" }, sexo: { type: "string", enum: ["M", "F"] }, pesoKg: { type: "number" }, caravana: { type: "string", description: "Caravana que le pusieron, si la dicen" } },
              required: ["viva"],
              additionalProperties: false,
            },
          },
          tipoParto: { type: "string", enum: [...TIPOS_PARTO] },
          fecha: FECHA,
          observ: { type: "string" },
        },
        required: ["caravana"],
        additionalProperties: false,
      },
      run: (i) => proponer("parto", async () => {
        const [madre] = await resolverAnimales(establecimientoId, [str(i.caravana, 40) ?? ""], "F")
        const aborto = i.aborto === true
        const crias = aborto ? [] : (Array.isArray(i.crias) ? i.crias : []).map((x) => {
          const cr = x as Record<string, unknown>
          return { resultado: cr.viva === false ? "muerto" : "vivo", sexo: enumDe(["M", "F"] as const, cr.sexo) ?? null, pesoNacerKg: num(cr.pesoKg) ?? null, caravanaVisual: str(cr.caravana, 30) ?? null }
        })
        const fecha = diaDe(i.fecha)
        const payload = { madreId: madre.id, fecha, aborto, crias, tipoParto: enumDe(TIPOS_PARTO, i.tipoParto) ?? null, observ: str(i.observ, 1000) ?? null }
        paricionSchema.parse(payload)
        return {
          payload,
          resumen: [
            `🐄 *${aborto ? "Aborto" : ETIQUETA_ACCION.parto}* · ${dm(fecha)}`, `• Madre: ${madre.etiqueta}`,
            ...crias.map((cr, k) => `• Cría${crias.length > 1 ? ` ${k + 1}` : ""}: ${cr.resultado === "vivo" ? "viva" : "muerta"}${cr.sexo ? ` · ${cr.sexo === "M" ? "macho" : "hembra"}` : ""}${cr.pesoNacerKg ? ` · ${fmt(cr.pesoNacerKg)} kg` : ""}${cr.caravanaVisual ? ` · caravana ${cr.caravanaVisual}` : ""}`),
            ...(payload.tipoParto ? [`• Parto: ${payload.tipoParto}`] : []),
          ].join("\n"),
        }
      })(),
    }),

    herramienta({
      name: "proponer_celos",
      description: "Prepara el registro de celos detectados en una o varias hembras (a la mañana o a la tarde).",
      inputSchema: {
        type: "object",
        properties: { caravanas: CARAVANAS, momento: { type: "string", enum: [...MOMENTOS_CELO] }, metodo: { type: "string", enum: [...METODOS_CELO] }, fecha: FECHA },
        required: ["caravanas", "momento"],
        additionalProperties: false,
      },
      run: (i) => proponer("celo", async (id) => {
        const hembras = await resolverAnimales(establecimientoId, lista(i.caravanas), "F")
        const momento = enumDe(MOMENTOS_CELO, i.momento)
        if (!momento) throw new Problema("Falta si el celo fue a la mañana o a la tarde.")
        const fecha = diaDe(i.fecha)
        const payload = { clave: id, establecimientoId, fecha, momento, metodo: enumDe(METODOS_CELO, i.metodo) ?? "observado", identificadores: hembras.map((h) => h.identificador) }
        cargaRapidaCeloSchema.parse(payload)
        return {
          payload,
          resumen: [`💗 *${ETIQUETA_ACCION.celo}* · ${dm(fecha)} a la ${momento === "manana" ? "mañana" : "tarde"}`, `• Hembras (${hembras.length}): ${listaAnimales(hembras)}`].join("\n"),
        }
      })(),
    }),
  ]
}

/** Para tests */
export const _internos = { resolverAnimales, resolverGrupo, resolverProducto }
