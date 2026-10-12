"use client"

import { useQuery } from "@tanstack/react-query"
import { Label } from "@/components/ui/label"

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

export interface Pajuela {
  id: string
  nombre: string
  unidad?: string
  stockTotal?: number
  lotes: { id: string; nroLote: string; saldo?: number }[]
}

/** Pajuelas (productos tipo semen) del inventario, con su stock y partidas. */
export function usePajuelas(enabled: boolean) {
  return useQuery({
    queryKey: ["repro", "pajuelas"],
    queryFn: async () => {
      const r = await fetch("/api/inventario?limit=500")
      const b = await r.json()
      return ((b.data ?? []) as (Pajuela & { tipo: string; activo?: boolean })[]).filter((p) => p.tipo === "semen" && p.activo !== false)
    },
    enabled,
    staleTime: 0,
  })
}

/**
 * «Pajuela del inventario» para IA/IATF: al elegirla se descuenta 1 por servicio (o 1 por hembra en
 * la carga por torada). Sin pajuela, el servicio se registra igual con el toro escrito a mano.
 */
export function PajuelaSelector({ id, value, onChange, cantidad = 1, enabled }: {
  id: string
  value: { productoId: string; loteId: string }
  onChange: (v: { productoId: string; loteId: string }, pajuela: Pajuela | undefined) => void
  /** Cuántas se van a descontar (servicios a registrar) */
  cantidad?: number
  enabled: boolean
}) {
  const pajuelas = usePajuelas(enabled)
  const elegida = pajuelas.data?.find((p) => p.id === value.productoId)
  const partidas = elegida?.lotes.filter((l) => (l.saldo ?? 0) > 0) ?? []
  const stock = elegida?.stockTotal ?? 0
  if (pajuelas.data && !pajuelas.data.length) {
    return <p className="text-xs text-muted-foreground">No hay semen cargado en Inventario. Para descontar pajuelas, creá un producto tipo «Semen (pajuelas)».</p>
  }
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-prod`}>Pajuela del inventario</Label>
          <select id={`${id}-prod`} className={selectClass} value={value.productoId} onChange={(e) => onChange({ productoId: e.target.value, loteId: "" }, pajuelas.data?.find((p) => p.id === e.target.value))}>
            <option value="">No descontar</option>
            {(pajuelas.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombre} · {(p.stockTotal ?? 0).toLocaleString("es-AR")} {p.unidad ?? "pajuelas"}</option>)}
          </select>
        </div>
        {elegida && partidas.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-lote`}>Partida</Label>
            <select id={`${id}-lote`} className={selectClass} value={value.loteId} onChange={(e) => onChange({ ...value, loteId: e.target.value }, elegida)}>
              <option value="">Automática</option>
              {partidas.map((l) => <option key={l.id} value={l.id}>{l.nroLote} · {(l.saldo ?? 0).toLocaleString("es-AR")}</option>)}
            </select>
          </div>
        )}
      </div>
      {elegida && (
        <p className={`text-xs ${stock < cantidad ? "text-destructive" : "text-muted-foreground"}`}>
          {stock < cantidad
            ? `No alcanzan: hay ${stock.toLocaleString("es-AR")} y se necesitan ${cantidad}. Registrá una entrada en Inventario o elegí «No descontar».`
            : `Se ${cantidad === 1 ? "descuenta 1 pajuela" : `descuentan ${cantidad} pajuelas`} (quedan ${(stock - cantidad).toLocaleString("es-AR")}).`}
        </p>
      )}
    </div>
  )
}
