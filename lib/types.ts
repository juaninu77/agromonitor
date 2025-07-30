import type { LucideIcon } from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  label?: string
  badge?: number
}

export type KpiCardData = {
  title: string
  value: string
  change: string
  changeType: "increase" | "decrease"
  description: string
  icon: LucideIcon
  trend?: number[]
  target?: string
}

export type AlertData = {
  id: string
  title: string
  description: string
  timestamp: string
  type: "alert" | "warn" | "info" | "success"
  read: boolean
  priority: "low" | "medium" | "high" | "critical"
  category: string
  actionRequired?: boolean
}

export type Company = {
  id: string
  name: string
  logo: string
}

export type Vehicle = {
  id: string
  name: string
  type: "tractor" | "harvester" | "truck" | "sprayer"
  status: "active" | "inactive" | "maintenance" | "emergency"
  location: string
  coordinates?: { lat: number; lng: number }
  fuelLevel: number
  lastMaintenance: string
  nextMaintenance: string
  hoursWorked: number
  maxHours: number
  driver: string
  issues: string[]
  efficiency?: number
  costPerHour?: number
}

export type BiblicalVerse = {
  text: string
  reference: string
}

export type Task = {
  id: string
  title: string
  description: string
  priority: "low" | "medium" | "high" | "urgent"
  status: "pending" | "in-progress" | "completed" | "overdue"
  assignedTo: string
  dueDate: string
  category: string
  location?: string
  estimatedHours?: number
  completedAt?: string
}

export type WeatherData = {
  temperature: number
  condition: string
  humidity: number
  windSpeed: number
  windDirection: string
  visibility: number
  uvIndex: number
  pressure: number
  forecast: {
    day: string
    high: number
    low: number
    condition: string
    precipitation: number
  }[]
}

export type InventoryItem = {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  minStock: number
  maxStock: number
  cost: number
  supplier: string
  lastRestocked: string
  location: string
  expiryDate?: string
}

export type FinancialData = {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  cashFlow: number
  monthlyData: {
    month: string
    revenue: number
    expenses: number
    profit: number
  }[]
}

export type Notification = {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  timestamp: string
  read: boolean
  actionUrl?: string
  actionText?: string
}

export type Widget = {
  id: string
  title: string
  type: "kpi" | "chart" | "list" | "map" | "weather" | "tasks"
  size: "small" | "medium" | "large"
  position: { x: number; y: number }
  data?: any
  settings?: any
}

export type MapLayer = {
  id: string
  name: string
  visible: boolean
  color: string
  icon: LucideIcon
}

export type MapZone = {
  id: string
  name: string
  type: "potrero" | "cultivo" | "infraestructura" | "agua"
  coordinates: { lat: number; lng: number }[]
  center: { lat: number; lng: number }
  area: number // hectáreas
  status: "bueno" | "regular" | "malo" | "critico"
  details: {
    ganado?: number
    cultivo?: string
    estado?: string
    ultimaInspeccion?: string
    responsable?: string
  }
}

export type MapMarker = {
  id: string
  name: string
  type: "vehiculo" | "sensor" | "infraestructura" | "alerta" | "agua"
  coordinates: { lat: number; lng: number }
  status: "activo" | "inactivo" | "alerta" | "mantenimiento"
  details: any
  icon: LucideIcon
}

export type WeatherStation = {
  id: string
  name: string
  coordinates: { lat: number; lng: number }
  temperature: number
  humidity: number
  windSpeed: number
  rainfall: number
  soilMoisture: number
  lastUpdate: string
}
