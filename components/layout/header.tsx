"use client"

import Image from "next/image"
import { ChevronDown, Search } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { AlertList } from "@/components/dashboard/alert-list"
import { UserNav } from "./user-nav"
import { ThemeToggle } from "./theme-toggle"
import React from "react"

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const [selectedCompany, setSelectedCompany] = React.useState(companies[0])

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Button variant="outline" size="icon" className="sm:hidden bg-transparent" onClick={onMenuClick}>
        <ChevronDown className="h-5 w-5" />
        <span className="sr-only">Toggle Menu</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 bg-transparent">
            <Image
              src={selectedCompany.logo || "/placeholder.svg"}
              alt={`${selectedCompany.name} logo`}
              width={20}
              height={20}
              className="rounded-sm"
            />
            <span className="hidden md:inline-block">{selectedCompany.name}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Switch Company</DropdownMenuLabel>
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
      <div className="relative ml-auto flex-1 md:grow-0">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Global Search..."
          className="w-full rounded-lg bg-secondary pl-8 md:w-[200px] lg:w-[320px]"
        />
      </div>
      <ThemeToggle />
      <AlertList />
      <UserNav />
    </header>
  )
}
