// Herramientas de solo lectura del asistente de WhatsApp. Cada una trabaja sobre el
// campo activo del usuario (el modelo nunca elige el campo ni ve ids de otros
// tenants) y reutiliza los servicios de la app, que aplican los mismos permisos.

import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages"
import { Prisma } from "@prisma/client"
import type { AuthContext } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { normalizeEID } from "@/lib/hardware/eid"
import { hoyArgentina } from "@/lib/inventario/fechas"
import { CERO, saldosPorLote, saldosPorProducto } from "@/lib/inventario/stock"
import { animalesBajoRetiro, resumenSanidad } from "@/lib/sanidad/service"
import { tareasDelPlan } from "@/lib/sanidad/calendario"
import { retirosVigentes } from "@/lib/sanidad/retiro"
import { resumenReproduccion } from "@/lib/reproduccion/service"
import { agendaReproductiva } from "@/lib/reproduccion/agenda"
import { estadosReproductivos } from "@/lib/reproduccion/estado"
import { ETIQUETA_ESTADO_REPRODUCTIVO } from "@/lib/reproduccion/validation"
import { fieldSectors } from "@/lib/mapa/sector-data"
import { textoEspecies } from "@/lib/mapa/carga"
import { resumenFinanzas } from "@/lib/finanzas/resumen"

export interface ContextoConsulta {
  ctx: AuthContext
  establecimientoId: string
  organizacionId: string
}

const num = (d: Prisma.Decimal | null | undefined) => (d == null ? null : Number(d))
const dia = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)
const json = (v: unknown) => JSON.stringify(v)

/** Un error de permisos o de datos vuelve al modelo como texto, para que lo explique. */
async function seguro(fn: () => Promise<unknown>): Promise<string> {
  try {
    return json(await fn())
  } catch (e) {
    const status = (e as { status?: number }).status
    if (status === 403) return json({ error: "El usuario no tiene permiso para ver esta información en este campo." })
    if (status && status < 500 && e instanceof Error) return json({ error: e.message })
    console.error("Error en una consulta del asistente de WhatsApp", e)
    return json({ error: "No se pudo consultar ahora." })
  }
}

const sinParametros = { type: "object" as const, properties: {}, additionalProperties: false }

/** Definición para Claude + la función que la ejecuta (las entradas vienen del modelo: se validan acá). */
export interface Herramienta {
  definicion: BetaTool
  run: (input: Record<string, unknown>) => Promise<string>
}

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : undefined)

export function herramienta(d: { name: string; description: string; inputSchema: BetaTool["input_schema"]; run: (input: Record<string, unknown>) => Promise<string> }): Herramienta {
  return { definicion: { name: d.name, description: d.description, input_schema: d.inputSchema }, run: d.run }
}

export function herramientasConsulta(c: ContextoConsulta): Herramienta[] {
  const { ctx, establecimientoId, organizacionId } = c
  return [
    herramienta({
      name: "resumen_rodeo",
      description: "Cantidad de animales activos del campo por especie y categoría.",
      inputSchema: sinParametros,
      run: () => seguro(async () => {
        const filas = await prisma.$queryRaw<{ especie: string; categoria: string | null; sexo: string; cantidad: number }[]>`
          SELECT e.nombre AS especie, c.nombre AS categoria, a.sexo, count(*)::int AS cantidad
          FROM animales a JOIN especies e ON e.id = a.especie_id LEFT JOIN categorias c ON c.id = a.categoria_id
          WHERE a.establecimiento_id = ${establecimientoId}::uuid AND a.estado_vital = 'activo'
          GROUP BY 1, 2, 3 ORDER BY 1, 4 DESC`
        return { total: filas.reduce((s, f) => s + Number(f.cantidad), 0), porCategoria: filas.map((f) => ({ ...f, cantidad: Number(f.cantidad) })) }
      }),
    }),

    herramienta({
      name: "buscar_animal",
      description: "Busca animales del campo por caravana visual, CUIG, número interno o caravana electrónica (EID). Devuelve categoría, grupo, potrero, última pesada, estado reproductivo y retiro sanitario.",
      inputSchema: {
        type: "object",
        properties: { identificador: { type: "string", description: "Caravana, CUIG, número interno o EID tal como lo dijo el usuario" } },
        required: ["identificador"],
        additionalProperties: false,
      },
      run: (input) => seguro(async () => {
        const id = texto(input.identificador)
        if (!id) return { error: "Falta el identificador del animal." }
        const eid = normalizeEID(id)
        const animales = await prisma.animal.findMany({
          where: {
            establecimientoId,
            OR: [
              { caravanaVisual: { equals: id, mode: "insensitive" } },
              { cuig: { equals: id, mode: "insensitive" } },
              { otroId: { equals: id, mode: "insensitive" } },
              ...(eid ? [{ caravanaRfid: eid }] : []),
            ],
          },
          take: 5,
          select: {
            id: true, caravanaVisual: true, cuig: true, caravanaRfid: true, otroId: true, sexo: true, fechaNacimiento: true, estadoVital: true,
            especie: { select: { nombre: true } }, raza: { select: { nombre: true } }, categoria: { select: { nombre: true } },
            loteHist: { where: { hasta: null }, select: { lote: { select: { nombre: true } } }, take: 1 },
            ubicacionHist: { where: { hasta: null }, select: { sector: { select: { nombre: true } } }, take: 1 },
            eventosPesada: { orderBy: { fecha: "desc" }, take: 1, select: { fecha: true, pesoKg: true } },
          },
        })
        if (!animales.length) return { encontrados: 0 }
        const ids = animales.map((a) => a.id)
        const [estados, retiros] = await Promise.all([estadosReproductivos(ids.filter((_, i) => animales[i].sexo === "F")), retirosVigentes(prisma, { animalIds: ids })])
        return {
          encontrados: animales.length,
          animales: animales.map((a) => {
            const est = estados.get(a.id)
            const ret = retiros.get(a.id)
            return {
              caravana: a.caravanaVisual, cuig: a.cuig, eid: a.caravanaRfid, numeroInterno: a.otroId,
              especie: a.especie.nombre, raza: a.raza?.nombre ?? null, categoria: a.categoria?.nombre ?? null, sexo: a.sexo,
              nacimiento: dia(a.fechaNacimiento), estado: a.estadoVital,
              grupo: a.loteHist[0]?.lote.nombre ?? null, potrero: a.ubicacionHist[0]?.sector.nombre ?? null,
              ultimaPesada: a.eventosPesada[0] ? { fecha: dia(a.eventosPesada[0].fecha), kg: a.eventosPesada[0].pesoKg } : null,
              estadoReproductivo: est ? { estado: ETIQUETA_ESTADO_REPRODUCTIVO[est.estado], desde: est.desde, partoProbable: est.fechaProbableParto } : null,
              retiroHasta: ret ? { hasta: ret.hasta, producto: ret.producto } : null,
            }
          }),
        }
      }),
    }),

    herramienta({
      name: "stock_insumos",
      description: "Stock de insumos de la organización (vacunas, antiparasitarios, alimento, combustible, etc.). Con `buscar` filtra por nombre o principio activo; sin `buscar` devuelve solo los que están en stock bajo o con lotes por vencer.",
      inputSchema: {
        type: "object",
        properties: { buscar: { type: "string", description: "Parte del nombre del producto o del principio activo" } },
        additionalProperties: false,
      },
      run: (input) => seguro(async () => {
        const q = texto(input.buscar)
        const productos = await prisma.producto.findMany({
          where: {
            organizacionId, activo: true,
            ...(q ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { principioActivo: { contains: q, mode: "insensitive" } }] } : {}),
          },
          orderBy: { nombre: "asc" },
          take: q ? 15 : 300,
          select: { id: true, nombre: true, tipo: true, unidad: true, stockMinimo: true, lotes: { where: { vencimiento: { not: null } }, select: { id: true, nroLote: true, vencimiento: true } } },
        })
        const ids = productos.map((p) => p.id)
        const [saldos, { porLote }] = await Promise.all([saldosPorProducto(prisma, ids), saldosPorLote(prisma, ids)])
        const hoy = hoyArgentina()
        const en60 = new Date(Date.parse(`${hoy}T00:00:00Z`) + 60 * 86_400_000)
        const filas = productos.map((p) => {
          const saldo = saldos.get(p.id) ?? CERO
          const lotes = p.lotes
            .map((l) => ({ lote: l.nroLote, vence: dia(l.vencimiento), saldo: num(porLote.get(l.id) ?? CERO)! }))
            .filter((l) => l.saldo > 0)
            .sort((a, b) => (a.vence ?? "").localeCompare(b.vence ?? ""))
          return {
            producto: p.nombre, tipo: p.tipo, unidad: p.unidad, stock: num(saldo), minimo: num(p.stockMinimo),
            stockBajo: p.stockMinimo != null && saldo.lte(p.stockMinimo),
            lotesPorVencer: lotes.filter((l) => l.vence && l.vence <= dia(en60)!).slice(0, 3),
          }
        })
        return q ? { productos: filas } : { alertas: filas.filter((f) => f.stockBajo || f.lotesPorVencer.length).slice(0, 20) }
      }),
    }),

    herramienta({
      name: "sanidad_resumen",
      description: "Sanidad del mes: tratamientos, casos curativos, animales tratados, productos más usados y cantidad de animales bajo retiro.",
      inputSchema: sinParametros,
      run: () => seguro(async () => {
        const r = await resumenSanidad(ctx, { establecimientoId })
        return { ...r, calendario: undefined }
      }),
    }),

    herramienta({
      name: "animales_en_retiro",
      description: "Animales del campo bajo período de retiro (carencia) por un tratamiento, con la fecha en que se liberan.",
      inputSchema: sinParametros,
      run: () => seguro(async () => {
        const r = await animalesBajoRetiro(ctx, { establecimientoId })
        return { total: r.length, animales: r.slice(0, 30).map((x) => ({ caravana: x.animal.caravanaVisual ?? x.animal.cuig ?? x.animal.otroId, categoria: x.animal.categoria, hasta: x.hasta, producto: x.producto })) }
      }),
    }),

    herramienta({
      name: "plan_sanitario",
      description: "Tareas del plan sanitario del campo (vacunaciones y tratamientos programados).",
      inputSchema: {
        type: "object",
        properties: { estado: { type: "string", enum: ["pendientes", "vencidas"], description: "pendientes (por defecto) o solo las vencidas" } },
        additionalProperties: false,
      },
      run: (input) => seguro(async () => {
        const t = await tareasDelPlan(ctx, { establecimientoId, estado: input.estado === "vencidas" ? "vencidas" : "pendientes", limite: 20 })
        return t.map((x) => ({ tarea: x.titulo, fecha: x.fecha, vencida: x.vencida, producto: x.item?.producto?.nombre ?? null, grupo: x.calendario?.lote?.nombre ?? null }))
      }),
    }),

    herramienta({
      name: "reproduccion_resumen",
      description: "Indicadores de reproducción del campo: servidas sin tactar, % de preñez, preñadas a parir, partos atrasados y próximos 30 días, partos y destetes del año.",
      inputSchema: sinParametros,
      run: () => seguro(() => resumenReproduccion(ctx, establecimientoId)),
    }),

    herramienta({
      name: "agenda_reproductiva",
      description: "Pendientes reproductivos: tactos a hacer, partos previstos, señaladas, destetes y hembras para inseminar.",
      inputSchema: sinParametros,
      run: () => seguro(async () => {
        const a = await agendaReproductiva(establecimientoId)
        return a.slice(0, 20).map((p) => ({ tipo: p.tipo, titulo: p.titulo, detalle: p.detalle, fecha: p.fecha, vencida: p.vencida, cantidad: p.cantidad }))
      }),
    }),

    herramienta({
      name: "potreros",
      description: "Lugares del campo (potreros, corrales, etc.) con animales, carga en EV y EV/ha, días de ocupación o de descanso y forraje.",
      inputSchema: sinParametros,
      run: () => seguro(async () => {
        const s = await fieldSectors([establecimientoId])
        return s
          .filter((x) => ["potrero", "corral", "feedlot", "manga"].includes(x.tipo) || x.animales > 0)
          .slice(0, 40)
          .map((x) => ({
            nombre: x.nombre, tipo: x.tipo, superficieHa: x.superficieHa ?? x.areaMapaHa, animales: x.animales, detalle: textoEspecies(x.porEspecie) || null,
            ev: x.ev, evHa: x.evHa, diasOcupacion: x.diasOcupacion, diasDescanso: x.diasDescanso,
            forraje: x.forrajes.map((f) => f.forraje.nombre).join(", ") || null,
          }))
      }),
    }),

    herramienta({
      name: "tareas_pendientes",
      description: "Tareas pendientes o en curso del campo (todas, o solo las asignadas al usuario), ordenadas por fecha límite.",
      inputSchema: {
        type: "object",
        properties: { soloMias: { type: "boolean", description: "true para ver solo las asignadas al usuario" } },
        additionalProperties: false,
      },
      run: (input) => seguro(async () => {
        const soloMias = input.soloMias === true
        const hoy = hoyArgentina()
        const t = await prisma.tarea.findMany({
          where: { establecimientoId, estado: { in: ["pendiente", "en_progreso"] }, ...(soloMias ? { asignadoAId: ctx.userId } : {}) },
          orderBy: [{ fechaLimite: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
          take: 20,
          select: { titulo: true, tipo: true, prioridad: true, estado: true, fechaLimite: true, asignadoA: { select: { nombre: true } } },
        })
        return t.map((x) => ({ ...x, fechaLimite: x.fechaLimite ? hoyArgentina(x.fechaLimite) : null, vencida: !!x.fechaLimite && hoyArgentina(x.fechaLimite) < hoy, asignadoA: x.asignadoA?.nombre ?? null }))
      }),
    }),

    herramienta({
      name: "finanzas_resumen",
      description: "Ingresos, egresos y resultado del período por moneda, gastos por categoría, saldos de cuentas y comprobantes pendientes del campo. Solo para administradores y encargados. Fechas AAAA-MM-DD; por defecto, el mes en curso.",
      inputSchema: {
        type: "object",
        properties: { desde: { type: "string", description: "AAAA-MM-DD" }, hasta: { type: "string", description: "AAAA-MM-DD" } },
        additionalProperties: false,
      },
      run: (input) => seguro(async () => {
        const hoy = hoyArgentina()
        const valido = (d: unknown) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) ? d : undefined)
        const r = await resumenFinanzas(ctx, { establecimientoId, desde: valido(input.desde) ?? `${hoy.slice(0, 7)}-01`, hasta: valido(input.hasta) ?? hoy })
        return { totales: r.totales, porCategoria: r.porCategoria.slice(0, 10), impuestos: r.impuestos, cuentas: r.cuentas, pendientes: r.pendientes }
      }),
    }),
  ]
}
