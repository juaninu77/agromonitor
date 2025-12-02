// Constantes para el módulo de ganado

// Categorías de bovinos
export const CATEGORIAS_BOVINOS = [
  'vaca',
  'toro',
  'vaquillona',
  'novillo',
  'ternero',
  'ternera'
] as const

export type CategoriaBovino = typeof CATEGORIAS_BOVINOS[number]

// Categorías de ovinos
export const CATEGORIAS_OVINOS = [
  'oveja',
  'borrega',
  'cordera',
  'capon',
  'carnero',
  'cordero'
] as const

export type CategoriaOvino = typeof CATEGORIAS_OVINOS[number]

// Colores de marca para ovinos
export const COLORES_MARCA_OVINOS = [
  'rojo',
  'celeste',
  'negro',
  'amarillo',
  'verde',
  'blanco'
] as const

export type ColorMarcaOvino = typeof COLORES_MARCA_OVINOS[number]

// Estados de animales
export const ESTADOS_ANIMAL = [
  'activo',
  'vendido',
  'muerto',
  'perdido'
] as const

export type EstadoAnimal = typeof ESTADOS_ANIMAL[number]

// Razas comunes (basadas en tus datos)
export const RAZAS_BOVINOS = [
  'Angus Negro',
  'Angus Colorado',
  'Hereford',
  'Brangus',
  'Braford',
  'Holando',
  'Aberdeen Angus',
  'Búlgaro',
  'Criollo',
  'Mestizo',
  'Otra'
] as const

export const RAZAS_OVINOS = [
  'Merino',
  'Corriedale',
  'Romney Marsh',
  'Hampshire Down',
  'Texel',
  'Criollo',
  'Mestizo',
  'Otra'
] as const

// Campos (basados en tu Excel)
export const CAMPOS = [
  'Chacra Alberto',
  'Renuevo',
  'Cantera',
  'Alberto-Renuevo'
] as const

export type Campo = typeof CAMPOS[number]

// Tipos de tratamientos sanitarios
export const TIPOS_TRATAMIENTO = [
  'vacuna',
  'desparasitacion',
  'antibiotico',
  'curacion',
  'revision',
  'otro'
] as const

export type TipoTratamiento = typeof TIPOS_TRATAMIENTO[number]

// Tipos de alimentos
export const TIPOS_ALIMENTO = [
  'fardo',
  'mezcla',
  'maiz',
  'balanceado',
  'sal_mineral',
  'alfalfa',
  'otro'
] as const

export type TipoAlimento = typeof TIPOS_ALIMENTO[number]

// Unidades de medida para alimentos
export const UNIDADES_ALIMENTO = [
  'kg',
  'sacos',
  'fardos',
  'litros',
  'toneladas'
] as const

export type UnidadAlimento = typeof UNIDADES_ALIMENTO[number]

// Tipos de eventos en historial
export const TIPOS_EVENTO_HISTORIAL = [
  'nacimiento',
  'compra',
  'venta',
  'movimiento',
  'sanitario',
  'muerte',
  'esquila',
  'encaste',
  'destete',
  'peso'
] as const

export type TipoEventoHistorial = typeof TIPOS_EVENTO_HISTORIAL[number]

// Tipos de movimiento de ganado
export const TIPOS_MOVIMIENTO = [
  'compra',
  'venta',
  'movimiento_interno',
  'muerte',
  'perdida'
] as const

export type TipoMovimiento = typeof TIPOS_MOVIMIENTO[number]

// Especies
export const ESPECIES = [
  'bovino',
  'ovino',
  'porcino'
] as const

export type Especie = typeof ESPECIES[number]

// Mapeo de categorías bovinas a español
export const CATEGORIAS_BOVINOS_LABELS: Record<CategoriaBovino, string> = {
  'vaca': 'Vaca Madre',
  'toro': 'Toro Reproductor',
  'vaquillona': 'Vaquillona',
  'novillo': 'Novillo',
  'ternero': 'Ternero',
  'ternera': 'Ternera'
}

// Mapeo de categorías ovinas a español
export const CATEGORIAS_OVINOS_LABELS: Record<CategoriaOvino, string> = {
  'oveja': 'Oveja',
  'borrega': 'Borrega',
  'cordera': 'Cordera',
  'capon': 'Capón',
  'carnero': 'Carnero',
  'cordero': 'Cordero'
}

// Mapeo de colores de marca
export const COLORES_MARCA_LABELS: Record<ColorMarcaOvino, string> = {
  'rojo': 'Rojo',
  'celeste': 'Celeste',
  'negro': 'Negro',
  'amarillo': 'Amarillo',
  'verde': 'Verde',
  'blanco': 'Blanco'
}

// Colores hex para visualización
export const COLORES_MARCA_HEX: Record<ColorMarcaOvino, string> = {
  'rojo': '#ef4444',
  'celeste': '#06b6d4',
  'negro': '#1f2937',
  'amarillo': '#eab308',
  'verde': '#22c55e',
  'blanco': '#f3f4f6'
}
