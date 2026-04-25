"use client"

import { Bell, Check, CheckCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

type Notificacion = {
  id: string
  tipo: string
  titulo: string
  mensaje: string
  leida: boolean
  url: string | null
  createdAt: string
}

async function fetchNotificaciones(): Promise<Notificacion[]> {
  const res = await fetch("/api/notificaciones?leida=false")
  if (!res.ok) throw new Error("Error al obtener notificaciones")
  const json = await res.json()
  return json.data ?? []
}

async function marcarComoLeidas(payload: { ids?: string[]; all?: true }) {
  const res = await fetch("/api/notificaciones", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error("Error al marcar notificaciones")
  return res.json()
}

export function NotificationCenter() {
  const queryClient = useQueryClient()

  const { data: notificaciones = [], isLoading } = useQuery({
    queryKey: ["notificaciones", "no-leidas"],
    queryFn: fetchNotificaciones,
    refetchInterval: 30_000,
  })

  const { mutate: marcar, isPending } = useMutation({
    mutationFn: marcarComoLeidas,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificaciones"] })
    },
  })

  const count = notificaciones.length

  function handleClickNotificacion(notif: Notificacion) {
    marcar({ ids: [notif.id] })
    if (notif.url) {
      window.location.href = notif.url
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-xl border-2 border-transparent hover:border-border"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
          <span className="sr-only">Notificaciones</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0 border-2">
        <div className="flex items-center justify-between p-4 border-b-2 border-border">
          <DropdownMenuLabel className="text-base font-semibold p-0">
            Notificaciones
          </DropdownMenuLabel>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              disabled={isPending}
              onClick={() => marcar({ all: true })}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Marcar todas como leídas
            </Button>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : count === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No hay notificaciones nuevas
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Las alertas del sistema aparecerán aquí
              </p>
            </div>
          ) : (
            notificaciones.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleClickNotificacion(notif)}
                className={cn(
                  "flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50",
                  isPending && "pointer-events-none opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium leading-tight">
                    {notif.titulo}
                  </span>
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {notif.mensaje}
                </p>
                <span className="text-[11px] text-muted-foreground/60">
                  {formatDistanceToNow(new Date(notif.createdAt), {
                    addSuffix: true,
                    locale: es,
                  })}
                </span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
