"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { memo, useMemo } from "react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface NavProps {
  isCollapsed: boolean
  links: {
    title: string
    label?: string
    icon: LucideIcon
    href: string
  }[]
}

// Componente memoizado para cada link
const NavLink = memo(({ 
  link, 
  isActive, 
  isCollapsed, 
  index 
}: { 
  link: { title: string; label?: string; icon: LucideIcon; href: string }
  isActive: boolean
  isCollapsed: boolean
  index: number
}) => {
  if (isCollapsed) {
    return (
      <Tooltip key={index} delayDuration={0}>
        <TooltipTrigger asChild>
          <Link
            href={link.href}
            prefetch={true}
            className={cn(
              buttonVariants({ variant: isActive ? "default" : "ghost", size: "icon" }),
              "h-10 w-10 rounded-xl",
              isActive && "shadow-md",
            )}
          >
            <link.icon className="h-4 w-4" />
            <span className="sr-only">{link.title}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-4">
          {link.title}
          {link.label && <span className="ml-auto text-muted-foreground">{link.label}</span>}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Link
      key={index}
      href={link.href}
      prefetch={true}
      className={cn(
        "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-accent hover:text-accent-foreground relative overflow-hidden",
        isActive
          ? "bg-primary text-primary-foreground shadow-md"
          : "text-muted-foreground hover:text-foreground",
        "justify-start",
      )}
    >
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 rounded-xl" />
      )}
      <div className="relative flex items-center gap-3">
        <link.icon className="h-5 w-5" />
        <span>{link.title}</span>
      </div>
      {link.label && (
        <span className="ml-auto relative text-xs bg-background/20 px-2 py-0.5 rounded-full">
          {link.label}
        </span>
      )}
    </Link>
  )
})

NavLink.displayName = "NavLink"

export const Nav = memo(function Nav({ links, isCollapsed }: NavProps) {
  const pathname = usePathname()

  // Memoizar los links procesados
  const processedLinks = useMemo(() => {
    return links.map((link, index) => ({
      link,
      isActive: link.href === "/" ? pathname === "/" : pathname.startsWith(link.href),
      index,
    }))
  }, [links, pathname])

  return (
    <TooltipProvider>
      <div data-collapsed={isCollapsed} className="group flex flex-col gap-2 py-2 data-[collapsed=true]:py-2">
        <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
          {processedLinks.map(({ link, isActive, index }) => (
            <NavLink
              key={`${link.href}-${index}`}
              link={link}
              isActive={isActive}
              isCollapsed={isCollapsed}
              index={index}
            />
          ))}
        </nav>
      </div>
    </TooltipProvider>
  )
})
