/**
 * Constantes de estados para AgroMonitor ERP
 * Define los valores válidos para diferentes estados en la aplicación
 */

/**
 * Estados de salud para animales y cultivos
 */
export const ESTADOS_SALUD = {
  SALUDABLE: 'Saludable',
  EN_OBSERVACION: 'En Observación',
  CRITICO: 'Crítico'
} as const

export type EstadoSalud = typeof ESTADOS_SALUD[keyof typeof ESTADOS_SALUD]

/**
 * Estados de tareas
 */
export const ESTADOS_TAREA = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En Proceso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  VENCIDA: 'Vencida'
} as const

export type EstadoTarea = typeof ESTADOS_TAREA[keyof typeof ESTADOS_TAREA]

/**
 * Niveles de prioridad
 */
export const PRIORIDADES = {
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
  URGENTE: 'Urgente'
} as const

export type Prioridad = typeof PRIORIDADES[keyof typeof PRIORIDADES]

/**
 * Estados de vehículos/maquinaria
 */
export const ESTADOS_VEHICULO = {
  ACTIVO: 'Activo',
  INACTIVO: 'Inactivo',
  MANTENIMIENTO: 'Mantenimiento',
  REPARACION: 'Reparación',
  FUERA_DE_SERVICIO: 'Fuera de Servicio'
} as const

export type EstadoVehiculo = typeof ESTADOS_VEHICULO[keyof typeof ESTADOS_VEHICULO]

/**
 * Estados de inventario/stock
 */
export const ESTADOS_STOCK = {
  DISPONIBLE: 'Disponible',
  BAJO: 'Bajo',
  AGOTADO: 'Agotado',
  RESERVADO: 'Reservado'
} as const

export type EstadoStock = typeof ESTADOS_STOCK[keyof typeof ESTADOS_STOCK]

/**
 * Tipos de alerta
 */
export const TIPOS_ALERTA = {
  INFO: 'info',
  ADVERTENCIA: 'warn',
  ALERTA: 'alert',
  CRITICO: 'critical',
  EXITO: 'success'
} as const

export type TipoAlerta = typeof TIPOS_ALERTA[keyof typeof TIPOS_ALERTA]

/**
 * Estados fenológicos de cultivos
 */
export const ESTADOS_FENOLOGICOS = {
  SIEMBRA: 'Siembra',
  EMERGENCIA: 'Emergencia',
  CRECIMIENTO_VEGETATIVO: 'Crecimiento Vegetativo',
  FLORACION: 'Floración',
  FRUCTIFICACION: 'Fructificación',
  MADURACION: 'Maduración',
  COSECHA: 'Cosecha'
} as const

export type EstadoFenologico = typeof ESTADOS_FENOLOGICOS[keyof typeof ESTADOS_FENOLOGICOS]

/**
 * Razas de ganado vacuno comunes en Argentina
 */
export const RAZAS_VACUNAS = {
  ABERDEEN_ANGUS: 'Aberdeen Angus',
  HEREFORD: 'Hereford',
  BRAHMAN: 'Brahman',
  BRANGUS: 'Brangus',
  SHORTHORN: 'Shorthorn',
  LIMOUSIN: 'Limousin',
  CHAROLAIS: 'Charolais',
  SIMMENTAL: 'Simmental',
  CRIOLLO: 'Criollo',
  HOLANDO: 'Holando',
  JERSEY: 'Jersey',
  CRUZA: 'Cruza'
} as const

export type RazaVacuna = typeof RAZAS_VACUNAS[keyof typeof RAZAS_VACUNAS]

/**
 * Sexo de animales
 */
export const SEXOS = {
  MACHO: 'Macho',
  HEMBRA: 'Hembra'
} as const

export type Sexo = typeof SEXOS[keyof typeof SEXOS]

/**
 * Categorías de ganado vacuno
 */
export const CATEGORIAS_VACUNO = {
  TERNERO: 'Ternero',
  TERNERA: 'Ternera',
  NOVILLITO: 'Novillito',
  NOVILLO: 'Novillo',
  VAQUILLONA: 'Vaquillona',
  VACA: 'Vaca',
  TORO: 'Toro',
  TORITO: 'Torito'
} as const

export type CategoriaVacuno = typeof CATEGORIAS_VACUNO[keyof typeof CATEGORIAS_VACUNO]

/**
 * Tipos de cultivo comunes en Argentina
 */
export const TIPOS_CULTIVO = {
  MAIZ: 'Maíz',
  SOJA: 'Soja',
  TRIGO: 'Trigo',
  GIRASOL: 'Girasol',
  CEBADA: 'Cebada',
  SORGO: 'Sorgo',
  AVENA: 'Avena',
  ALFALFA: 'Alfalfa',
  PASTURAS: 'Pasturas',
  OTRO: 'Otro'
} as const

export type TipoCultivo = typeof TIPOS_CULTIVO[keyof typeof TIPOS_CULTIVO]

/**
 * Métodos de pago
 */
export const METODOS_PAGO = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
  TARJETA: 'Tarjeta',
  MERCADO_PAGO: 'Mercado Pago',
  OTRO: 'Otro'
} as const

export type MetodoPago = typeof METODOS_PAGO[keyof typeof METODOS_PAGO]

/**
 * Categorías de transacciones financieras
 */
export const CATEGORIAS_FINANCIERAS = {
  // Ingresos
  VENTA_GANADO: 'Venta de Ganado',
  VENTA_CULTIVOS: 'Venta de Cultivos',
  VENTA_PRODUCTOS: 'Venta de Productos',
  SERVICIOS: 'Servicios',
  SUBSIDIOS: 'Subsidios',
  OTROS_INGRESOS: 'Otros Ingresos',

  // Egresos
  COMPRA_INSUMOS: 'Compra de Insumos',
  COMPRA_GANADO: 'Compra de Ganado',
  COMPRA_SEMILLAS: 'Compra de Semillas',
  VETERINARIA: 'Veterinaria',
  ALIMENTACION: 'Alimentación',
  MANTENIMIENTO: 'Mantenimiento',
  COMBUSTIBLE: 'Combustible',
  SALARIOS: 'Salarios',
  SERVICIOS_TERCEROS: 'Servicios de Terceros',
  IMPUESTOS: 'Impuestos',
  SEGUROS: 'Seguros',
  OTROS_GASTOS: 'Otros Gastos'
} as const

export type CategoriaFinanciera = typeof CATEGORIAS_FINANCIERAS[keyof typeof CATEGORIAS_FINANCIERAS]

/**
 * Unidades de medida
 */
export const UNIDADES = {
  KILOGRAMO: 'kg',
  TONELADA: 'tn',
  GRAMO: 'g',
  LITRO: 'L',
  MILILITRO: 'ml',
  HECTAREA: 'ha',
  METRO: 'm',
  METRO_CUADRADO: 'm²',
  UNIDAD: 'unidad',
  SACO: 'saco',
  BOLSA: 'bolsa',
  GALON: 'galón',
  VIAL: 'vial',
  DOSIS: 'dosis',
  BLOQUE: 'bloque'
} as const

export type Unidad = typeof UNIDADES[keyof typeof UNIDADES]

/**
 * Estaciones del año
 */
export const ESTACIONES = {
  VERANO: 'Verano',
  OTONO: 'Otoño',
  INVIERNO: 'Invierno',
  PRIMAVERA: 'Primavera'
} as const

export type Estacion = typeof ESTACIONES[keyof typeof ESTACIONES]

/**
 * Condiciones climáticas
 */
export const CONDICIONES_CLIMA = {
  SOLEADO: 'Soleado',
  PARCIALMENTE_NUBLADO: 'Parcialmente Nublado',
  NUBLADO: 'Nublado',
  LLUVIA: 'Lluvia',
  TORMENTA: 'Tormenta',
  GRANIZO: 'Granizo',
  VIENTO: 'Viento',
  NIEBLA: 'Niebla'
} as const

export type CondicionClima = typeof CONDICIONES_CLIMA[keyof typeof CONDICIONES_CLIMA]
