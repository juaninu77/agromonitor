"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CommandPalette } from "./command-palette"
import { NotificationCenter } from "./notification-center"
import { UserNav } from "./user-nav"
import { ThemeToggle } from "./theme-toggle"
import { CampoSelector } from "./campo-selector"

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b-2 border-border bg-background/95 backdrop-blur-md px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden rounded-xl border-2 border-transparent hover:border-border"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Abrir Menú</span>
      </Button>

      {/* Selector de Campo (Multi-Tenancy) */}
      <CampoSelector />

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
