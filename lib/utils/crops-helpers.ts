/**
 * Funciones helper para la gestión de cultivos
 * Extraídas fuera de los componentes para mejor rendimiento
 */

/**
 * Obtiene el color CSS para la barra de progreso del estado fenológico
 */
export const getStageColor = (progress: number): string => {
  if (progress >= 80) return "bg-green-500"
  if (progress >= 60) return "bg-blue-500"
  if (progress >= 40) return "bg-yellow-500"
  return "bg-gray-400"
}

/**
 * Obtiene las clases CSS para el nivel de riesgo
 */
export const getRiskColor = (risk: string): string => {
  switch (risk) {
    case "Muy Bajo":
      return "bg-green-100 text-green-800 border-green-200"
    case "Bajo":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "Medio":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "Alto":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "Crítico":
      return "bg-red-100 text-red-800 border-red-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

/**
 * Obtiene las clases CSS para el estado de salud del cultivo
 */
export const getHealthStatusColor = (status: string): string => {
  switch (status) {
    case "Excelente":
      return "bg-green-100 text-green-800 border-green-200"
    case "Bueno":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "Regular":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "Malo":
      return "bg-red-100 text-red-800 border-red-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

