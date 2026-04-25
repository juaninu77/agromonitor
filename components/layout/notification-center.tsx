"use client"

import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function NotificationCenter() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-xl border-2 border-transparent hover:border-border"
        >
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notificaciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0 border-2">
        <div className="p-4 border-b-2 border-border">
          <DropdownMenuLabel className="text-base font-semibold p-0">Notificaciones</DropdownMenuLabel>
        </div>
        <div className="p-6 text-center">
          <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No hay notificaciones nuevas</p>
          <p className="text-xs text-muted-foreground mt-1">
            Las alertas del sistema aparecerán aquí
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
