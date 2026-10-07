// Tipos y llamadas HTTP del módulo de finanzas (cliente).

export interface Cuenta {
  id: string
  establecimientoId: string
  nombre: string
  tipo: string
  moneda: string
  banco: string | null
  numero: string | null
  saldoInicial: number
  saldo: number
  activa: boolean
  notas: string | null
  cantidadMovimientos: number
}

export interface Movimiento {
  id: string
  establecimientoId: string
  cuentaId: string
  tipo: "ingreso" | "egreso"
  categoria: string
  subcategoria: string | null
  fecha: string
  importe: number
  moneda: string
  descripcion: string
  contraparte: string | null
  cuit: string | null
  medioPago: string | null
  notas: string | null
  comprobanteId: string | null
  transferenciaId: string | null
  bajaId: string | null
  cuenta: { id: string; nombre: string; moneda: string; tipo: string }
  comprobante: { id: string; titulo: string; referencia: string } | null
  baja: { id: string; animal: { id: string; caravanaVisual: string | null } } | null
}

export type Totales = Record<string, { ingresos: number; egresos: number; resultado: number }>

export interface ListadoMovimientos {
  data: Movimiento[]
  totales: Totales
  pagination: { page: number; limit: number; total: number; pages: number }
}

export interface Resumen {
  totales: Totales
  mensual: Array<{ mes: string; moneda: string; ingresos: number; egresos: number; resultado: number }>
  porCategoria: Array<{ tipo: string; categoria: string; moneda: string; total: number }>
  impuestos: Array<{ subcategoria: string; moneda: string; total: number }>
  cuentas: Cuenta[]
  pendientes: Array<{ sentido: string; moneda: string; cantidad: number; total: number }>
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(body?.error ?? "No se pudo completar la operación", res.status)
  return body as T
}

export const claves = {
  todo: ["finanzas"] as const,
  cuentas: (campo: string) => ["finanzas", "cuentas", campo] as const,
  movimientos: (campo: string, filtros: object) => ["finanzas", "movimientos", campo, filtros] as const,
  resumen: (campo: string, desde: string, hasta: string) => ["finanzas", "resumen", campo, desde, hasta] as const,
}

/** Fecha local AAAA-MM-DD (no UTC: a la noche en Argentina UTC ya es mañana). */
export function hoyLocal(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function formatearFecha(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-")
  return `${d}/${m}/${a}`
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
export function etiquetaMes(mes: string): string {
  const [a, m] = mes.split("-")
  return `${MESES[Number(m) - 1]} ${a.slice(2)}`
}

export type Periodo = "mes" | "trimestre" | "semestre" | "anio" | "12meses"

export const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: "mes", etiqueta: "Este mes" },
  { valor: "trimestre", etiqueta: "Últimos 3 meses" },
  { valor: "semestre", etiqueta: "Últimos 6 meses" },
  { valor: "anio", etiqueta: "Este año" },
  { valor: "12meses", etiqueta: "Últimos 12 meses" },
]

export function rangoDePeriodo(periodo: Periodo, hoy = new Date()): { desde: string; hasta: string } {
  const finDeMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  const inicio = (mesesAtras: number) => new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras, 1)
  const desde =
    periodo === "mes"
      ? inicio(0)
      : periodo === "trimestre"
        ? inicio(2)
        : periodo === "semestre"
          ? inicio(5)
          : periodo === "anio"
            ? new Date(hoy.getFullYear(), 0, 1)
            : inicio(11)
  return { desde: hoyLocal(desde), hasta: hoyLocal(finDeMes) }
}
