// Fechas calendario del inventario (vencimientos @db.Date) en hora de Argentina.
// Un vencimiento se guarda como medianoche UTC del día; compararlo con `new Date()`
// lo daba por vencido desde las 21 h del día anterior y lo mostraba un día antes.

const DIA_MS = 86_400_000

/** Hoy en Argentina como AAAA-MM-DD. */
export const hoyArgentina = (ahora = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(ahora)

/** AAAA-MM-DD de una fecha calendario guardada como medianoche UTC. */
export const diaCalendario = (d: Date | string) => (typeof d === "string" ? d : d.toISOString()).slice(0, 10)

/** Días entre dos fechas AAAA-MM-DD (b − a). */
export const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA_MS)

/** Un lote vence al terminar su día de vencimiento. */
export function estadoVencimiento(vencimiento: Date | string | null, { hoy = hoyArgentina(), diasAlerta = 30 } = {}) {
  if (!vencimiento) return { vencido: false, proximoAVencer: false, diasRestantes: null as number | null }
  const diasRestantes = diasEntre(hoy, diaCalendario(vencimiento))
  return { vencido: diasRestantes < 0, proximoAVencer: diasRestantes <= diasAlerta, diasRestantes }
}

/** dd/mm/aaaa de una fecha calendario, sin correr el día por zona horaria. */
export const formatoDia = (d: Date | string) => {
  const [a, m, dd] = diaCalendario(d).split("-")
  return `${dd}/${m}/${a}`
}

/** "vence hoy", "vence en 3 días", "venció hace 2 días". */
export function textoVencimiento(diasRestantes: number) {
  if (diasRestantes === 0) return "vence hoy"
  if (diasRestantes > 0) return `vence en ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"}`
  const n = -diasRestantes
  return `venció hace ${n} ${n === 1 ? "día" : "días"}`
}
