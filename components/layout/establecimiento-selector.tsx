"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Building2, MapPin, Loader2, Plus } from "lucide-react"
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
import { useRouter } from "next/navigation"

// ============================================
// SELECTOR DE ESTABLECIMIENTO
// ============================================
// Este componente permite al usuario cambiar entre
// diferentes establecimientos dentro de su organización

export function EstablecimientoSelector() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const {
    organizacionActiva,
    establecimientoActivo,
    organizaciones,
    establecimientos,
    setOrganizacionActiva,
    setEstablecimientoActivo,
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

  const handleCrearEstablecimiento = () => {
    setOpen(false)
    router.push("/configuracion/establecimientos?crear=true")
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
                {establecimientoActivo?.nombre || "Elegir establecimiento..."}
              </span>
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar establecimiento..." />
          <CommandList>
            <CommandEmpty>No se encontraron establecimientos.</CommandEmpty>
            
            {/* Organización actual y sus establecimientos */}
            {organizacionActiva && (
              <CommandGroup heading={organizacionActiva.nombre}>
                {establecimientos.map((establecimiento) => (
                  <CommandItem
                    key={establecimiento.id}
                    value={establecimiento.nombre}
                    onSelect={() => {
                      setEstablecimientoActivo(establecimiento)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        establecimientoActivo?.id === establecimiento.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{establecimiento.nombre}</span>
                      <span className="text-xs text-muted-foreground">
                        {establecimiento.hectareas ? `${establecimiento.hectareas} ha` : "Sin hectáreas"}
                        {establecimiento.renspa && ` • RENSPA: ${establecimiento.renspa}`}
                      </span>
                    </div>
                  </CommandItem>
                ))}
                
                {establecimientos.length === 0 && (
                  <CommandItem disabled>
                    <span className="text-muted-foreground">
                      No hay establecimientos registrados
                    </span>
                  </CommandItem>
                )}

                {/* Botón para crear nuevo establecimiento */}
                <CommandSeparator />
                <CommandItem onSelect={handleCrearEstablecimiento}>
                  <Plus className="mr-2 h-4 w-4 text-primary" />
                  <span className="text-primary font-medium">Crear nuevo establecimiento</span>
                </CommandItem>
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
                          // No cerrar el popover, permitir seleccionar establecimiento
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

