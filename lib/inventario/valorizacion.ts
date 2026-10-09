// Valorización del stock: el saldo de cada lote por su costo por unidad (en la moneda del
// lote); lo que no tiene lote, o un lote sin costo, por el costo de referencia del producto.
// Los totales son siempre por moneda (ARS y USD nunca se suman).

import { Prisma } from "@prisma/client"
import type { Valores } from "./formato-valor"
import { CERO } from "./stock"

export type Moneda = "ARS" | "USD"
export type { Valores }

export interface ProductoValorizable {
  costoReferencia: Prisma.Decimal | null
  monedaCosto: string
  lotes: { id: string; costo: Prisma.Decimal | null; moneda: string }[]
}

export interface Valorizacion {
  valores: Valores
  /** Cantidad con saldo que no se pudo valorizar (sin costo de lote ni de referencia). */
  sinCosto: number
}

const moneda = (m: string): Moneda => (m === "USD" ? "USD" : "ARS")
const redondear = (d: Prisma.Decimal) => d.toDecimalPlaces(2).toNumber()

/**
 * Valoriza un producto con sus saldos por lote (`porLote`) y sin lote (`sinLote`).
 * Los saldos negativos o nulos no suman.
 */
export function valorizarProducto(p: ProductoValorizable, porLote: Map<string, Prisma.Decimal>, sinLote: Prisma.Decimal): Valorizacion {
  const acum = new Map<Moneda, Prisma.Decimal>()
  let sinCosto = CERO
  const sumar = (cant: Prisma.Decimal, costo: Prisma.Decimal | null, m: string) => {
    if (cant.lte(0)) return
    if (costo == null) { sinCosto = sinCosto.plus(cant); return }
    acum.set(moneda(m), (acum.get(moneda(m)) ?? CERO).plus(cant.times(costo)))
  }
  for (const l of p.lotes) {
    const saldo = porLote.get(l.id) ?? CERO
    if (l.costo != null) sumar(saldo, l.costo, l.moneda)
    else sumar(saldo, p.costoReferencia, p.monedaCosto)
  }
  sumar(sinLote, p.costoReferencia, p.monedaCosto)
  const valores: Valores = {}
  for (const [m, v] of acum) valores[m] = redondear(v)
  return { valores, sinCosto: sinCosto.toDecimalPlaces(3).toNumber() }
}

/** Suma valores por moneda (sin mezclar monedas). */
export function sumarValores(lista: Valores[]): Valores {
  const total: Valores = {}
  for (const v of lista) for (const m of Object.keys(v) as Moneda[]) total[m] = Math.round(((total[m] ?? 0) + (v[m] ?? 0)) * 100) / 100
  return total
}
