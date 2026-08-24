// Utilidades puras para la auditoría: normalizar valores para JSON y calcular
// el diff entre el estado anterior y el nuevo de un registro.
// Sin dependencias de Prisma ni de la red → fácil de testear.

export type Registro = Record<string, unknown>

// Campos que no aportan a "qué cambió" (ruido de timestamps).
const CAMPOS_RUIDO = new Set(["createdAt", "updatedAt"])

/**
 * Convierte valores no serializables (Decimal de Prisma, Date, BigInt) a algo
 * que entra limpio en una columna JSON. Recursivo para objetos y arrays.
 */
export function sanitizar(valor: unknown): unknown {
  if (valor === null || valor === undefined) return valor

  if (typeof valor === "bigint") return Number(valor)

  if (typeof valor === "object") {
    const obj = valor as Record<string, unknown> & {
      toNumber?: () => number
      toFixed?: (n?: number) => string
    }
    // Decimal de Prisma (decimal.js): tiene toNumber y toFixed.
    if (typeof obj.toNumber === "function" && typeof obj.toFixed === "function") {
      return obj.toNumber()
    }
    if (valor instanceof Date) return valor.toISOString()
    if (Array.isArray(valor)) return valor.map(sanitizar)

    const salida: Registro = {}
    for (const [k, v] of Object.entries(valor)) salida[k] = sanitizar(v)
    return salida
  }

  return valor
}

/**
 * Calcula los campos que cambiaron entre `antes` y `despues`.
 * Devuelve { campo: { de, a } } solo para los que difieren (ignora ruido).
 */
export function computarCambios(
  antes: Registro | null,
  despues: Registro | null
): Record<string, { de: unknown; a: unknown }> {
  const cambios: Record<string, { de: unknown; a: unknown }> = {}
  const claves = new Set<string>([
    ...(antes ? Object.keys(antes) : []),
    ...(despues ? Object.keys(despues) : []),
  ])

  for (const clave of claves) {
    if (CAMPOS_RUIDO.has(clave)) continue
    const de = antes ? antes[clave] : undefined
    const a = despues ? despues[clave] : undefined
    // Comparación estable por su representación JSON normalizada.
    if (JSON.stringify(sanitizar(de)) !== JSON.stringify(sanitizar(a))) {
      cambios[clave] = { de: sanitizar(de), a: sanitizar(a) }
    }
  }

  return cambios
}
