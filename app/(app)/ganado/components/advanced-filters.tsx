"use client"

import { useState, useEffect } from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, FilterX } from "lucide-react"

interface AdvancedFiltersProps {
  onFiltersChange: (filters: FilterValues) => void
}

export interface FilterValues {
  razas: string[]
  categorias: string[]
  pesoMin?: number
  pesoMax?: number
  edadMin?: number
  edadMax?: number
  estadoSalud?: string
  lote?: string
  ubicacion?: string
  ccMin?: number
  ccMax?: number
}

interface Raza {
  id: string
  nombre: string
}

interface Categoria {
  id: string
  nombre: string
}

export function AdvancedFilters({ onFiltersChange }: AdvancedFiltersProps) {
  const [filters, setFilters] = useState<FilterValues>({
    razas: [],
    categorias: [],
  })

  const [razas, setRazas] = useState<Raza[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [activeFiltersCount, setActiveFiltersCount] = useState(0)

  // Cargar razas y categorías
  useEffect(() => {
    Promise.all([
      fetch('/api/razas').then(r => r.json()),
      fetch('/api/categorias?especie=bovino').then(r => r.json())
    ]).then(([razasData, categoriasData]) => {
      if (razasData.success) setRazas(razasData.data)
      if (categoriasData.success) setCategorias(categoriasData.data)
    })
  }, [])

  // Cargar filtros desde localStorage
  useEffect(() => {
    const savedFilters = localStorage.getItem('ganadoFilters')
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters)
        setFilters(parsed)
        onFiltersChange(parsed)
      } catch (e) {
        console.error('Error loading saved filters:', e)
      }
    }
  }, [])

  // Guardar filtros en localStorage y contar filtros activos
  useEffect(() => {
    localStorage.setItem('ganadoFilters', JSON.stringify(filters))

    // Contar filtros activos
    let count = 0
    if (filters.razas.length > 0) count++
    if (filters.categorias.length > 0) count++
    if (filters.pesoMin || filters.pesoMax) count++
    if (filters.edadMin || filters.edadMax) count++
    if (filters.estadoSalud) count++
    if (filters.lote) count++
    if (filters.ubicacion) count++
    if (filters.ccMin || filters.ccMax) count++

    setActiveFiltersCount(count)
    onFiltersChange(filters)
  }, [filters, onFiltersChange])

  const handleToggleRaza = (razaId: string) => {
    setFilters(prev => ({
      ...prev,
      razas: prev.razas.includes(razaId)
        ? prev.razas.filter(id => id !== razaId)
        : [...prev.razas, razaId]
    }))
  }

  const handleToggleCategoria = (categoriaId: string) => {
    setFilters(prev => ({
      ...prev,
      categorias: prev.categorias.includes(categoriaId)
        ? prev.categorias.filter(id => id !== categoriaId)
        : [...prev.categorias, categoriaId]
    }))
  }

  const handleClearFilters = () => {
    const emptyFilters: FilterValues = {
      razas: [],
      categorias: [],
    }
    setFilters(emptyFilters)
    localStorage.removeItem('ganadoFilters')
  }

  return (
    <div className="border-2 border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Filtros Avanzados</h3>
          {activeFiltersCount > 0 && (
            <Badge variant="default" className="bg-blue-600">
              {activeFiltersCount} activo{activeFiltersCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="h-8"
          >
            <FilterX className="h-4 w-4 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      <Accordion type="multiple" className="w-full">
        {/* Raza */}
        <AccordionItem value="raza">
          <AccordionTrigger className="text-sm font-medium">
            Raza {filters.razas.length > 0 && `(${filters.razas.length})`}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {razas.map((raza) => (
                <div key={raza.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`raza-${raza.id}`}
                    checked={filters.razas.includes(raza.id)}
                    onChange={() => handleToggleRaza(raza.id)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor={`raza-${raza.id}`} className="cursor-pointer">
                    {raza.nombre}
                  </Label>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Categoría */}
        <AccordionItem value="categoria">
          <AccordionTrigger className="text-sm font-medium">
            Categoría {filters.categorias.length > 0 && `(${filters.categorias.length})`}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {categorias.map((categoria) => (
                <div key={categoria.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`cat-${categoria.id}`}
                    checked={filters.categorias.includes(categoria.id)}
                    onChange={() => handleToggleCategoria(categoria.id)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor={`cat-${categoria.id}`} className="cursor-pointer">
                    {categoria.nombre}
                  </Label>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Rango de Peso */}
        <AccordionItem value="peso">
          <AccordionTrigger className="text-sm font-medium">
            Rango de Peso {(filters.pesoMin || filters.pesoMax) && '✓'}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div>
                <Label>Peso (kg)</Label>
                <div className="flex gap-4 items-center mt-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.pesoMin || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      pesoMin: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                    className="w-24 px-2 py-1 border-2 border-gray-200 rounded"
                  />
                  <span>a</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.pesoMax || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      pesoMax: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                    className="w-24 px-2 py-1 border-2 border-gray-200 rounded"
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Condición Corporal */}
        <AccordionItem value="cc">
          <AccordionTrigger className="text-sm font-medium">
            Condición Corporal {(filters.ccMin || filters.ccMax) && '✓'}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div>
                <Label>CC (1-9)</Label>
                <div className="flex gap-4 items-center mt-2">
                  <input
                    type="number"
                    placeholder="Min"
                    min="1"
                    max="9"
                    step="0.5"
                    value={filters.ccMin || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      ccMin: e.target.value ? parseFloat(e.target.value) : undefined
                    }))}
                    className="w-24 px-2 py-1 border-2 border-gray-200 rounded"
                  />
                  <span>a</span>
                  <input
                    type="number"
                    placeholder="Max"
                    min="1"
                    max="9"
                    step="0.5"
                    value={filters.ccMax || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      ccMax: e.target.value ? parseFloat(e.target.value) : undefined
                    }))}
                    className="w-24 px-2 py-1 border-2 border-gray-200 rounded"
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Estado de Salud */}
        <AccordionItem value="salud">
          <AccordionTrigger className="text-sm font-medium">
            Estado de Salud {filters.estadoSalud && '✓'}
          </AccordionTrigger>
          <AccordionContent>
            <Select
              value={filters.estadoSalud || 'todos'}
              onValueChange={(value) => setFilters(prev => ({
                ...prev,
                estadoSalud: value === 'todos' ? undefined : value
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Saludable">Saludable</SelectItem>
                <SelectItem value="Atención">Atención</SelectItem>
                <SelectItem value="Tratamiento">Tratamiento</SelectItem>
                <SelectItem value="Crítico">Crítico</SelectItem>
              </SelectContent>
            </Select>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
