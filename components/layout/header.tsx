"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CommandPalette } from "./command-palette"
import { NotificationCenter } from "./notification-center"
import { UserNav } from "./user-nav"
import { ThemeToggle } from "./theme-toggle"
import { EstablecimientoSelector } from "./establecimiento-selector"

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur-md supports-[backdrop-filter]:bg-background/90 sm:gap-4 sm:px-6">
      {/*
        Debe coincidir con el breakpoint del sidebar en app-shell (lg).
        sm:hidden ocultaba el menú entre ~640px y 1024px → sin navegación en tablet.
      */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden shrink-0 rounded-xl border border-transparent hover:border-border hover:bg-accent"
        onClick={onMenuClick}
        type="button"
      >
        <Menu className="h-5 w-5" aria-hidden />
        <span className="sr-only">Abrir menú de navegación</span>
      </Button>

      {/* Selector de Campo (Multi-Tenancy) */}
      <EstablecimientoSelector />

      <div className="flex-1">
        <CommandPalette />
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <NotificationCenter />
        <UserNav />
      </div>
    </header>
  )
}
