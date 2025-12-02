/**
 * Funciones helper para la gestión de ganado
 * Extraídas fuera de los componentes para mejor rendimiento
 */

/**
 * Obtiene el color CSS para la condición corporal
 * Escala 1-9 para ganado de carne
 */
export const getBodyConditionColor = (score: number): string => {
  if (score >= 6.0 && score <= 7.0) return "text-green-600"
  if (score >= 5.0 && score < 6.0) return "text-yellow-600"
  if (score > 7.0 && score <= 8.0) return "text-orange-600"
  return "text-red-600"
}

/**
 * Obtiene las clases CSS para el estado de salud
 */
export const getHealthStatusColor = (status: string): string => {
  switch (status) {
    case "Saludable":
      return "bg-green-100 text-green-800 border-green-200"
    case "Atención":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "Tratamiento":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "Crítico":
      return "bg-red-100 text-red-800 border-red-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

/**
 * Obtiene las clases CSS para la categoría del animal
 */
export const getCategoryColor = (category: string): string => {
  switch (category) {
    case "Toro Reproductor":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "Vaca Madre":
      return "bg-pink-100 text-pink-800 border-pink-200"
    case "Novillo":
      return "bg-green-100 text-green-800 border-green-200"
    case "Vaquillona":
      return "bg-purple-100 text-purple-800 border-purple-200"
    case "Ternero":
      return "bg-orange-100 text-orange-800 border-orange-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

