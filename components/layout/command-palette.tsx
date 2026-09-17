"use client"

import { useState, useEffect } from "react"
import { useTenant } from "@/lib/context/tenant-context"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import {
  Search,
  LayoutDashboard,
  Bot,
  Syringe,
  Heart,
  MapPin,
  ShoppingCart,
  Settings,
  Scale,
  Plus,
  Loader2,
  FolderOpen,
  Truck,
  Sprout,
} from "lucide-react"
import { useRouter } from "next/navigation"

const navCommands = [
  { id: "flota", label: "Flota y mantenimiento", icon: Truck, action: "/flota" },
  { id: "cultivos", label: "Cultivos, pasturas y reservas de forraje", icon: Sprout, action: "/cultivos" },
  { id: "administracion", label: "Administración: patrimonio, comprobantes y documentos", icon: FolderOpen, action: "/administracion" },
  { id: "dashboard", label: "Panel de Control", icon: LayoutDashboard, action: "/" },
  { id: "ganado", label: "Ganado", icon: Bot, action: "/ganado" },
  { id: "sanidad", label: "Sanidad", icon: Syringe, action: "/sanidad" },
  { id: "reproduccion", label: "Reproducción", icon: Heart, action: "/reproduccion" },
  { id: "potreros", label: "Potreros", icon: MapPin, action: "/potreros" },
  { id: "ventas", label: "Ventas y Compras", icon: ShoppingCart, action: "/ventas" },
  { id: "config", label: "Configuración", icon: Settings, action: "/configuracion/establecimientos" },
  { id: "catalogo", label: "Catálogo (Razas, Categorías)", icon: Settings, action: "/configuracion/catalogo" },
]

const quickActions = [
  { id: "nuevo-animal", label: "Registrar Nuevo Animal", icon: Plus, action: "/ganado" },
  { id: "pesada", label: "Pesada Rápida", icon: Scale, action: "/ganado" },
  { id: "sanidad-rapida", label: "Evento Sanitario Rápido", icon: Syringe, action: "/sanidad" },
]

interface AnimalResult {
  id: string
  caravanaVisual: string
  nombre?: string
  categoria?: { nombre: string }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [animalResults, setAnimalResults] = useState<AnimalResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const router = useRouter()
  const { establecimientoActivo } = useTenant()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setAnimalResults([])
    setIsSearching(false)
    if (search.length < 2 || !establecimientoActivo || !open) return
    const timer = setTimeout(() => {
      setIsSearching(true)
      fetch(`/api/ganado/bovinos?busqueda=${encodeURIComponent(search)}&establecimientoId=${establecimientoActivo.id}&limit=5`, { signal: controller.signal })
        .then(async res => { if (!res.ok) throw Error(); return res.json() })
        .then(data => { if (!controller.signal.aborted) setAnimalResults(data.data || []) })
        .catch(() => { if (!controller.signal.aborted) setAnimalResults([]) })
        .finally(() => { if (!controller.signal.aborted) setIsSearching(false) })
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [search, establecimientoActivo, open])

  const runCommand = (command: string) => {
    setOpen(false)
    setSearch("")
    router.push(command)
  }

  return (
    <>
      <Button
        variant="outline"
        className="relative h-10 w-full justify-start rounded-lg bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-72 border-2"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Buscar animal o sección...</span>
        <span className="inline-flex lg:hidden">Buscar...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar por caravana, nombre o sección..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>
            {isSearching ? (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </div>
            ) : (
              "No se encontraron resultados."
            )}
          </CommandEmpty>

          {animalResults.length > 0 && (
            <CommandGroup heading="Animales">
              {animalResults.map((animal) => (
                <CommandItem
                  key={animal.id}
                  value={`${animal.caravanaVisual ?? ""} ${animal.nombre ?? ""} ${animal.id}`}
                  onSelect={() => runCommand(`/ganado/${animal.id}`)}
                  className="flex items-center gap-2"
                >
                  <Bot className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">#{animal.caravanaVisual}</span>
                  {animal.nombre && <span className="text-muted-foreground">— {animal.nombre}</span>}
                  {animal.categoria && (
                    <span className="text-xs text-muted-foreground ml-auto">{animal.categoria.nombre}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Acciones Rápidas">
            {quickActions.map((cmd) => (
              <CommandItem key={cmd.id} onSelect={() => runCommand(cmd.action)}>
                <cmd.icon className="mr-2 h-4 w-4" />
                <span>{cmd.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Navegación">
            {navCommands.map((cmd) => (
              <CommandItem key={cmd.id} onSelect={() => runCommand(cmd.action)}>
                <cmd.icon className="mr-2 h-4 w-4" />
                <span>{cmd.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
