import type { GanadoStats } from "@/lib/hooks/use-ganado"

export function HerdOverview({
  stats,
  isLoading,
}: {
  stats: GanadoStats | null
  isLoading: boolean
}) {
  const metrics = [
    { label: "Animales encontrados", value: stats?.total ?? 0 },
    {
      label: "Peso promedio",
      value: stats?.conPeso ? `${stats.pesoPromedio} kg` : "Sin pesadas",
    },
    {
      label: "Sin pesada registrada",
      value: stats ? stats.total - stats.conPeso : 0,
    },
  ]
  return (
    <dl
      className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3"
      aria-busy={isLoading}
    >
      {metrics.map((m) => (
        <div key={m.label}>
          <dt className="text-xs text-muted-foreground">{m.label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">
            {isLoading ? "…" : m.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
