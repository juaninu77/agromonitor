// Constantes del módulo de finanzas. Sin dependencias de servidor: las usan
// tanto las rutas API como los formularios del cliente.

export const MONEDAS = ["ARS", "USD"] as const
export type Moneda = (typeof MONEDAS)[number]

export const TIPOS_CUENTA = ["caja", "banco", "billetera", "tarjeta", "otro"] as const
export type TipoCuenta = (typeof TIPOS_CUENTA)[number]

export const TIPOS_MOVIMIENTO = ["ingreso", "egreso"] as const
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number]

/** Categoría reservada para los dos movimientos de una transferencia entre cuentas. */
export const CATEGORIA_TRANSFERENCIA = "transferencia"

export const CATEGORIAS_INGRESO = [
  "venta_hacienda",
  "venta_granos",
  "servicios_prestados",
  "arrendamiento_cobrado",
  "reintegros_subsidios",
  "aportes_socios",
  "otros_ingresos",
] as const

export const CATEGORIAS_EGRESO = [
  "compra_hacienda",
  "alimentacion",
  "sanidad",
  "semillas_agroquimicos",
  "personal",
  "combustible",
  "mantenimiento",
  "servicios",
  "arrendamiento",
  "fletes",
  "honorarios",
  "impuestos",
  "gastos_bancarios",
  "seguros",
  "retiros_socios",
  "otros_egresos",
] as const

export const CATEGORIAS: Record<TipoMovimiento, readonly string[]> = {
  ingreso: CATEGORIAS_INGRESO,
  egreso: CATEGORIAS_EGRESO,
}

/** Detalle obligatorio cuando la categoría es "impuestos". */
export const SUBCATEGORIAS_IMPUESTO = [
  "iva",
  "ganancias",
  "ingresos_brutos",
  "inmobiliario_rural",
  "tasa_municipal",
  "bienes_personales",
  "debitos_creditos",
  "monotributo_autonomos",
  "otro_impuesto",
] as const

export const MEDIOS_PAGO = [
  "efectivo",
  "transferencia",
  "cheque",
  "echeq",
  "tarjeta",
  "debito_automatico",
  "otro",
] as const

export const ETIQUETAS_FINANZAS: Record<string, string> = {
  // tipos de cuenta
  caja: "Caja (efectivo)",
  banco: "Cuenta bancaria",
  billetera: "Billetera virtual",
  tarjeta: "Tarjeta de crédito",
  otro: "Otro",
  // tipos de movimiento
  ingreso: "Ingreso",
  egreso: "Egreso",
  transferencia: "Transferencia entre cuentas",
  // categorías de ingreso
  venta_hacienda: "Venta de hacienda",
  venta_granos: "Venta de granos y forrajes",
  servicios_prestados: "Servicios prestados",
  arrendamiento_cobrado: "Arrendamiento cobrado",
  reintegros_subsidios: "Reintegros y subsidios",
  aportes_socios: "Aportes de socios",
  otros_ingresos: "Otros ingresos",
  // categorías de egreso
  compra_hacienda: "Compra de hacienda",
  alimentacion: "Alimentación y suplementos",
  sanidad: "Sanidad y veterinaria",
  semillas_agroquimicos: "Semillas y agroquímicos",
  personal: "Sueldos y cargas sociales",
  combustible: "Combustible",
  mantenimiento: "Mantenimiento y reparaciones",
  servicios: "Servicios (luz, agua, internet)",
  arrendamiento: "Arrendamiento pagado",
  fletes: "Fletes",
  honorarios: "Honorarios profesionales",
  impuestos: "Impuestos y tasas",
  gastos_bancarios: "Comisiones y gastos bancarios",
  seguros: "Seguros",
  retiros_socios: "Retiros de socios",
  otros_egresos: "Otros egresos",
  // impuestos
  iva: "IVA",
  ganancias: "Ganancias",
  ingresos_brutos: "Ingresos Brutos",
  inmobiliario_rural: "Inmobiliario rural",
  tasa_municipal: "Tasa municipal / vial",
  bienes_personales: "Bienes Personales",
  debitos_creditos: "Impuesto al cheque",
  monotributo_autonomos: "Monotributo / Autónomos",
  otro_impuesto: "Otro impuesto",
  // medios de pago
  efectivo: "Efectivo",
  cheque: "Cheque",
  echeq: "eCheq",
  debito_automatico: "Débito automático",
}

export function etiquetaFinanzas(valor: string | null | undefined): string {
  if (!valor) return ""
  return ETIQUETAS_FINANZAS[valor] ?? valor.charAt(0).toUpperCase() + valor.slice(1).replaceAll("_", " ")
}

/** Formatea un importe con su moneda (es-AR), con centavos. */
export function formatearImporte(importe: number, moneda: string = "ARS"): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(importe)
}
