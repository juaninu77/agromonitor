import { z } from "zod"

const positiveInteger = z.string().regex(/^[1-9]\d*$/).transform(Number)
  .refine(Number.isSafeInteger)

const paginationSchema = z.object({
  page: positiveInteger.default("1"),
  limit: positiveInteger.default("20").refine((value) => value <= 100, "Máximo 100 registros por página"),
}).refine(({ page, limit }) => Number.isSafeInteger((page - 1) * limit), "Página fuera de rango")

/** Reject malformed or unbounded queries before passing skip/take to Prisma. */
export function parsePagination(params: URLSearchParams) {
  return paginationSchema.safeParse({
    page: params.get("page") ?? undefined,
    limit: params.get("limit") ?? undefined,
  })
}
