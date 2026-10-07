"use client"

import Link from "next/link"
import { CONCEPTO_FORRAJE_LABEL } from "@/lib/campo/rules"

export interface TotalUnidad { unidad: string; cantidad: string }
export interface LineaForraje { id: string; fecha: string; tipo: string; concepto: string | null; cantidad: string; unidad: string; reserva: string; motivo: string; lote: string | null }
export interface ForrajeFicha {
  producido: TotalUnidad[]
  cosechasPorCultivo: Record<string, TotalUnidad[]>
  consumido: TotalUnidad[]
  consumos: LineaForraje[]
  movimientosGalpon: LineaForraje[]
}

const fecha = (s: string) => new Date(s).toLocaleDateString("es-AR", { timeZone: "UTC" })
const num = (v: string) => Number(v).toLocaleString("es-AR", { maximumFractionDigits: 2 })
/** "120 fardos · 1.000 kg": las unidades nunca se suman entre sí. */
export const textoTotales = (t: TotalUnidad[]) => t.map((x) => `${num(x.cantidad)} ${x.unidad}`).join(" · ")

/** Forraje de una parcela: lo cosechado en sus campañas y lo consumido en ella. */
export function ForrajeParcela({ forraje, sectorId }: { forraje: ForrajeFicha; sectorId: string }) {
  if (!forraje.producido.length && !forraje.consumido.length) return null
  return (
    <section className="rounded-lg border p-3 text-sm" aria-label="Forraje de la parcela">
      <h3 className="mb-1 font-medium">Forraje</h3>
      <dl className="grid grid-cols-2 gap-2">
        <div><dt className="text-muted-foreground">Cosechado aquí</dt><dd className="font-medium">{textoTotales(forraje.producido) || "—"}</dd></div>
        <div><dt className="text-muted-foreground">Consumido aquí</dt><dd className="font-medium">{textoTotales(forraje.consumido) || "—"}</dd></div>
      </dl>
      {forraje.consumos.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {forraje.consumos.map((c) => (
            <li key={c.id}>{fecha(c.fecha)} · {num(c.cantidad)} {c.unidad} de {c.reserva}{c.lote ? ` · ${c.lote}` : ""}</li>
          ))}
        </ul>
      )}
      <Link className="mt-2 inline-block text-xs underline" href={`/cultivos?sectorId=${sectorId}`}>Ver campañas y cosechas</Link>
    </section>
  )
}

/** Últimos movimientos de las reservas guardadas en un galpón. */
export function ForrajeGalpon({ forraje }: { forraje: ForrajeFicha }) {
  if (!forraje.movimientosGalpon.length) return null
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium">Últimos movimientos de forraje</summary>
      <ul className="mt-2 space-y-1 text-xs">
        {forraje.movimientosGalpon.map((m) => (
          <li key={m.id}>
            {fecha(m.fecha)} · {m.tipo === "entrada" ? "+" : "−"}{num(m.cantidad)} {m.unidad} · {m.reserva}
            {m.concepto ? ` · ${CONCEPTO_FORRAJE_LABEL[m.concepto]}` : ""} — {m.motivo}
          </li>
        ))}
      </ul>
    </details>
  )
}
