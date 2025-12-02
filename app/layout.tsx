import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionProvider } from "@/components/providers/session-provider"
import { TenantProvider } from "@/lib/context/tenant-context"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "AgroMonitor - Plataforma de Agricultura Inteligente",
  description: "Sistema de gestión integral para fincas y agricultura inteligente",
  generator: "v0.dev",
}

/**
 * Layout raíz - Solo contiene providers
 * El AppShell se mueve al grupo (app) para no mostrarse en login/register
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.variable)}>
        <SessionProvider>
          <TenantProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
              {children}
            </ThemeProvider>
          </TenantProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
