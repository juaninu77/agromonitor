"use client"

import { useEffect, useMemo, useState } from "react"
import { useGanadoScope } from "@/components/ganado/ganado-scope"
import { esCatalogoVisible } from "@/lib/utils"

export interface EspecieOpt {
  id: string
  nombre: string
}
export interface RazaOpt {
  id: string
  nombre: string
  especieId: string
}
export interface CategoriaOpt {
  id: string
  nombre: string
  especieId: string
  sexo?: string | null
  edadMinMeses?: number | null
  edadMaxMeses?: number | null
}
export interface LoteOpt {
  id: string
  nombre: string
  especieId?: string
  especie?: { id?: string; nombre: string } | null
  activo?: boolean
}
export interface SectorOpt {
  id: string
  nombre: string
  tipo: string
}

interface Estado {
  especies: EspecieOpt[]
  razas: RazaOpt[]
  categorias: CategoriaOpt[]
  lotes: LoteOpt[]
  sectores: SectorOpt[]
  cargando: boolean
  error: string | null
}

const json = async <T,>(r: Response): Promise<T> => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()) as T
}

/**
 * Carga de una sola vez todo el catálogo que necesitan los formularios de alta
 * (especies visibles para la vista, razas, categorías, lotes y potreros del
 * campo activo). Expone helpers para filtrar por especie y sexo.
 */
export function useCatalogosAlta() {
  const { especie, organizacionId, establecimientoId } = useGanadoScope()
  const [estado, setEstado] = useState<Estado>({
    especies: [],
    razas: [],
    categorias: [],
    lotes: [],
    sectores: [],
    cargando: true,
    error: null,
  })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    if (!establecimientoId) return
    const controller = new AbortController()
    const { signal } = controller
    setEstado((s) => ({ ...s, cargando: true, error: null }))
    ;(async () => {
      try {
        const [esp, razas, cats, lotes, sectores] = await Promise.all([
          fetch("/api/especies", { signal }).then((r) => json<{ data: (EspecieOpt & { organizacionId?: string | null })[] }>(r)),
          fetch("/api/razas", { signal }).then((r) => json<{ data: RazaOpt[] }>(r)),
          fetch("/api/categorias", { signal }).then((r) => json<{ data: CategoriaOpt[] }>(r)),
          fetch(`/api/establecimientos/${establecimientoId}/lotes`, { signal }).then((r) => json<LoteOpt[] | { data: LoteOpt[] }>(r)),
          fetch(`/api/sectores?establecimientoId=${establecimientoId}`, { signal }).then((r) => json<{ data: SectorOpt[] }>(r)),
        ])
        if (signal.aborted) return
        const especies = esp.data.filter(
          (e) => esCatalogoVisible(e, organizacionId) && (especie === "todos" || e.nombre.toLowerCase() === especie),
        )
        const idsEspecie = new Set(especies.map((e) => e.id))
        setEstado({
          especies,
          razas: razas.data.filter((r) => idsEspecie.has(r.especieId)),
          categorias: cats.data.filter((c) => idsEspecie.has(c.especieId)),
          lotes: (Array.isArray(lotes) ? lotes : lotes.data).filter((l) => l.activo !== false),
          sectores: sectores.data.filter((s) => ["potrero", "corral", "feedlot"].includes(s.tipo)),
          cargando: false,
          error: null,
        })
      } catch (e) {
        if (signal.aborted) return
        console.error("Error cargando catálogos de alta:", e)
        setEstado((s) => ({ ...s, cargando: false, error: "No se pudieron cargar los catálogos del campo." }))
      }
    })()
    return () => controller.abort()
  }, [especie, organizacionId, establecimientoId, intento])

  const helpers = useMemo(
    () => ({
      razasDe: (especieId: string) => estado.razas.filter((r) => r.especieId === especieId),
      categoriasDe: (especieId: string, sexo?: "M" | "F") =>
        estado.categorias.filter((c) => c.especieId === especieId && (!sexo || c.sexo == null || c.sexo === sexo)),
      lotesDe: (especieId: string) => estado.lotes.filter((l) => (l.especieId ?? l.especie?.id) === especieId || (!l.especieId && !l.especie?.id)),
      especieDefault: () => estado.especies.find((e) => e.nombre.toLowerCase() === "bovino") ?? estado.especies[0],
    }),
    [estado.razas, estado.categorias, estado.lotes, estado.especies],
  )

  return { ...estado, ...helpers, reintentar: () => setIntento((n) => n + 1), establecimientoId }
}
