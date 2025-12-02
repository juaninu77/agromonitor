import { cookies } from "next/headers"
import { AppShell } from "@/components/layout/app-shell"
import { Ticker } from "@/components/layout/ticker"

/**
 * Layout para páginas autenticadas
 * Incluye el AppShell con sidebar, header, etc.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()

  let defaultLayout = undefined
  let defaultCollapsed = undefined

  try {
    const layoutCookie = cookieStore.get("react-resizable-panels:layout")
    const collapsedCookie = cookieStore.get("react-resizable-panels:collapsed")

    if (layoutCookie?.value) {
      defaultLayout = JSON.parse(layoutCookie.value)
    }

    if (collapsedCookie?.value) {
      defaultCollapsed = JSON.parse(collapsedCookie.value)
    }
  } catch {
    // Si falla el parsing, usar valores por defecto
    defaultLayout = undefined
    defaultCollapsed = undefined
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Ticker />
      <div className="flex-1">
        <AppShell 
          defaultLayout={defaultLayout} 
          defaultCollapsed={defaultCollapsed} 
          navCollapsedSize={4}
        >
          {children}
        </AppShell>
      </div>
    </div>
  )
}

