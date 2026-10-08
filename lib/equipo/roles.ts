// Roles dentro de una organización (Membresia.rol) y quién puede asignar qué.
// Apto para el cliente: no importa Prisma.

export const ROLES_ORG = ["propietario", "admin", "encargado", "vet", "operario"] as const
export type RolOrg = (typeof ROLES_ORG)[number]
/** Roles que se pueden asignar por invitación (propietario se transfiere/comparte después). */
export const ROLES_INVITABLES = ["admin", "encargado", "vet", "operario"] as const
export type RolInvitable = (typeof ROLES_INVITABLES)[number]

export const ROL_INFO: Record<RolOrg, { label: string; descripcion: string }> = {
  propietario: { label: "Propietario", descripcion: "Control total, incluidos los administradores y la organización." },
  admin: { label: "Administrador", descripcion: "Gestiona todo: datos, campos, finanzas y equipo (no puede quitar propietarios)." },
  encargado: { label: "Encargado", descripcion: "Carga y edita la operación diaria, inventario y finanzas de sus campos." },
  vet: { label: "Veterinario", descripcion: "Registra sanidad y reproducción; consulta el resto." },
  operario: { label: "Operario", descripcion: "Registra actividades de campo (pesadas, movimientos, manga); no borra." },
}

/** Membresias históricas usan "administrador": se trata igual que "admin". */
export function normalizarRolOrg(rol: string | null | undefined): RolOrg {
  if (rol === "administrador") return "admin"
  return (ROLES_ORG as readonly string[]).includes(rol ?? "") ? (rol as RolOrg) : "operario"
}

export const esGestor = (rol: RolOrg) => rol === "propietario" || rol === "admin"
/** Propietarios y administradores siempre ven todos los campos. */
export const admiteAccesoParcial = (rol: RolOrg) => !esGestor(rol)

/**
 * ¿Puede `actor` cambiar o quitar a alguien que hoy tiene `actual` y dejarlo como `nuevo`?
 * - Solo propietarios y administradores gestionan el equipo.
 * - Los administradores gestionan encargados, veterinarios y operarios, e invitan administradores.
 * - Solo un propietario cambia o quita a otro administrador o propietario, o nombra propietarios.
 */
export function puedeGestionar(actor: RolOrg, actual: RolOrg | null, nuevo: RolOrg | null): boolean {
  if (!esGestor(actor)) return false
  if (actor === "propietario") return true
  if (actual === "propietario" || actual === "admin") return false
  return nuevo !== "propietario"
}
