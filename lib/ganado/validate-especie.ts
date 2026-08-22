// Validación de coherencia especie/raza/categoría.
// La raza y la categoría de un animal deben pertenecer a su misma especie.

import { prisma } from "@/lib/prisma"

/**
 * Devuelve un mensaje de error si la raza o la categoría no corresponden
 * a la especie indicada, o null si la combinación es válida.
 *
 * Si se pasa `organizacionIds`, además se exige que la raza y la categoría
 * pertenezcan a alguna de esas organizaciones (scoping multi-tenant). Si no
 * se pasa, el comportamiento es el histórico (sin filtro por organización).
 */
export async function validarRazaYCategoriaParaEspecie(
  especieId: string,
  razaId?: string | null,
  categoriaId?: string | null,
  organizacionIds?: string[]
): Promise<string | null> {
  const scopeOrg = organizacionIds
    ? { organizacionId: { in: organizacionIds } }
    : {}

  if (razaId) {
    const raza = await prisma.raza.findFirst({
      where: { id: razaId, ...scopeOrg },
      select: { especieId: true, nombre: true },
    })
    if (!raza) {
      return organizacionIds
        ? "La raza no pertenece a la organización"
        : "Raza no encontrada"
    }
    if (raza.especieId !== especieId) {
      return `La raza "${raza.nombre}" no corresponde a la especie del animal`
    }
  }

  if (categoriaId) {
    const categoria = await prisma.categoria.findFirst({
      where: { id: categoriaId, ...scopeOrg },
      select: { especieId: true, nombre: true },
    })
    if (!categoria) {
      return organizacionIds
        ? "La categoría no pertenece a la organización"
        : "Categoría no encontrada"
    }
    if (categoria.especieId !== especieId) {
      return `La categoría "${categoria.nombre}" no corresponde a la especie del animal`
    }
  }

  return null
}
