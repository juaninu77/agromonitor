"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface AnimalOpcion {
  id: string
  caravanaVisual: string | null
  cuig: string | null
  caravanaRfid: string | null
  sexo: string
  especieId: string
  especie: { nombre: string } | null
  categoria: { nombre: string } | null
}

export const etiquetaAnimal = (a: { caravanaVisual: string | null; cuig?: string | null } | null | undefined) =>
  !a ? "—" : a.caravanaVisual || a.cuig || "Sin caravana"

/**
 * Selector de un animal activo del campo con búsqueda en el servidor (caravana, CUIG o
 * EID): no depende de traer todo el rodeo al cliente.
 */
export function AnimalCombobox({ id, estId, value, onChange, sexo, especieId, placeholder, disabled }: {
  id?: string
  estId: string
  value: AnimalOpcion | null
  onChange: (a: AnimalOpcion | null) => void
  sexo?: "M" | "F"
  especieId?: string
  placeholder: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [busqueda, setBusqueda] = useState("")
  useEffect(() => { const t = setTimeout(() => setBusqueda(q.trim()), 250); return () => clearTimeout(t) }, [q])

  const params = new URLSearchParams({ establecimientoId: estId, limit: "30", ...(sexo ? { sexo } : {}), ...(especieId ? { especieId } : {}), ...(busqueda ? { q: busqueda } : {}) })
  const animales = useQuery({
    queryKey: ["repro-animales", params.toString()],
    queryFn: async () => {
      const r = await fetch(`/api/reproduccion/animales?${params}`)
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error ?? "No se pudieron buscar los animales")
      return b.data as AnimalOpcion[]
    },
    enabled: open && !!estId,
    staleTime: 30_000,
  })

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ("") }}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? `${etiquetaAnimal(value)}${value.categoria ? ` · ${value.categoria.nombre}` : ""}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar caravana, CUIG o EID…" value={q} onValueChange={setQ} />
          <CommandList>
            {animales.isFetching && !animales.data ? (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando…</div>
            ) : animales.isError ? (
              <div role="alert" className="p-3 text-sm text-destructive">{animales.error.message}</div>
            ) : (
              <CommandEmpty>{busqueda ? "Sin resultados" : "No hay animales activos"}</CommandEmpty>
            )}
            {(animales.data ?? []).map((a) => (
              <CommandItem key={a.id} value={a.id} onSelect={() => { onChange(a.id === value?.id ? null : a); setOpen(false) }}>
                <Check className={cn("mr-2 h-4 w-4", value?.id === a.id ? "opacity-100" : "opacity-0")} aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{etiquetaAnimal(a)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[a.categoria?.nombre, a.especie?.nombre, a.sexo === "M" ? "macho" : "hembra"].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
