"use client"

import { Bell, Check, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { notifications } from "@/lib/mocks"
import { cn } from "@/lib/utils"

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "success":
      return "🎉"
    case "warning":
      return "⚠️"
    case "error":
      return "🚨"
    default:
      return "ℹ️"
  }
}

export function NotificationCenter() {
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-xl border-2 border-transparent hover:border-border"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-status-alert border-2 border-background">
              {unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notificaciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 border-2">
        <div className="flex items-center justify-between p-4 border-b-2 border-border">
          <DropdownMenuLabel className="text-base font-semibold">Notificaciones</DropdownMenuLabel>
          <Button variant="ghost" size="sm" className="h-auto p-1 text-xs">
            Marcar todas como leídas
          </Button>
        </div>
        <ScrollArea className="h-96">
          <div className="p-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border-2 border-transparent hover:bg-muted/50 hover:border-border/50 transition-all mb-2",
                  !notification.read && "bg-primary/5 border-primary/20",
                )}
              >
                <div className="text-lg">{getNotificationIcon(notification.type)}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <span className="text-xs text-muted-foreground">{notification.timestamp}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                  {notification.actionUrl && (
                    <Button variant="ghost" size="sm" className="h-auto p-1 text-xs text-primary">
                      <ExternalLink className="mr-1 h-3 w-3" />
                      {notification.actionText}
                    </Button>
                  )}
                </div>
                {!notification.read && (
                  <Button variant="ghost" size="sm" className="h-auto p-1">
                    <Check className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 border-t-2 border-border">
          <Button variant="outline" className="w-full border-2 bg-transparent">
            Ver Todas las Notificaciones
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
