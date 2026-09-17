import { AppShell } from "@/components/layout/app-shell"
import { Ticker } from "@/components/layout/ticker"
import { OnboardingGuard } from "@/components/configuracion/onboarding-guard"

/**
 * Layout para páginas autenticadas
 * Incluye el AppShell con sidebar, header, etc.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <OnboardingGuard>
      <div className="flex h-dvh flex-col overflow-hidden">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-3">Saltar al contenido</a>
        <Ticker />
        <div className="flex-1 min-h-0 bg-background">
          <AppShell>
            {children}
          </AppShell>
        </div>
      </div>
    </OnboardingGuard>
  )
}
