"use client"

import { useState, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ScanBarcode,
  Plus,
  Loader2,
  CalendarDays,
  ListChecks,
  Clock,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"

import { useTenant } from "@/lib/context/tenant-context"
import { SessionConfig } from "./components/session-config"
import { MangaWorkspace } from "./components/manga-workspace"
import { SessionSummary } from "./components/session-summary"
import { OnboardingTour } from "./components/onboarding-tour"
import { DocsPdfGenerator } from "./components/docs-pdf-generator"

const TIPO_LABELS: Record<string, string> = {
  pesada_rodeo: "Pesada de rodeo",
  vacunacion: "Vacunación",
  tacto: "Tacto",
  destete: "Destete",
  señalada: "Señalada",
  recepcion: "Recepción",
  general: "Trabajo general",
}

const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  activa: {
    label: "Activa",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  finalizada: {
    label: "Finalizada",
    className: "bg-gray-100 text-gray-800 border-gray-200",
  },
  cancelada: {
    label: "Cancelada",
    className: "bg-red-100 text-red-800 border-red-200",
  },
}

export default function MangaPage() {
  const { establecimientoActivo, isLoading: tenantLoading } = useTenant()
  const queryClient = useQueryClient()

  const [newSessionDialogOpen, setNewSessionDialogOpen] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [viewingSummary, setViewingSummary] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState("sesion")

  const establecimientoId = establecimientoActivo?.id || ""

  const {
    data: sessions = [],
    isLoading: loadingSessions,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ["manga-sessions", establecimientoId],
    queryFn: async () => {
      if (!establecimientoId) return []
      const res = await fetch(`/api/manga?establecimientoId=${establecimientoId}`)
      if (!res.ok) throw new Error("Error al cargar sesiones")
      const data = await res.json()
      return data.data || data || []
    },
    enabled: !!establecimientoId,
  })

  const existingActiveSession = sessions.find((s: any) => s.estado === "activa")
  const resolvedActiveId = activeSessionId || existingActiveSession?.id || null

  const {
    data: activeSessionDetail,
    refetch: refetchActiveDetail,
  } = useQuery({
    queryKey: ["manga-session-detail", resolvedActiveId],
    queryFn: async () => {
      if (!resolvedActiveId) return null
      const res = await fetch(`/api/manga/${resolvedActiveId}`)
      if (!res.ok) throw new Error("Error al cargar sesión")
      const data = await res.json()
      return data.data || data
    },
    enabled: !!resolvedActiveId,
    refetchInterval: resolvedActiveId ? 5000 : false,
  })

  const sessionForWorkspace = activeSessionDetail || existingActiveSession || null
  const isSessionActive = sessionForWorkspace?.estado === "activa"

  const handleSessionCreated = useCallback(
    (session: any) => {
      setActiveSessionId(session.id)
      setNewSessionDialogOpen(false)
      setActiveTab("sesion")
      queryClient.invalidateQueries({ queryKey: ["manga-sessions"] })
      toast.success("Sesión de manga iniciada")
    },
    [queryClient]
  )

  const handleFinalize = useCallback(() => {
    if (sessionForWorkspace) {
      setViewingSummary(sessionForWorkspace)
    }
    setActiveSessionId(null)
    queryClient.invalidateQueries({ queryKey: ["manga-sessions"] })
  }, [sessionForWorkspace, queryClient])

  const handleRefresh = useCallback(() => {
    refetchActiveDetail()
  }, [refetchActiveDetail])

  const handleViewSession = useCallback((session: any) => {
    setViewingSummary(session)
  }, [])

  const historialSessions = sessions
    .filter((s: any) => s.estado !== "activa")
    .sort(
      (a: any, b: any) =>
        new Date(b.fecha || b.iniciadaAt).getTime() -
        new Date(a.fecha || a.iniciadaAt).getTime()
    )

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!establecimientoActivo) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-1">Sin establecimiento</h2>
            <p className="text-muted-foreground text-sm">
              Seleccioná un establecimiento para acceder a la manga
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (viewingSummary) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ScanBarcode className="h-7 w-7 text-primary" />
            Resumen de Sesión
          </h1>
          <Button variant="outline" onClick={() => setViewingSummary(null)}>
            Volver a Manga
          </Button>
        </div>
        <SessionSummary session={viewingSummary} />
      </div>
    )
  }

  if (isSessionActive && sessionForWorkspace) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <MangaWorkspace
          session={sessionForWorkspace}
          onFinalize={handleFinalize}
          onRefresh={handleRefresh}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <ScanBarcode className="h-7 w-7 md:h-8 md:w-8 text-primary" />
            Manga
            <OnboardingTour />
            <DocsPdfGenerator />
          </h1>
          <p className="text-muted-foreground mt-1">
            Estación de trabajo para procesamiento de hacienda
          </p>
        </div>
        <Button
          onClick={() => setNewSessionDialogOpen(true)}
          className="h-12 px-6 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-lg text-base"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nueva Sesión
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sesion">Sesión Activa</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="sesion" className="mt-4">
          {loadingSessions ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card className="border-2 border-dashed border-gray-300">
              <CardContent className="p-12 text-center">
                <ScanBarcode className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
                <h2 className="text-xl font-semibold mb-2">Sin sesión activa</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Creá una nueva sesión de manga para comenzar a procesar animales.
                  Podés pesar, vacunar, hacer tacto y más.
                </p>
                <Button
                  onClick={() => setNewSessionDialogOpen(true)}
                  className="h-12 px-8 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-lg text-base"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nueva Sesión
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sesiones anteriores</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSessions ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : historialSessions.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">No hay sesiones anteriores</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historialSessions.map((ses: any) => {
                    const estadoInfo = ESTADO_BADGE[ses.estado] || {
                      label: ses.estado,
                      className: "",
                    }
                    return (
                      <button
                        key={ses.id}
                        onClick={() => handleViewSession(ses)}
                        className="w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-primary/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold truncate">
                                {ses.nombre}
                              </span>
                              <Badge className={`${estadoInfo.className} text-xs`}>
                                {estadoInfo.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {new Date(ses.fecha || ses.iniciadaAt).toLocaleDateString("es-AR")}
                              </span>
                              <span>{TIPO_LABELS[ses.tipo] || ses.tipo}</span>
                              <span className="flex items-center gap-1">
                                <ListChecks className="h-3.5 w-3.5" />
                                {ses.items?.length ?? ses.totalAnimales ?? ses._count?.items ?? 0} animales
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={newSessionDialogOpen} onOpenChange={setNewSessionDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanBarcode className="h-5 w-5 text-primary" />
              Nueva Sesión de Manga
            </DialogTitle>
            <DialogDescription>
              Configurá los parámetros de la sesión de trabajo
            </DialogDescription>
          </DialogHeader>
          <SessionConfig
            establecimientoId={establecimientoId}
            onSessionCreated={handleSessionCreated}
            onCancel={() => setNewSessionDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
