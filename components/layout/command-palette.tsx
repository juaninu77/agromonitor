"use client"

import { useState, useEffect } from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { Search, Calculator, Calendar, Users, Settings, Truck, Package, BarChart3 } from "lucide-react"
import { useRouter } from "next/navigation"

const commands = [
  { id: "dashboard", label: "Ir al Panel Principal", icon: BarChart3, action: "/" },
  { id: "livestock", label: "Ver Ganado", icon: Users, action: "/livestock" },
  { id: "fleet", label: "Gestionar Flota", icon: Truck, action: "/fleet" },
  { id: "inventory", label: "Revisar Inventario", icon: Package, action: "/inventory" },
  { id: "tasks", label: "Ver Tareas Pendientes", icon: Calendar, action: "/tasks" },
  { id: "settings", label: "Configuración", icon: Settings, action: "/settings" },
  { id: "calculator", label: "Calculadora de Costos", icon: Calculator, action: "/calculator" },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = (command: string) => {
    setOpen(false)
    router.push(command)
  }

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start rounded-lg bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64 border-2"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Buscar comandos...</span>
        <span className="inline-flex lg:hidden">Buscar...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Escribe un comando o busca..." />
        <CommandList>
          <CommandEmpty>No se encontraron resultados.</CommandEmpty>
          <CommandGroup heading="Navegación">
            {commands.map((command) => (
              <CommandItem key={command.id} onSelect={() => runCommand(command.action)}>
                <command.icon className="mr-2 h-4 w-4" />
                <span>{command.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
