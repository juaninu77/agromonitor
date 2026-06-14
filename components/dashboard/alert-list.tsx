import {
  AlertCircle,
  Bell,
  CircleCheck,
  Info,
  TriangleAlert,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { alerts } from "@/lib/mocks"
import { cn } from "@/lib/utils"

const alertIcons = {
  alert: <AlertCircle className="h-4 w-4 shrink-0 text-status-alert" />,
  warn: <TriangleAlert className="h-4 w-4 shrink-0 text-status-warn" />,
  info: <Info className="h-4 w-4 shrink-0 text-blue-500" />,
  success: <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" />,
}

function AlertItem({
  alert,
  isLast,
}: {
  alert: (typeof alerts)[0]
  isLast: boolean
}) {
  return (
    <li
      className={cn(
        "rounded-md px-2 py-2.5 -mx-2 transition-colors",
        !alert.read && "bg-muted/50",
        !isLast && "border-b border-border/70"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{alertIcons[alert.type]}</div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium leading-snug", !alert.read && "font-semibold")}>
            {alert.title}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground leading-snug">{alert.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">{alert.timestamp}</p>
        </div>
        {!alert.read && (
          <div
            className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"
            aria-label="No leída"
          />
        )}
      </div>
    </li>
  )
}

function AlertsPanelBody() {
  if (alerts.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay notificaciones por ahora.
      </p>
    )
  }

  return (
    <ul className="m-0 list-none p-0">
      {alerts.map((alert, index) => (
        <AlertItem key={alert.id} alert={alert} isLast={index === alerts.length - 1} />
      ))}
    </ul>
  )
}

export function AlertList({ isMenu = true }: { isMenu?: boolean }) {
  const unreadCount = alerts.filter((a) => !a.read).length

  const scrollableList = (
    /* Altura máxima + scroll: antes el panel crecía con cada ítem y empujaba el layout;
       con muchas alertas obliga a desplazar toda la página. */
    <div className="max-h-[min(70vh,22rem)] overflow-y-auto overscroll-contain pr-1">
      <AlertsPanelBody />
    </div>
  )

  if (!isMenu) {
    return scrollableList
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" type="button">
          <Bell className="h-5 w-5" aria-hidden />
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-status-alert px-1 text-[10px] font-semibold leading-none text-white"
              aria-hidden
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">
            {unreadCount > 0
              ? `Notificaciones, ${unreadCount} sin leer`
              : "Abrir notificaciones"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-4 md:w-96">
        <DropdownMenuLabel className="mb-1 p-0 text-base font-semibold">
          Notificaciones
          {unreadCount > 0 ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({unreadCount} sin leer)
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mb-3" />
        {scrollableList}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
