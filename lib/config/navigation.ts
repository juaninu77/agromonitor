import {
  LayoutDashboard,
  Bot,
  Syringe,
  Heart,
  MapPin,
  ShoppingCart,
  Package,
  ClipboardList,
  ScanBarcode,
  Settings,
} from "lucide-react"
import type { NavItem } from "@/lib/types"

export const navItems: NavItem[] = [
  { title: "Panel de Control", href: "/", icon: LayoutDashboard },
  { title: "Ganado", href: "/ganado", icon: Bot },
  { title: "Manga", href: "/manga", icon: ScanBarcode },
  { title: "Sanidad", href: "/sanidad", icon: Syringe },
  { title: "Reproducción", href: "/reproduccion", icon: Heart },
  { title: "Potreros", href: "/potreros", icon: MapPin },
  { title: "Ventas y Compras", href: "/ventas", icon: ShoppingCart },
  { title: "Inventario", href: "/inventario", icon: Package },
  { title: "Tareas", href: "/tareas", icon: ClipboardList },
  { title: "Configuración", href: "/configuracion/establecimientos", icon: Settings },
]
