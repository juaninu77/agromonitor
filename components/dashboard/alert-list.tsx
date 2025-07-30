import { Bell } from "lucide-react"
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
import { AlertCircle, Info, TriangleAlert } from "lucide-react"

const alertIcons = {
  alert: <AlertCircle className="h-4 w-4 text-status-alert" />,
  warn: <TriangleAlert className="h-4 w-4 text-status-warn" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
}

function AlertItem({ alert }: { alert: (typeof alerts)[0] }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1">{alertIcons[alert.type]}</div>
      <div className="flex-1">
        <p className={cn("text-sm font-medium", !alert.read && "font-bold")}>{alert.title}</p>
        <p className="text-sm text-muted-foreground">{alert.description}</p>
        <p className="text-xs text-muted-foreground mt-1">{alert.timestamp}</p>
      </div>
      {!alert.read && <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" aria-label="Unread" />}
    </div>
  )
}

export function AlertList({ isMenu = true }: { isMenu?: boolean }) {
  const unreadCount = alerts.filter((a) => !a.read).length

  const alertContent = (
    <div className="flex flex-col gap-4">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} />
      ))}
    </div>
  )

  if (!isMenu) {
    return alertContent
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-status-alert"></span>
            </span>
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 md:w-96 p-4">
        <DropdownMenuLabel className="p-0 mb-2">Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator className="mb-4" />
        {alertContent}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
