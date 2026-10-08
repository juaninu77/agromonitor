"use client"

import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Settings, User, Users, Loader2 } from "lucide-react"
import { useTenant } from "@/lib/context/tenant-context"
import { normalizarRolOrg, ROL_INFO } from "@/lib/equipo/roles"

/**
 * Componente de navegación de usuario
 * Muestra el avatar y menú desplegable con opciones del usuario autenticado
 */
export function UserNav() {
  const { data: session, status } = useSession()
  const { organizacionActiva } = useTenant()

  // Si está cargando la sesión
  if (status === "loading") {
    return (
      <Button variant="ghost" className="relative h-8 w-8 rounded-full" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    )
  }

  // Si no hay sesión (no debería pasar si el middleware funciona)
  if (!session?.user) {
    return null
  }

  // Obtener iniciales del usuario
  const initials = `${session.user.nombre?.[0] || ''}${session.user.apellido?.[0] || ''}`.toUpperCase() || 'U'

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={session.user.image || undefined} alt={session.user.nombre || 'Usuario'} />
            <AvatarFallback className="bg-emerald-100 text-emerald-700 font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {session.user.nombre} {session.user.apellido}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {session.user.email}
            </p>
            {organizacionActiva?.rol && (
              <p className="text-xs leading-none text-emerald-600 mt-1">
                {ROL_INFO[normalizarRolOrg(organizacionActiva.rol)].label} · {organizacionActiva.nombre}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/configuracion/cuenta">
              <User className="mr-2 h-4 w-4" />
              Mi cuenta y espacios
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/configuracion/equipo">
              <Users className="mr-2 h-4 w-4" />
              Equipo y permisos
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/configuracion/establecimientos">
              <Settings className="mr-2 h-4 w-4" />
              Configuración
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleLogout}
          className="text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar Sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
