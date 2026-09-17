/** Asigna únicamente cuando todas las evidencias coinciden. */
export function uniqueCandidate(ids: Array<string | null | undefined>): string | null {
  const candidates = new Set(ids.filter((id): id is string => Boolean(id)))
  return candidates.size === 1 ? [...candidates][0] : null
}

export function supplierCandidate(
  name: string,
  organizationId: string | null,
  suppliers: Array<{ id: string; nombre: string; organizacionId: string }>,
): string | null {
  if (!organizationId) return null
  const normalized = name.trim().toLowerCase()
  if (!normalized) return null
  return uniqueCandidate(suppliers
    .filter((supplier) => supplier.organizacionId === organizationId && supplier.nombre.trim().toLowerCase() === normalized)
    .map((supplier) => supplier.id))
}
