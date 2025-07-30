import { Bot, Calendar, CircleDollarSign, Cpu, Droplets, Home, LandPlot, Settings, Wheat } from "lucide-react"
import type { AlertData, Company, KpiCardData, NavItem } from "./types"

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: Home },
  { title: "Livestock", href: "/livestock", icon: Bot },
  { title: "Crops", href: "/crops", icon: Wheat },
  { title: "IoT", href: "/iot", icon: Cpu },
  { title: "Finance", href: "/finance", icon: CircleDollarSign },
  { title: "Tasks", href: "/tasks", icon: Calendar },
  { title: "Settings", href: "/settings", icon: Settings },
]

export const kpiData: KpiCardData[] = [
  {
    title: "Total Herd",
    value: "1,250",
    change: "+2.5%",
    changeType: "increase",
    description: "from last month",
    icon: Bot,
  },
  {
    title: "Active Hectares",
    value: "8,420 ha",
    change: "+120 ha",
    changeType: "increase",
    description: "new pastures added",
    icon: LandPlot,
  },
  {
    title: "Cash on Hand",
    value: "$258.4k",
    change: "-8.1%",
    changeType: "decrease",
    description: "from last month",
    icon: CircleDollarSign,
  },
  {
    title: "Water Usage",
    value: "4.2M L",
    change: "+1.2%",
    changeType: "increase",
    description: "vs 7-day avg",
    icon: Droplets,
  },
]

export const alerts: AlertData[] = [
  {
    id: "alert-1",
    title: "Paddock #14 Fence Down",
    description: "Sensor G-45 reports a voltage drop.",
    timestamp: "2m ago",
    type: "alert",
    read: false,
  },
  {
    id: "alert-2",
    title: "Tractor Maintenance Due",
    description: "Vehicle #3 is due for its 500-hour service.",
    timestamp: "1h ago",
    type: "warn",
    read: false,
  },
  {
    id: "alert-3",
    title: "Low Battery: Eartag #822",
    description: "Collar battery at 15%.",
    timestamp: "3h ago",
    type: "warn",
    read: true,
  },
  {
    id: "alert-4",
    title: "Weather Alert: Hail",
    description: "Severe hail predicted for 4:00 PM.",
    timestamp: "6h ago",
    type: "alert",
    read: true,
  },
]

export const companies: Company[] = [
  { id: "acme-farms", name: "Acme Farms", logo: "/placeholder.svg?width=32&height=32" },
  { id: "pioneer-agri", name: "Pioneer Agriculture", logo: "/placeholder.svg?width=32&height=32" },
  { id: "greenfield-est", name: "Greenfield Estates", logo: "/placeholder.svg?width=32&height=32" },
]
