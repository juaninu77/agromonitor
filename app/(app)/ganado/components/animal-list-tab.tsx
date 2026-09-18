"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { List, Grid3x3, ArrowUpDown, Plus } from "lucide-react"
import type { AnimalAPI, PaginationInfo } from "@/lib/hooks/use-ganado"
import { DataPagination } from "./data-pagination"

interface AnimalListTabProps {
  animals: AnimalAPI[]
  isLoading: boolean
  pagination: PaginationInfo | null
  orderBy: string
  orderDirection: "asc" | "desc"
  onAnimalSelect: (animal: AnimalAPI) => void
  onOpenEdit: (id: string) => void
  onSort: (field: string) => void
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  onRegister: () => void
  hasFilters: boolean
}

export function AnimalListTab({
  animals,
  isLoading,
  pagination,
  orderBy,
  orderDirection,
  onAnimalSelect,
  onOpenEdit,
  onSort,
  onPageChange,
  onLimitChange,
  onRegister,
  hasFilters,
}: AnimalListTabProps) {
  const [view, setView] = useState("lista")
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" role="status">
          {isLoading
            ? "Buscando animales…"
            : `${pagination?.total ?? 0} resultados`}
        </p>
        <div className="flex items-center gap-2">
          <Select value={orderBy} onValueChange={onSort}>
            <SelectTrigger className="w-36" aria-label="Ordenar animales por">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries({
                caravana: "Caravana",
                nombre: "Nombre",
                categoria: "Categoría",
                raza: "Raza",
                edad: "Edad",
              }).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon"
            variant="outline"
            aria-label={
              orderDirection === "asc"
                ? "Orden ascendente. Cambiar a descendente"
                : "Orden descendente. Cambiar a ascendente"
            }
            onClick={() => onSort(orderBy)}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <div
            className="hidden gap-1 sm:flex"
            role="group"
            aria-label="Presentación de animales"
          >
            <Button
              size="icon"
              variant={view === "lista" ? "default" : "ghost"}
              aria-label="Ver lista"
              aria-pressed={view === "lista"}
              onClick={() => setView("lista")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={view === "tarjetas" ? "default" : "ghost"}
              aria-label="Ver tarjetas"
              aria-pressed={view === "tarjetas"}
              onClick={() => setView("tarjetas")}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {isLoading ? (
        <div
          className="h-40 animate-pulse rounded-lg bg-muted"
          aria-label="Cargando listado"
        />
      ) : animals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <h2 className="font-semibold">
            {hasFilters
              ? "No hay coincidencias"
              : "Todavía no hay animales activos en esta vista"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {hasFilters
              ? "Probá otra caravana o limpiá los filtros."
              : "Podés registrar animales o consultar los vendidos desde el filtro de estado."}
          </p>
          {!hasFilters && (
            <Button onClick={onRegister} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Registrar animal
            </Button>
          )}
        </div>
      ) : (
        <>
          {view === "lista" && (
            <div className="hidden overflow-x-auto rounded-lg border sm:block">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Ganado del campo y especie seleccionados
                </caption>
                <thead className="bg-muted/60">
                  <tr>
                    {[
                      "Animal",
                      "Peso",
                      "Lote y ubicación",
                      "Estado",
                      "Ficha",
                    ].map((title) => (
                      <th
                        key={title}
                        scope="col"
                        className="px-4 py-3 text-left font-medium"
                      >
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {animals.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <button
                          className="text-left font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
                          onClick={() => onAnimalSelect(a)}
                        >
                          {a.caravanaVisual || a.caravanaRfid || a.nombre}
                        </button>
                        {a.nombre && a.nombre !== a.caravanaVisual && (
                          <p className="text-xs">{a.nombre}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {a.especie?.nombre} ·{" "}
                          {a.categoria?.nombre || "Sin categoría"} ·{" "}
                          {a.raza?.nombre || "Sin raza"}
                        </p>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {a.pesoActual ? `${a.pesoActual} kg` : "Sin pesada"}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {a.edad || "Edad sin registrar"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {a.lote || "Sin lote"}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {a.ubicacion || "Sin ubicación"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="capitalize">
                          {a.estadoVital}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onAnimalSelect(a)}
                          aria-label={`Ver ficha de ${a.caravanaVisual || a.nombre}`}
                        >
                          Ver ficha
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div
            className={`grid gap-3 ${view === "lista" ? "sm:hidden" : "sm:grid-cols-2 xl:grid-cols-3"}`}
          >
            {animals.map((a) => (
              <article key={a.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    {a.caravanaVisual || a.caravanaRfid || a.nombre}
                  </h3>
                  <Badge variant="outline" className="capitalize">
                    {a.estadoVital}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {a.especie?.nombre} · {a.categoria?.nombre || "Sin categoría"}{" "}
                  · {a.raza?.nombre || "Sin raza"}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Peso</dt>
                    <dd>
                      {a.pesoActual ? `${a.pesoActual} kg` : "Sin pesada"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Edad</dt>
                    <dd>{a.edad || "Sin registrar"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Lote</dt>
                    <dd>{a.lote || "Sin lote"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Ubicación</dt>
                    <dd>{a.ubicacion || "Sin ubicación"}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => onAnimalSelect(a)}
                  >
                    Ver ficha
                  </Button>
                  <Button variant="ghost" onClick={() => onOpenEdit(a.id)}>
                    Editar
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {pagination && (
            <DataPagination
              pagination={pagination}
              onPageChange={onPageChange}
              onLimitChange={onLimitChange}
            />
          )}
        </>
      )}
    </div>
  )
}
