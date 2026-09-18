"use client"

import { useState, useEffect, useId } from "react"
import { useGanado } from "@/lib/hooks/use-ganado"
import { useGanadoScope } from "./ganado-scope"
import { especieLabels } from "@/lib/ganado/query"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function AnimalPicker({
  value,
  onChange,
  disabled,
  error,
}: {
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  error?: string
}) {
  const { establecimientoId, especie } = useGanadoScope()
  const id = useId()
  const [search, setSearch] = useState("")
  const [busqueda, setBusqueda] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => setBusqueda(search), 300)
    return () => clearTimeout(timer)
  }, [search])
  const {
    animales,
    isLoading,
    error: loadError,
    pagination,
  } = useGanado({
    establecimientoId,
    especie,
    busqueda,
    estadoVital: "activo",
    limit: 25,
  })
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Buscar animal · {especieLabels[especie]}</Label>
      <Input
        id={id}
        placeholder="Caravana, RFID o nombre"
        value={search}
        disabled={disabled}
        onChange={(e) => {
          setSearch(e.target.value)
          onChange("")
        }}
      />
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled || isLoading || search !== busqueda || !!loadError}
      >
        <SelectTrigger aria-label="Animal" aria-invalid={!!error}>
          <SelectValue placeholder="Seleccionar animal" />
        </SelectTrigger>
        <SelectContent>
          {animales.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.caravanaVisual || a.caravanaRfid || a.nombre} ·{" "}
              {a.categoria?.nombre || a.especie?.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground" role="status">
        {isLoading
          ? "Buscando…"
          : loadError ||
            (pagination?.total
              ? `${pagination.total} animales activos en este campo${pagination.hasNextPage ? ". Escribí para encontrar uno entre todos los resultados." : "."}`
              : "Sin animales activos para esta búsqueda.")}
      </p>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
