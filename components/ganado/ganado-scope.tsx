"use client"

import { createContext, useContext } from "react"
import { useTenant } from "@/lib/context/tenant-context"
import type { EspecieFiltro } from "@/lib/ganado/query"

export const GanadoScope = createContext<EspecieFiltro>("todos")

export function useGanadoScope() {
  const especie = useContext(GanadoScope)
  const { establecimientoActivo, organizacionActiva } = useTenant()
  return {
    especie,
    establecimientoId: establecimientoActivo?.id ?? "",
    organizacionId: organizacionActiva?.id ?? "",
  }
}
