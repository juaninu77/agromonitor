// Tablero de finanzas: totales del período, evolución mensual, gastos por
// categoría e impuestos. Se agrega en SQL (una sola consulta agrupada) y las
// transferencias entre cuentas no cuentan como ingreso ni egreso.

import type { AuthContext } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { CATEGORIA_TRANSFERENCIA } from "./constantes"
import { camposLectura, listarCuentas, redondear } from "./service"

export interface FilaResumen {
  mes: string // AAAA-MM
  moneda: string
  tipo: string
  categoria: string
  subcategoria: string | null
  total: string | number
}

interface Totales {
  ingresos: number
  egresos: number
  resultado: number
}

export interface ResumenFinanzas {
  totales: Record<string, Totales>
  mensual: Array<{ mes: string; moneda: string } & Totales>
  porCategoria: Array<{ tipo: string; categoria: string; moneda: string; total: number }>
  impuestos: Array<{ subcategoria: string; moneda: string; total: number }>
}

/** Meses AAAA-MM entre dos fechas AAAA-MM-DD, inclusive (máximo 36). */
export function mesesEntre(desde: string, hasta: string): string[] {
  const meses: string[] = []
  let [anio, mes] = desde.slice(0, 7).split("-").map(Number)
  const fin = hasta.slice(0, 7)
  while (meses.length < 36) {
    const actual = `${anio}-${String(mes).padStart(2, "0")}`
    if (actual > fin) break
    meses.push(actual)
    mes += 1
    if (mes > 12) {
      mes = 1
      anio += 1
    }
  }
  return meses
}

/** Combina las filas agrupadas (exportado para testear sin base). */
export function agregarResumen(filas: FilaResumen[], desde: string, hasta: string): ResumenFinanzas {
  const totales: Record<string, Totales> = {}
  const mensual = new Map<string, { mes: string; moneda: string } & Totales>()
  const porCategoria = new Map<string, { tipo: string; categoria: string; moneda: string; total: number }>()
  const impuestos = new Map<string, { subcategoria: string; moneda: string; total: number }>()

  const monedas = new Set<string>(filas.map((f) => f.moneda))
  if (monedas.size === 0) monedas.add("ARS")
  // Todos los meses del rango, aunque no tengan movimientos (para el gráfico)
  for (const moneda of monedas) {
    totales[moneda] = { ingresos: 0, egresos: 0, resultado: 0 }
    for (const mes of mesesEntre(desde, hasta)) mensual.set(`${moneda}|${mes}`, { mes, moneda, ingresos: 0, egresos: 0, resultado: 0 })
  }

  for (const f of filas) {
    const total = Number(f.total)
    const campo = f.tipo === "ingreso" ? "ingresos" : "egresos"
    totales[f.moneda][campo] += total
    const m = mensual.get(`${f.moneda}|${f.mes}`)
    if (m) m[campo] += total

    const claveCat = `${f.moneda}|${f.tipo}|${f.categoria}`
    const cat = porCategoria.get(claveCat) ?? { tipo: f.tipo, categoria: f.categoria, moneda: f.moneda, total: 0 }
    cat.total += total
    porCategoria.set(claveCat, cat)

    if (f.categoria === "impuestos") {
      const sub = f.subcategoria ?? "otro_impuesto"
      const claveImp = `${f.moneda}|${sub}`
      const imp = impuestos.get(claveImp) ?? { subcategoria: sub, moneda: f.moneda, total: 0 }
      imp.total += total
      impuestos.set(claveImp, imp)
    }
  }

  const cerrar = (t: Totales) => {
    t.ingresos = redondear(t.ingresos)
    t.egresos = redondear(t.egresos)
    t.resultado = redondear(t.ingresos - t.egresos)
  }
  Object.values(totales).forEach(cerrar)
  mensual.forEach(cerrar)

  return {
    totales,
    mensual: [...mensual.values()].sort((a, b) => a.moneda.localeCompare(b.moneda) || a.mes.localeCompare(b.mes)),
    porCategoria: [...porCategoria.values()]
      .map((c) => ({ ...c, total: redondear(c.total) }))
      .sort((a, b) => b.total - a.total),
    impuestos: [...impuestos.values()].map((i) => ({ ...i, total: redondear(i.total) })).sort((a, b) => b.total - a.total),
  }
}

export async function resumenFinanzas(ctx: AuthContext, filtro: { establecimientoId?: string; desde: string; hasta: string }) {
  const campos = camposLectura(ctx, filtro.establecimientoId)
  if (campos.length === 0) {
    return { ...agregarResumen([], filtro.desde, filtro.hasta), cuentas: [], pendientes: [] }
  }

  const [filas, cuentas, pendientes] = await Promise.all([
    prisma.$queryRaw<FilaResumen[]>`
      SELECT to_char(m.fecha, 'YYYY-MM') AS mes,
             c.moneda,
             m.tipo,
             m.categoria,
             m.subcategoria,
             sum(m.importe)::text AS total
      FROM movimientos_financieros m
      JOIN cuentas_financieras c ON c.id = m.cuenta_id
      WHERE m.establecimiento_id = ANY(${campos}::uuid[])
        AND m.fecha BETWEEN ${filtro.desde}::date AND ${filtro.hasta}::date
        AND m.categoria <> ${CATEGORIA_TRANSFERENCIA}
      GROUP BY 1, 2, 3, 4, 5
    `,
    listarCuentas(ctx, filtro.establecimientoId, false),
    // Comprobantes de Administración todavía sin pagar/cobrar
    prisma.comprobante.groupBy({
      by: ["sentido", "moneda"],
      where: { establecimientoId: { in: campos }, estado: "pendiente" },
      _sum: { importe: true },
      _count: { _all: true },
    }),
  ])

  return {
    ...agregarResumen(filas, filtro.desde, filtro.hasta),
    cuentas,
    pendientes: pendientes.map((p) => ({
      sentido: p.sentido,
      moneda: p.moneda,
      cantidad: p._count._all,
      total: Number(p._sum.importe?.toString() ?? 0),
    })),
  }
}
