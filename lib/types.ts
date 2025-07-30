import type { LucideIcon } from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  label?: string
}

export type KpiCardData = {
  title: string
  value: string
  change: string
  changeType: "increase" | "decrease"
  description: string
  icon: LucideIcon
}

export type AlertData = {
  id: string
  title: string
  description: string
  timestamp: string
  type: "alert" | "warn" | "info"
  read: boolean
}

export type Company = {
  id: string
  name: string
  logo: string
}
