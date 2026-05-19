"use client"

import * as React from "react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { navItems } from "@/lib/config/navigation"
import { Nav } from "@/components/layout/nav"
import OfflineBanner from "../shared/offline-banner"
import { Header } from "./header"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

interface AppShellProps {
  defaultLayout: number[] | undefined
  defaultCollapsed: boolean | undefined
  navCollapsedSize: number
  children: React.ReactNode
}

export function AppShell({
  defaultLayout = [265, 1115],
  defaultCollapsed = false,
  navCollapsedSize,
  children,
}: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)
  const [isMobile, setIsMobile] = React.useState(false)
  const [isClient, setIsClient] = React.useState(false)
  const [isSheetOpen, setIsSheetOpen] = React.useState(false)

  React.useEffect(() => {
    setIsClient(true)
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const SidebarNav = () => <Nav isCollapsed={isCollapsed} links={navItems} />

  return (
    <TooltipProvider delayDuration={0}>
      {isClient && !isMobile ? (
        <ResizablePanelGroup
          direction="horizontal"
          onLayout={(sizes: number[]) => {
            try {
              document.cookie = `react-resizable-panels:layout=${JSON.stringify(sizes)}`
            } catch (error) {
              console.warn("Failed to save layout to cookie")
            }
          }}
          className="h-screen items-stretch"
        >
          <ResizablePanel
            defaultSize={defaultLayout[0]}
            collapsedSize={navCollapsedSize}
            collapsible={true}
            minSize={15}
            maxSize={20}
            onCollapse={() => {
              setIsCollapsed(true)
              try {
                document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(true)}`
              } catch (error) {
                console.warn("Failed to save collapsed state to cookie")
              }
            }}
            onExpand={() => {
              setIsCollapsed(false)
              try {
                document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(false)}`
              } catch (error) {
                console.warn("Failed to save collapsed state to cookie")
              }
            }}
            className={cn("hidden lg:block", isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out")}
          >
            <div className="flex h-14 items-center justify-center px-2">{/* You can add a logo here */}</div>
            <Separator />
            <SidebarNav />
          </ResizablePanel>
          <ResizableHandle withHandle className="hidden lg:flex" />
          <ResizablePanel defaultSize={defaultLayout[1]}>
            <div className="flex h-full flex-col">
              <Header onMenuClick={() => {}} />
              <OfflineBanner />
              <main className="flex-1 overflow-auto px-4 pb-6 pt-5 md:px-6 md:pb-8 md:pt-6">{children}</main>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex h-screen flex-col">
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <Header onMenuClick={() => setIsSheetOpen(true)} />
            <SheetContent side="left" className="flex w-[min(100vw-2rem,20rem)] flex-col p-0 sm:max-w-xs">
              <SheetTitle className="sr-only">Menú principal</SheetTitle>
              <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
                <span className="text-sm font-semibold tracking-tight text-foreground">AgroMonitor</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Nav
                  isCollapsed={false}
                  links={navItems}
                  onNavigate={() => setIsSheetOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
          <OfflineBanner />
          <main className="flex-1 overflow-auto px-4 pb-6 pt-5 md:px-6 md:pb-8 md:pt-6">{children}</main>
        </div>
      )}
    </TooltipProvider>
  )
}
