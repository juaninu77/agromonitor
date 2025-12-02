/**
 * Utilidades de validación para AgroMonitor ERP
 * Funciones centralizadas para validar datos
 */

/**
 * Valida un email
 * @param email - Email a validar
 * @returns true si es válido
 * @example
 * isValidEmail("usuario@example.com") // true
 * isValidEmail("invalid") // false
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

/**
 * Valida un número de teléfono argentino
 * @param phone - Teléfono a validar
 * @returns true si es válido
 * @example
 * isValidPhone("+54 11 1234-5678") // true
 * isValidPhone("123") // false
 */
export function isValidPhone(phone: string): boolean {
  const regex = /^(\+54|0)?[\s\-]?\d{2,4}[\s\-]?\d{6,8}$/
  return regex.test(phone)
}

/**
 * Valida que una fecha no sea futura
 * @param date - Fecha a validar
 * @returns true si no es futura
 * @example
 * isNotFutureDate(new Date()) // true
 * isNotFutureDate(new Date('2030-01-01')) // false
 */
export function isNotFutureDate(date: string | Date): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj <= new Date()
}

/**
 * Valida que una fecha no sea pasada
 * @param date - Fecha a validar
 * @returns true si no es pasada
 * @example
 * isNotPastDate(new Date('2030-01-01')) // true
 * isNotPastDate(new Date('2020-01-01')) // false
 */
export function isNotPastDate(date: string | Date): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj >= new Date()
}

/**
 * Valida rango de peso para ganado (kg)
 * @param peso - Peso a validar
 * @param tipo - Tipo de animal
 * @returns true si está en rango válido
 * @example
 * isValidPeso(450, 'vacuno') // true
 * isValidPeso(5000, 'vacuno') // false
 */
export function isValidPeso(
  peso: number,
  tipo: 'vacuno' | 'porcino' | 'ovino' | 'caprino' | 'equino'
): boolean {
  const rangos = {
    vacuno: { min: 50, max: 1500 },
    porcino: { min: 20, max: 300 },
    ovino: { min: 15, max: 150 },
    caprino: { min: 15, max: 120 },
    equino: { min: 100, max: 800 }
  }
  const rango = rangos[tipo]
  return peso >= rango.min && peso <= rango.max
}

/**
 * Valida un CUIT/CUIL argentino
 * @param cuit - CUIT/CUIL a validar
 * @returns true si es válido
 * @example
 * isValidCuit("20-12345678-9") // true (si el dígito verificador es correcto)
 */
export function isValidCuit(cuit: string): boolean {
  const cleaned = cuit.replace(/\D/g, '')

  if (cleaned.length !== 11) return false

  const [checkDigit, ...rest] = cleaned.split('').map(Number).reverse()

  const total = rest.reduce(
    (acc, digit, index) => acc + digit * (2 + (index % 6)),
    0
  )

  const mod = 11 - (total % 11)
  const expectedCheckDigit = mod === 11 ? 0 : mod === 10 ? 9 : mod

  return checkDigit === expectedCheckDigit
}

/**
 * Valida un rango numérico
 * @param value - Valor a validar
 * @param min - Valor mínimo
 * @param max - Valor máximo
 * @returns true si está dentro del rango
 * @example
 * isInRange(5, 1, 10) // true
 * isInRange(15, 1, 10) // false
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/**
 * Valida que un string no esté vacío (sin contar espacios)
 * @param value - String a validar
 * @returns true si no está vacío
 * @example
 * isNotEmpty("texto") // true
 * isNotEmpty("   ") // false
 */
export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0
}

/**
 * Valida longitud mínima de string
 * @param value - String a validar
 * @param minLength - Longitud mínima
 * @returns true si cumple la longitud
 * @example
 * hasMinLength("texto", 3) // true
 * hasMinLength("ab", 3) // false
 */
export function hasMinLength(value: string, minLength: number): boolean {
  return value.length >= minLength
}

/**
 * Valida longitud máxima de string
 * @param value - String a validar
 * @param maxLength - Longitud máxima
 * @returns true si cumple la longitud
 * @example
 * hasMaxLength("texto", 10) // true
 * hasMaxLength("texto muy largo", 5) // false
 */
export function hasMaxLength(value: string, maxLength: number): boolean {
  return value.length <= maxLength
}

/**
 * Valida que un número sea positivo
 * @param value - Número a validar
 * @returns true si es positivo
 * @example
 * isPositive(5) // true
 * isPositive(-5) // false
 */
export function isPositive(value: number): boolean {
  return value > 0
}

/**
 * Valida que un número sea no negativo (incluye cero)
 * @param value - Número a validar
 * @returns true si es no negativo
 * @example
 * isNonNegative(0) // true
 * isNonNegative(-5) // false
 */
export function isNonNegative(value: number): boolean {
  return value >= 0
}

/**
 * Valida formato de identificación de animal (alfanumérico con guiones)
 * @param id - ID a validar
 * @returns true si es válido
 * @example
 * isValidAnimalId("ARG-001") // true
 * isValidAnimalId("abc 123") // false
 */
export function isValidAnimalId(id: string): boolean {
  const regex = /^[A-Z0-9-]+$/
  return regex.test(id)
}

/**
 * Valida que una coordenada de latitud sea válida
 * @param lat - Latitud
 * @returns true si es válida
 * @example
 * isValidLatitude(-34.6037) // true
 * isValidLatitude(100) // false
 */
export function isValidLatitude(lat: number): boolean {
  return lat >= -90 && lat <= 90
}

/**
 * Valida que una coordenada de longitud sea válida
 * @param lng - Longitud
 * @returns true si es válida
 * @example
 * isValidLongitude(-58.3816) // true
 * isValidLongitude(200) // false
 */
export function isValidLongitude(lng: number): boolean {
  return lng >= -180 && lng <= 180
}

/**
 * Valida un porcentaje (0-100)
 * @param value - Valor a validar
 * @returns true si es un porcentaje válido
 * @example
 * isValidPercentage(50) // true
 * isValidPercentage(150) // false
 */
export function isValidPercentage(value: number): boolean {
  return value >= 0 && value <= 100
}

/**
 * Valida edad de animal (no puede ser negativa ni muy alta)
 * @param years - Edad en años
 * @param maxAge - Edad máxima permitida
 * @returns true si es válida
 * @example
 * isValidAge(5, 25) // true
 * isValidAge(30, 25) // false
 */
export function isValidAge(years: number, maxAge: number = 25): boolean {
  return years >= 0 && years <= maxAge
}
