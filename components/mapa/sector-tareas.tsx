"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

interface Tarea { id: string; titulo: string; prioridad: string; estado: string; fechaLimite: string | null; asignadoA: { nombre: string; apellido: string } | null }

const PRIORIDAD: Record<string, string> = { urgente: "Urgente", alta: "Alta", media: "Media", baja: "Baja" }

/** Tareas abiertas del módulo Tareas vinculadas a este lugar. */
export function SectorTareas({ sectorId, fieldId }: { sectorId: string; fieldId: string }) {
  const query = useQuery<Tarea[]>({
    queryKey: ["tareas-sector", sectorId],
    queryFn: async () => {
      const r = await fetch(`/api/tareas?establecimientoId=${fieldId}&sectorId=${sectorId}&abiertas=1&limit=20&orderBy=fechaLimite&orderDirection=asc`)
      const b = await r.json()
      if (!r.ok) throw new Error(b.error ?? "No se pudieron cargar las tareas")
      return b.data
    },
  })
  if (query.isPending || query.isError || !query.data.length) return null
  return (
    <section className="space-y-2 rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Tareas del módulo Tareas</h3>
        <Link href={`/tareas?sectorId=${sectorId}`} className="text-xs font-medium text-primary underline">Ver en Tareas</Link>
      </div>
      <ul className="space-y-1">
        {query.data.map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-2">
            <span>{t.titulo}{t.asignadoA ? <span className="text-xs text-muted-foreground"> · {t.asignadoA.nombre} {t.asignadoA.apellido}</span> : null}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {PRIORIDAD[t.prioridad] ?? t.prioridad}{t.fechaLimite ? ` · vence ${new Date(t.fechaLimite).toLocaleDateString("es-AR")}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
