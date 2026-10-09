// Formato de importes de inventario por moneda (client-safe): ARS y USD se muestran por
// separado, nunca sumados.

export type Valores = Partial<Record<"ARS" | "USD", number>>

const importe = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** "ARS 1.234,50 · USD 20,00", o "—" si no hay importes. */
export function textoValores(v: Valores | null | undefined): string {
  const partes = (["ARS", "USD"] as const).filter((m) => v?.[m] != null).map((m) => `${m} ${importe(v![m]!)}`)
  return partes.length ? partes.join(" · ") : "—"
}
