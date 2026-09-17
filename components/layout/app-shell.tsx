"use client"

import { useState } from "react"
import Link from "next/link"
import { Sprout } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { navItems } from "@/lib/config/navigation"
import { Nav } from "@/components/layout/nav"
import OfflineBanner from "../shared/offline-banner"
import { Header } from "./header"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

interface AppShellProps {
  children: React.ReactNode
}
export function AppShell({ children }: AppShellProps) {
  const [menuOpen,setMenuOpen]=useState(false)
  const brand=<Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Sprout className="h-6 w-6 text-primary"/>AgroMonitor</Link>
  return <TooltipProvider delayDuration={150}><div className="flex h-full min-h-0 w-full">
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-card lg:flex" aria-label="Navegación principal">
      <div className="flex h-16 shrink-0 items-center border-b px-5">{brand}</div>
      <div className="min-h-0 flex-1 overflow-y-auto py-3"><Nav isCollapsed={false} links={navItems}/></div>
      <p className="border-t px-5 py-4 text-xs text-muted-foreground">Gestión del campo</p>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <Header onMenuClick={()=>setMenuOpen(true)}/>
        <SheetContent side="left" className="flex w-[calc(100vw-2rem)] max-w-xs flex-col p-0"><SheetTitle className="sr-only">Menú principal</SheetTitle><div className="flex h-16 items-center border-b px-5">{brand}</div><div className="min-h-0 flex-1 overflow-y-auto"><Nav isCollapsed={false} links={navItems} onNavigate={()=>setMenuOpen(false)}/></div></SheetContent>
      </Sheet>
      <OfflineBanner/>
      <main id="contenido" className="min-h-0 flex-1 overflow-auto"><div className="erp-page">{children}</div></main>
    </div>
  </div></TooltipProvider>
}
