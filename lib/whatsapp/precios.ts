// Precios de Claude (USD por millón de tokens) para ESTIMAR el costo de cada consulta.
// El gasto real lo informa Anthropic (Usage & Cost API, ver costos.ts); esto sirve para
// repartirlo por usuario, campo y tipo de consulta. Escritura de caché: duración de 5 minutos
// (1,25 × entrada), la que usa el asistente. Revisar al cambiar de modelo.

export interface PrecioModelo { entrada: number; salida: number; cacheLectura: number; cacheEscritura: number }

const PRECIOS: Record<string, PrecioModelo> = {
  "claude-opus-5-5": { entrada: 4, salida: 20, cacheLectura: 0.2, cacheEscritura: 5 },
  "claude-opus-5": { entrada: 5, salida: 25, cacheLectura: 0.5, cacheEscritura: 6.25 },
  "claude-opus-4-8": { entrada: 5, salida: 25, cacheLectura: 0.5, cacheEscritura: 6.25 },
  "claude-sonnet-5-5": { entrada: 2, salida: 10, cacheLectura: 0.2, cacheEscritura: 2.5 },
  "claude-haiku-5-5": { entrada: 0.1, salida: 0.5, cacheLectura: 0.01, cacheEscritura: 0.125 },
  "claude-fable-5-1": { entrada: 10, salida: 50, cacheLectura: 0.25, cacheEscritura: 12.5 },
}

/** Un modelo desconocido se estima con el del asistente (claude-opus-5-5). */
export function precioDe(modelo: string | null | undefined): PrecioModelo {
  return (modelo && PRECIOS[modelo]) || PRECIOS["claude-opus-5-5"]
}

export interface Tokens { entrada: number; salida: number; cacheLeidos: number; cacheEscritos: number }

export function costoEstimadoUsd(modelo: string | null | undefined, t: Tokens): number {
  const p = precioDe(modelo)
  return (t.entrada * p.entrada + t.salida * p.salida + t.cacheLeidos * p.cacheLectura + t.cacheEscritos * p.cacheEscritura) / 1_000_000
}
