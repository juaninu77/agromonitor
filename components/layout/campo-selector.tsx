"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Building2, MapPin, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useTenant } from "@/lib/context/tenant-context"

// ============================================
// SELECTOR DE CAMPO
// ============================================
// Este componente permite al usuario cambiar entre
// diferentes campos dentro de su organización

export function CampoSelector() {
  const [open, setOpen] = React.useState(false)
  const {
    organizacionActiva,
    campoActivo,
    organizaciones,
    campos,
    setOrganizacionActiva,
    setCampoActivo,
    isLoading,
  } = useTenant()

  // Si está cargando, mostrar spinner
  if (isLoading) {
    return (
      <Button variant="outline" className="w-[200px] justify-start" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Cargando...
      </Button>
    )
  }

  // Si no hay organizaciones, mostrar mensaje
  if (organizaciones.length === 0) {
    return (
      <Button variant="outline" className="w-[200px] justify-start" disabled>
        <Building2 className="mr-2 h-4 w-4 opacity-50" />
        Sin organizaciones
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[280px] justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-col items-start text-left">
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                {organizacionActiva?.nombre || "Seleccionar"}
              </span>
              <span className="font-medium truncate max-w-[180px]">
                {campoActivo?.nombre || "Elegir campo..."}
              </span>
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar campo..." />
          <CommandList>
            <CommandEmpty>No se encontraron campos.</CommandEmpty>
            
            {/* Organización actual y sus campos */}
            {organizacionActiva && (
              <CommandGroup heading={organizacionActiva.nombre}>
                {campos.map((campo) => (
                  <CommandItem
                    key={campo.id}
                    value={campo.nombre}
                    onSelect={() => {
                      setCampoActivo(campo)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        campoActivo?.id === campo.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{campo.nombre}</span>
                      <span className="text-xs text-muted-foreground">
                        {campo.hectareas} ha
                        {campo.renspa && ` • RENSPA: ${campo.renspa}`}
                      </span>
                    </div>
                  </CommandItem>
                ))}
                
                {campos.length === 0 && (
                  <CommandItem disabled>
                    <span className="text-muted-foreground">
                      No hay campos registrados
                    </span>
                  </CommandItem>
                )}
              </CommandGroup>
            )}
            
            {/* Otras organizaciones */}
            {organizaciones.length > 1 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Cambiar organización">
                  {organizaciones
                    .filter((org) => org.id !== organizacionActiva?.id)
                    .map((org) => (
                      <CommandItem
                        key={org.id}
                        value={org.nombre}
                        onSelect={() => {
                          setOrganizacionActiva(org)
                          // No cerrar el popover, permitir seleccionar campo
                        }}
                      >
                        <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{org.nombre}</span>
                      </CommandItem>
                    ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

