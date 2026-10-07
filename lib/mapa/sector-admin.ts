import type { Prisma } from "@prisma/client"

/**
 * Motivos por los que un lugar no se puede archivar: animales ubicados, un
 * grupo pastoreando o reservas con stock en el galpón. Archivar nunca borra datos.
 */
export async function bloqueosParaArchivar(tx: Prisma.TransactionClient, sectorId: string): Promise<string[]> {
  const [animales, pastoreos, reservas] = await Promise.all([
    tx.ubicacionHist.count({ where: { sectorId, hasta: null, animal: { estadoVital: "activo" } } }),
    tx.evtPastoreo.count({ where: { sectorId, egreso: null } }),
    tx.reservaForraje.count({ where: { depositoId: sectorId, stock: { gt: 0 } } }),
  ])
  return [
    ...(animales ? [`tiene ${animales} ${animales === 1 ? "animal ubicado" : "animales ubicados"}`] : []),
    ...(pastoreos ? ["tiene un grupo pastoreando"] : []),
    ...(reservas ? ["guarda reservas con stock"] : []),
  ]
}
