"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, WifiOff, ShieldAlert, ServerCrash } from "lucide-react"

interface ErrorStateProps {
  error: string | null
  onRetry?: () => void
  type?: "network" | "auth" | "server" | "unknown"
}

export function ErrorState({ error, onRetry, type = "unknown" }: ErrorStateProps) {
  // Determinar el tipo de error basado en el mensaje
  const errorType = type === "unknown" ? detectErrorType(error) : type

  const config = getErrorConfig(errorType)

  return (
    <Card className="border-2 border-red-200 bg-red-50">
      <CardContent className="py-12">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className={`rounded-full p-4 ${config.bgColor}`}>
            {config.icon}
          </div>
          <div className="text-center max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {config.title}
            </h3>
            <p className="text-sm text-gray-600 mb-1">
              {config.message}
            </p>
            {error && (
              <p className="text-xs text-gray-500 mt-2 font-mono bg-white p-2 rounded border border-gray-200">
                {error}
              </p>
            )}
          </div>
          {onRetry && (
            <Button
              onClick={onRetry}
              className="mt-4"
              variant="default"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function detectErrorType(error: string | null): "network" | "auth" | "server" | "unknown" {
  if (!error) return "unknown"

  const errorLower = error.toLowerCase()

  if (errorLower.includes("autenticado") || errorLower.includes("auth") || errorLower.includes("401")) {
    return "auth"
  }

  if (errorLower.includes("red") || errorLower.includes("network") || errorLower.includes("fetch")) {
    return "network"
  }

  if (errorLower.includes("500") || errorLower.includes("servidor") || errorLower.includes("server")) {
    return "server"
  }

  return "unknown"
}

function getErrorConfig(type: "network" | "auth" | "server" | "unknown") {
  switch (type) {
    case "network":
      return {
        icon: <WifiOff className="h-8 w-8 text-orange-600" />,
        bgColor: "bg-orange-100",
        title: "Error de conexión",
        message: "No se pudo conectar al servidor. Por favor, verifica tu conexión a internet e intenta nuevamente."
      }
    case "auth":
      return {
        icon: <ShieldAlert className="h-8 w-8 text-yellow-600" />,
        bgColor: "bg-yellow-100",
        title: "Sesión expirada",
        message: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente para continuar."
      }
    case "server":
      return {
        icon: <ServerCrash className="h-8 w-8 text-red-600" />,
        bgColor: "bg-red-100",
        title: "Error del servidor",
        message: "Ocurrió un error en el servidor. El equipo técnico ha sido notificado. Por favor, intenta nuevamente en unos minutos."
      }
    default:
      return {
        icon: <AlertCircle className="h-8 w-8 text-red-600" />,
        bgColor: "bg-red-100",
        title: "Error inesperado",
        message: "Ocurrió un error inesperado. Por favor, intenta nuevamente."
      }
  }
}

interface InlineErrorProps {
  message: string
  onDismiss?: () => void
}

export function InlineError({ message, onDismiss }: InlineErrorProps) {
  return (
    <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="ml-3 flex-1">
          <p className="text-sm text-red-800">{message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-3 inline-flex flex-shrink-0 text-red-600 hover:text-red-800"
          >
            <span className="sr-only">Cerrar</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
