// Filtros reutilizables de scoping multi-tenant para rutas API.
// Regla del repo: toda query en /app/api debe filtrar por los
// establecimientoIds/organizacionIds del contexto de withAuth.

import { prisma } from "@/lib/prisma"

/** Filtro directo para modelos con establecimientoId propio (Animal, Lote, Sector, Tarea, SesionManga, DocumentoTransito). */
export function scopeEstablecimiento(establecimientoIds: string[]) {
  return { establecimientoId: { in: establecimientoIds } }
}

/** Filtro directo para modelos con organizacionId propio (Cliente, Proveedor, Producto, Dieta). */
export function scopeOrganizacion(organizacionIds: string[]) {
  return { organizacionId: { in: organizacionIds } }
}

/**
 * Filtro para tablas de eventos que referencian animalId O loteId
 * (EvtPesada, EvtSanidad, EvtMovimiento, EvtAlimentacion, EvtPastoreo).
 */
export function scopeEventoAnimalOLote(establecimientoIds: string[]) {
  return {
    OR: [
      { animal: { establecimientoId: { in: establecimientoIds } } },
      { lote: { establecimientoId: { in: establecimientoIds } } },
    ],
  }
}

/** Filtro para eventos solo-animal (EvtTacto, EvtBaja, EvtDestete: campo `animal`; EvtServicio/EvtParicion usan hembra/madre). */
export function scopeEventoAnimal(establecimientoIds: string[]) {
  return { animal: { establecimientoId: { in: establecimientoIds } } }
}

/** Verifica que un animal exista y pertenezca al tenant. Devuelve el animal o null. */
export async function animalDelTenant(
  animalId: string,
  establecimientoIds: string[]
) {
  return prisma.animal.findFirst({
    where: { id: animalId, establecimientoId: { in: establecimientoIds } },
  })
}

/** Verifica que un lote pertenezca al tenant. */
export async function loteDelTenant(loteId: string, establecimientoIds: string[]) {
  return prisma.lote.findFirst({
    where: { id: loteId, establecimientoId: { in: establecimientoIds } },
  })
}

/** Verifica que un sector pertenezca al tenant. */
export async function sectorDelTenant(
  sectorId: string,
  establecimientoIds: string[]
) {
  return prisma.sector.findFirst({
    where: { id: sectorId, establecimientoId: { in: establecimientoIds } },
  })
}

/**
 * Resuelve el establecimiento destino de una creación:
 * usa el pedido si viene y es accesible; si no viene y el usuario
 * tiene un solo establecimiento, usa ese. Devuelve null si es inválido.
 */
export function resolverEstablecimientoDestino(
  solicitado: string | null | undefined,
  establecimientoIds: string[]
): string | null {
  if (solicitado) {
    return establecimientoIds.includes(solicitado) ? solicitado : null
  }
  return establecimientoIds.length === 1 ? establecimientoIds[0] : null
}
