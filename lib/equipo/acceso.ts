import { prisma } from "@/lib/prisma"

/** ¿El usuario es miembro activo con acceso a ese campo? (p. ej. para asignarle una tarea) */
export async function usuarioConAccesoACampo(usuarioId: string, establecimientoId: string) {
  const n = await prisma.membresia.count({
    where: {
      usuarioId, esActivo: true, usuario: { esActivo: true },
      organizacion: { establecimientos: { some: { id: establecimientoId } } },
      OR: [{ accesoTotal: true }, { rol: { in: ["propietario", "admin", "administrador"] } }, { establecimientosAcceso: { some: { establecimientoId } } }],
    },
  })
  return n > 0
}
