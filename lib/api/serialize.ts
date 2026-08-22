// Serialización de valores Prisma para respuestas de API.
// Los campos Decimal (dinero) se guardan con precisión exacta en la BD, pero
// Prisma los serializa a JSON como string. El contrato con el cliente es
// `number | null`, así que se convierten en la frontera de la API.

import { Prisma } from "@prisma/client"

type DecimalLike = Prisma.Decimal | number | string | null | undefined

/** Convierte un Decimal (o null) a number preservando null. */
export function decimalToNumber(valor: DecimalLike): number | null {
  if (valor === null || valor === undefined) return null
  return typeof valor === "number" ? valor : Number(valor)
}
