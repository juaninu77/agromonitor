/**
 * Utilidades de estilos para AgroMonitor ERP
 * Funciones centralizadas para clases CSS y estilos dinámicos
 */

/**
 * Obtiene la clase de color según el estado de salud
 * @param estado - Estado: "Saludable" | "En Observación" | "Crítico"
 * @returns Clase de Tailwind CSS
 * @example
 * getEstadoSaludColor("Saludable") // "text-status-ok"
 */
export function getEstadoSaludColor(estado: string): string {
  const colores: Record<string, string> = {
    'Saludable': 'text-status-ok',
    'En Observación': 'text-status-warn',
    'Crítico': 'text-status-critical',
    'Crítica': 'text-status-critical'
  }
  return colores[estado] || 'text-gray-600'
}

/**
 * Obtiene la clase de badge según el estado
 * @param estado - Estado a evaluar
 * @returns Clase completa de badge con bg, text y border
 * @example
 * getEstadoBadgeClass("Activo") // "bg-green-100 text-green-800 border-green-200"
 */
export function getEstadoBadgeClass(estado: string): string {
  const clases: Record<string, string> = {
    'Activo': 'bg-green-100 text-green-800 border-green-200',
    'En Proceso': 'bg-blue-100 text-blue-800 border-blue-200',
    'Pendiente': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Completado': 'bg-gray-100 text-gray-800 border-gray-200',
    'Crítico': 'bg-red-100 text-red-800 border-red-200',
    'Saludable': 'bg-green-100 text-green-800 border-green-200',
    'En Observación': 'bg-yellow-100 text-yellow-800 border-yellow-200'
  }
  return clases[estado] || 'bg-gray-100 text-gray-800 border-gray-200'
}

/**
 * Obtiene la clase de color según prioridad
 * @param prioridad - "Alta" | "Media" | "Baja"
 * @returns Clase de color CSS
 * @example
 * getPrioridadColor("Alta") // "text-red-600"
 */
export function getPrioridadColor(prioridad: string): string {
  const colores: Record<string, string> = {
    'Alta': 'text-red-600',
    'urgent': 'text-red-600',
    'Media': 'text-yellow-600',
    'medium': 'text-yellow-600',
    'high': 'text-orange-600',
    'Baja': 'text-green-600',
    'low': 'text-green-600'
  }
  return colores[prioridad] || 'text-gray-600'
}

/**
 * Obtiene la clase de badge según prioridad
 * @param prioridad - Nivel de prioridad
 * @returns Clase completa de badge
 * @example
 * getPrioridadBadge("Alta") // "bg-red-100 text-red-800 border-red-200"
 */
export function getPrioridadBadge(prioridad: string): string {
  const clases: Record<string, string> = {
    'Alta': 'bg-red-100 text-red-800 border-red-200',
    'urgent': 'bg-red-100 text-red-800 border-red-200',
    'Media': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'medium': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'high': 'bg-orange-100 text-orange-800 border-orange-200',
    'Baja': 'bg-green-100 text-green-800 border-green-200',
    'low': 'bg-green-100 text-green-800 border-green-200'
  }
  return clases[prioridad] || 'bg-gray-100 text-gray-800 border-gray-200'
}

/**
 * Obtiene la clase de color para un cambio porcentual
 * @param change - Valor del cambio (positivo o negativo)
 * @returns Clase de color según si es aumento o disminución
 * @example
 * getChangeColor(2.5) // "text-green-600"
 * getChangeColor(-1.5) // "text-red-600"
 */
export function getChangeColor(change: number): string {
  if (change > 0) return 'text-green-600'
  if (change < 0) return 'text-red-600'
  return 'text-gray-600'
}

/**
 * Obtiene el ícono de tendencia según el cambio
 * @param changeType - "increase" | "decrease" | "neutral"
 * @returns Nombre del componente de ícono de lucide-react
 * @example
 * getTrendIcon("increase") // "TrendingUp"
 */
export function getTrendIcon(changeType: 'increase' | 'decrease' | 'neutral'): string {
  const icons = {
    increase: 'TrendingUp',
    decrease: 'TrendingDown',
    neutral: 'Minus'
  }
  return icons[changeType]
}

/**
 * Obtiene la clase de color para nivel de stock
 * @param current - Cantidad actual
 * @param min - Stock mínimo
 * @param max - Stock máximo
 * @returns Clase de color según el nivel
 * @example
 * getStockLevelColor(5, 10, 50) // "text-red-600" (bajo stock)
 */
export function getStockLevelColor(current: number, min: number, max: number): string {
  if (current < min) return 'text-red-600'
  if (current > max * 0.8) return 'text-yellow-600'
  return 'text-green-600'
}

/**
 * Obtiene la clase de badge para nivel de stock
 * @param current - Cantidad actual
 * @param min - Stock mínimo
 * @returns Clase completa de badge
 * @example
 * getStockLevelBadge(5, 10) // "bg-red-100 text-red-800 border-red-200"
 */
export function getStockLevelBadge(current: number, min: number): string {
  if (current < min) {
    return 'bg-red-100 text-red-800 border-red-200'
  }
  if (current < min * 1.5) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  }
  return 'bg-green-100 text-green-800 border-green-200'
}

/**
 * Obtiene la clase de progreso según porcentaje
 * @param percentage - Porcentaje completado (0-100)
 * @returns Clase de color para barra de progreso
 * @example
 * getProgressColor(25) // "bg-red-500"
 * getProgressColor(75) // "bg-green-500"
 */
export function getProgressColor(percentage: number): string {
  if (percentage < 30) return 'bg-red-500'
  if (percentage < 70) return 'bg-yellow-500'
  return 'bg-green-500'
}

/**
 * Obtiene el color para un tipo de alerta
 * @param type - "alert" | "warn" | "info" | "success"
 * @returns Clase de color para el tipo de alerta
 * @example
 * getAlertColor("alert") // "text-red-600"
 */
export function getAlertColor(type: string): string {
  const colors: Record<string, string> = {
    alert: 'text-red-600',
    critical: 'text-red-600',
    warn: 'text-yellow-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600',
    success: 'text-green-600'
  }
  return colors[type] || 'text-gray-600'
}

/**
 * Obtiene el color de fondo para un tipo de alerta
 * @param type - Tipo de alerta
 * @returns Clase de background para el tipo de alerta
 * @example
 * getAlertBg("alert") // "bg-red-50"
 */
export function getAlertBg(type: string): string {
  const backgrounds: Record<string, string> = {
    alert: 'bg-red-50',
    critical: 'bg-red-50',
    warn: 'bg-yellow-50',
    warning: 'bg-yellow-50',
    info: 'bg-blue-50',
    success: 'bg-green-50'
  }
  return backgrounds[type] || 'bg-gray-50'
}

/**
 * Obtiene la clase completa de badge para un tipo de alerta
 * @param type - Tipo de alerta
 * @returns Clase completa de badge
 * @example
 * getAlertBadge("alert") // "bg-red-100 text-red-800 border-red-200"
 */
export function getAlertBadge(type: string): string {
  const badges: Record<string, string> = {
    alert: 'bg-red-100 text-red-800 border-red-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
    warn: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    success: 'bg-green-100 text-green-800 border-green-200'
  }
  return badges[type] || 'bg-gray-100 text-gray-800 border-gray-200'
}

/**
 * Obtiene el color para el estado de un vehículo
 * @param status - "active" | "inactive" | "maintenance"
 * @returns Clase de color
 * @example
 * getVehicleStatusColor("active") // "text-green-600"
 */
export function getVehicleStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'text-green-600',
    inactive: 'text-gray-600',
    maintenance: 'text-yellow-600',
    repair: 'text-red-600'
  }
  return colors[status] || 'text-gray-600'
}

/**
 * Obtiene el badge para el estado de un vehículo
 * @param status - Estado del vehículo
 * @returns Clase completa de badge
 * @example
 * getVehicleStatusBadge("active") // "bg-green-100 text-green-800 border-green-200"
 */
export function getVehicleStatusBadge(status: string): string {
  const badges: Record<string, string> = {
    active: 'bg-green-100 text-green-800 border-green-200',
    inactive: 'bg-gray-100 text-gray-800 border-gray-200',
    maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    repair: 'bg-red-100 text-red-800 border-red-200'
  }
  return badges[status] || 'bg-gray-100 text-gray-800 border-gray-200'
}
