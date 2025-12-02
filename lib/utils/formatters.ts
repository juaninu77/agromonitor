/**
 * Utilidades de formateo para AgroMonitor ERP
 * Funciones centralizadas para formatear datos de manera consistente
 */

import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Formatea un número como moneda en pesos argentinos
 * @param amount - Cantidad a formatear
 * @param compact - Si es true, usa formato compacto (ej: $25.5k)
 * @returns String formateado como moneda
 * @example
 * formatCurrency(25000) // "$25.000"
 * formatCurrency(25000, true) // "$25k"
 */
export function formatCurrency(amount: number, compact = false): string {
  if (compact && amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`
  }
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Formatea una fecha según el formato local argentino
 * @param date - Fecha a formatear (string o Date)
 * @param format - Formato: 'short' | 'long' | 'relative'
 * @returns Fecha formateada
 * @example
 * formatDate(new Date(), 'short') // "11/11/2025"
 * formatDate(new Date(), 'long') // "11 de noviembre de 2025"
 * formatDate(new Date(), 'relative') // "hace unos segundos"
 */
export function formatDate(
  date: string | Date,
  format: 'short' | 'long' | 'relative' = 'short'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  if (format === 'relative') {
    return formatDistanceToNow(dateObj, {
      addSuffix: true,
      locale: es
    })
  }

  if (format === 'long') {
    return dateObj.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return dateObj.toLocaleDateString('es-AR')
}

/**
 * Formatea un número con separadores de miles
 * @param value - Número a formatear
 * @returns Número formateado con puntos como separador de miles
 * @example
 * formatNumber(1250) // "1.250"
 * formatNumber(1250000) // "1.250.000"
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-AR').format(value)
}

/**
 * Formatea un porcentaje
 * @param value - Valor decimal (ej: 0.15 para 15%)
 * @param decimals - Cantidad de decimales a mostrar
 * @returns Porcentaje formateado
 * @example
 * formatPercentage(0.15) // "15%"
 * formatPercentage(0.1542, 2) // "15.42%"
 */
export function formatPercentage(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Formatea una cantidad con su unidad
 * @param value - Valor numérico
 * @param unit - Unidad (kg, ha, litros, etc.)
 * @returns String formateado con valor y unidad
 * @example
 * formatUnit(450, 'kg') // "450 kg"
 * formatUnit(1250.5, 'ha') // "1.250,5 ha"
 */
export function formatUnit(value: number, unit: string): string {
  return `${formatNumber(value)} ${unit}`
}

/**
 * Formatea un peso en kilogramos
 * @param kg - Peso en kilogramos
 * @param showUnit - Si debe mostrar la unidad
 * @returns Peso formateado
 * @example
 * formatWeight(450) // "450 kg"
 * formatWeight(450, false) // "450"
 */
export function formatWeight(kg: number, showUnit = true): string {
  if (showUnit) {
    return formatUnit(kg, 'kg')
  }
  return formatNumber(kg)
}

/**
 * Formatea una superficie en hectáreas
 * @param hectares - Superficie en hectáreas
 * @param showUnit - Si debe mostrar la unidad
 * @returns Superficie formateada
 * @example
 * formatArea(1250.5) // "1.250,5 ha"
 */
export function formatArea(hectares: number, showUnit = true): string {
  const formatted = hectares.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })

  if (showUnit) {
    return `${formatted} ha`
  }
  return formatted
}

/**
 * Formatea un cambio porcentual con signo
 * @param change - Porcentaje de cambio
 * @returns Cambio formateado con signo + o -
 * @example
 * formatChange(2.5) // "+2.5%"
 * formatChange(-8.1) // "-8.1%"
 */
export function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(1)}%`
}

/**
 * Abrevia texto largo agregando puntos suspensivos
 * @param text - Texto a abreviar
 * @param maxLength - Longitud máxima
 * @returns Texto abreviado
 * @example
 * truncateText("Este es un texto muy largo", 10) // "Este es un..."
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}...`
}

/**
 * Formatea un teléfono al formato argentino
 * @param phone - Número de teléfono
 * @returns Teléfono formateado
 * @example
 * formatPhone("1123456789") // "+54 11 2345-6789"
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')

  if (cleaned.length === 10) {
    // Formato: 11 2345-6789
    return `+54 ${cleaned.slice(0, 2)} ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
  }

  return phone
}

/**
 * Formatea un CUIT/CUIL
 * @param cuit - CUIT/CUIL sin formato
 * @returns CUIT formateado
 * @example
 * formatCuit("20123456789") // "20-12345678-9"
 */
export function formatCuit(cuit: string): string {
  const cleaned = cuit.replace(/\D/g, '')

  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}`
  }

  return cuit
}
