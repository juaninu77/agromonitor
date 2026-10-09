// Consumo de stock de una aplicación sanitaria (apto para el cliente).

const norm = (u: string | null | undefined) => (u ?? "").trim().toLowerCase()

/**
 * Cuánto stock consume una aplicación, en la unidad del producto; null si no se puede
 * deducir (p. ej. el producto se cuenta en frascos y la dosis está en ml: lo decide el usuario).
 */
export function consumoSugerido(unidadProducto: string, dosis: number | null | undefined, unidadDosis: string | null | undefined, animales: number): number | null {
  const up = norm(unidadProducto), ud = norm(unidadDosis)
  if (animales <= 0) return null
  if (up === "dosis") return animales
  if (!dosis || dosis <= 0) return null
  const redondear = (n: number) => Math.round(n * 1000) / 1000
  if ((up === "ml" || up === "cc") && (!ud || ud === "ml" || ud === "cc")) return redondear(dosis * animales)
  if ((up === "litros" || up === "l") && (!ud || ud === "ml" || ud === "cc")) return redondear((dosis * animales) / 1000)
  if ((up === "comprimidos" || up === "comprimido") && (!ud || ud === "comprimido")) return redondear(dosis * animales)
  if (up === ud) return redondear(dosis * animales)
  return null
}
