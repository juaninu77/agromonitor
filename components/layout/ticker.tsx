"use client"

import { Calendar } from "lucide-react"

export function Ticker() {
  const today = new Date()
  const formatted = today.toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="relative z-40 bg-primary text-primary-foreground border-b border-primary-foreground/20 shadow-sm overflow-hidden">
      <div className="flex items-center min-h-10 px-4 py-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span className="text-sm font-medium capitalize">{formatted}</span>
          <span className="text-sm ml-4 text-primary-foreground/70">AgroMonitor</span>
        </div>
      </div>
    </div>
  )
}
