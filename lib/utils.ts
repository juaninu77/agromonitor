import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combina clases CSS usando clsx y tailwind-merge
 * @param inputs - Clases CSS a combinar
 * @returns Clases combinadas y optimizadas
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Re-exportar todas las utilidades desde un punto central
export * from './utils/formatters'
export * from './utils/styles'
export * from './utils/validators'
export * from './utils/calculations'
