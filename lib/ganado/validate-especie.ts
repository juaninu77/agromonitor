// Validación de coherencia especie/raza/categoría.
// La raza y la categoría de un animal deben pertenecer a su misma especie.

import { prisma } from "@/lib/prisma"

/**
 * Devuelve un mensaje de error si la raza o la categoría no corresponden
 * a la especie indicada, o null si la combinación es válida.
 */
export async function validarRazaYCategoriaParaEspecie(
  especieId: string,
  razaId?: string | null,
  categoriaId?: string | null
): Promise<string | null> {
  if (razaId) {
    const raza = await prisma.raza.findUnique({
      where: { id: razaId },
      select: { especieId: true, nombre: true },
    })
    if (!raza) return "Raza no encontrada"
    if (raza.especieId !== especieId) {
      return `La raza "${raza.nombre}" no corresponde a la especie del animal`
    }
  }

  if (categoriaId) {
    const categoria = await prisma.categoria.findUnique({
      where: { id: categoriaId },
      select: { especieId: true, nombre: true },
    })
    if (!categoria) return "Categoría no encontrada"
    if (categoria.especieId !== especieId) {
      return `La categoría "${categoria.nombre}" no corresponde a la especie del animal`
    }
  }

  return null
}
