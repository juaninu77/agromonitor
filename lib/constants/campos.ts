// Constantes para campos y ubicaciones

export const CAMPOS_DISPONIBLES = [
  {
    id: 'chacra-alberto',
    nombre: 'Chacra Alberto',
    alias: ['Alberto', 'Chacra Alberto']
  },
  {
    id: 'renuevo',
    nombre: 'Renuevo',
    alias: ['Renuevo']
  },
  {
    id: 'cantera',
    nombre: 'Cantera',
    alias: ['Cantera']
  },
  {
    id: 'alberto-renuevo',
    nombre: 'Alberto-Renuevo',
    alias: ['Alberto-Renuevo', 'Alberto Renuevo']
  }
] as const

export const TIPOS_CAMPO = {
  PROPIO: 'propio',
  ARRENDADO: 'arrendado',
  COMPARTIDO: 'compartido'
} as const

export const TIPOS_CAMPO_LABELS = {
  propio: 'Propio',
  arrendado: 'Arrendado',
  compartido: 'Compartido'
} as const

export const ESTADOS_POTRERO = {
  BUENO: 'bueno',
  REGULAR: 'regular',
  MALO: 'malo'
} as const

export const ESTADOS_POTRERO_LABELS = {
  bueno: 'Bueno',
  regular: 'Regular',
  malo: 'Malo'
} as const

// Helper para normalizar nombres de campos
export function normalizarNombreCampo(nombre: string): string {
  const nombreNormalizado = nombre.trim().toLowerCase()

  for (const campo of CAMPOS_DISPONIBLES) {
    if (campo.alias.some(alias => alias.toLowerCase() === nombreNormalizado)) {
      return campo.nombre
    }
  }

  return nombre
}
