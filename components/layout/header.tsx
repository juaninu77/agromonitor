"use client"

import Image from "next/image"
import { ChevronDown, Menu } from "lucide-react"
import { companies } from "@/lib/mocks"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CommandPalette } from "./command-palette"
import { NotificationCenter } from "./notification-center"
import { UserNav } from "./user-nav"
import { ThemeToggle } from "./theme-toggle"
import React from "react"

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const [selectedCompany, setSelectedCompany] = React.useState(companies[0])

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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="gap-2 rounded-xl border-2 border-border hover:border-primary/30 bg-transparent"
          >
            <Image
              src={selectedCompany.logo || "/placeholder.svg"}
              alt={`${selectedCompany.name} logo`}
              width={20}
              height={20}
              className="rounded-sm"
            />
            <span className="hidden md:inline-block font-medium">{selectedCompany.name}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 rounded-xl border-2">
          <DropdownMenuLabel>Cambiar Empresa</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {companies.map((company) => (
            <DropdownMenuItem key={company.id} onSelect={() => setSelectedCompany(company)}>
              <Image
                src={company.logo || "/placeholder.svg"}
                alt={`${company.name} logo`}
                width={20}
                height={20}
                className="mr-2 rounded-sm"
              />
              {company.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

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
