import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export class MangaSessionError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

/** All session writers take the same row lock, including CSV imports and closing. */
export async function withMangaSession<T>(
  id: string,
  establecimientoIds: string[],
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.sesionManga.updateMany({
      where: { id, establecimientoId: { in: establecimientoIds }, estado: { not: "finalizada" } },
      data: { totalAnimales: { increment: 0 } },
    })
    if (locked.count === 0) {
      const session = await tx.sesionManga.findFirst({
        where: { id, establecimientoId: { in: establecimientoIds } },
        select: { id: true },
      })
      throw new MangaSessionError(session ? "La sesión ya está finalizada" : "Sesión no encontrada", session ? 409 : 404)
    }
    return operation(tx)
  }, { maxWait: 10000, timeout: 30000 })
}
