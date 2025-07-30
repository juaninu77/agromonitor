import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { cookies } from "next/headers"
import "./globals.css"
import { cn } from "@/lib/utils"
import { AppShell } from "@/components/layout/app-shell"
import { ThemeProvider } from "@/components/theme-provider"
import { Ticker } from "@/components/layout/ticker"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "AgroMonitor - Plataforma de Agricultura Inteligente",
  description: "Sistema de gestión integral para fincas y agricultura inteligente",
  generator: "v0.dev",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
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
  } catch (error) {
    // If parsing fails, use defaults
    console.warn("Failed to parse layout cookies, using defaults")
    defaultLayout = undefined
    defaultCollapsed = undefined
  }

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.variable)}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="flex flex-col min-h-screen">
            <Ticker />
            <div className="flex-1">
              <AppShell defaultLayout={defaultLayout} defaultCollapsed={defaultCollapsed} navCollapsedSize={4}>
                {children}
              </AppShell>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
