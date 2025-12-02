// Constantes para el módulo de alimentación

export const TIPOS_ALIMENTO = {
  FARDO: 'fardo',
  MEZCLA: 'mezcla',
  MAIZ: 'maiz',
  BALANCEADO: 'balanceado',
  SAL_MINERAL: 'sal_mineral',
  ALFALFA: 'alfalfa',
  OTRO: 'otro'
} as const

export const TIPOS_ALIMENTO_LABELS = {
  fardo: 'Fardos',
  mezcla: 'Mezcla',
  maiz: 'Maíz',
  balanceado: 'Balanceado',
  sal_mineral: 'Sales Minerales',
  alfalfa: 'Alfalfa',
  otro: 'Otro'
} as const

export const UNIDADES_MEDIDA = {
  KG: 'kg',
  SACOS: 'sacos',
  FARDOS: 'fardos',
  LITROS: 'litros',
  TONELADAS: 'toneladas'
} as const

export const UNIDADES_MEDIDA_LABELS = {
  kg: 'Kilogramos',
  sacos: 'Sacos',
  fardos: 'Fardos',
  litros: 'Litros',
  toneladas: 'Toneladas'
} as const

// Pesos estándar por unidad (en kg)
export const PESO_UNITARIO_ESTANDAR = {
  fardo: 18,        // kg por fardo
  saco: 50,         // kg por saco
  tonelada: 1000    // kg por tonelada
} as const
