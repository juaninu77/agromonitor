// Sugerencia de destino al mover animales: ordena los lugares que admiten
// hacienda priorizando parcelas descansadas, con más pasto y donde la carga
// resultante no supere la capacidad. Devuelve el motivo en palabras.

import { formatearEv } from "./carga"
import { medicionVigente } from "./capas"
import { isParcel, livestockTypes } from "./sector-state"
import type { MapSector } from "./types"

export interface DestinoSugerido {
  sector: MapSector
  puntaje: number
  motivo: string
  /** Advertencia (sobrecarga, sin agua, etc.); no impide elegirlo. */
  aviso: string | null
}

/**
 * @param cantidad animales que se mueven
 * @param evMovidos EV de esos animales (estimado si no se conoce la categoría)
 */
export function rankearDestinos(sectors: MapSector[], origenId: string, cantidad: number, evMovidos: number, ahora = Date.now()): DestinoSugerido[] {
  return sectors
    .filter((s) => s.id !== origenId && livestockTypes.has(s.tipo))
    .map((s) => {
      const partes: string[] = []
      let puntaje = 0
      const parcela = isParcel(s.tipo)
      if (parcela) {
        if (s.animales === 0 && s.diasDescanso != null) {
          puntaje += Math.min(s.diasDescanso, 90) // hasta 90 días de descanso suman
          partes.push(`${s.diasDescanso} días de descanso`)
        } else if (s.animales === 0) {
          puntaje += 20
          partes.push("sin ocupación registrada")
        } else {
          puntaje -= 30
          partes.push(`ocupado por ${s.animales}`)
        }
        const h = s.ultimaMedicion?.alturaPastoCm
        if (h != null && medicionVigente(s, ahora)) {
          puntaje += Math.min(h, 40) * 1.5
          partes.push(`${h} cm de pasto`)
        }
      } else {
        puntaje -= 10 // corrales e instalaciones: para manejo, no para pastoreo
      }
      const superficie = s.superficieHa ?? s.areaMapaHa
      const evFinal = s.ev + evMovidos
      if (superficie && superficie > 0) {
        const carga = evFinal / superficie
        partes.push(`quedaría ${carga < 0.05 ? "menos de 0,1" : formatearEv(carga)} EV/ha`)
      }
      let aviso: string | null = null
      if (s.capacidad != null && s.animales + cantidad > s.capacidad) {
        puntaje -= 50
        aviso = `Supera la capacidad (${s.animales + cantidad} de ${s.capacidad})`
      } else if (s.agua && ["sin_agua", "requiere_revision"].includes(s.agua.estado)) {
        // Sin agua es crítico; "para revisar" solo resta un poco
        puntaje -= s.agua.estado === "sin_agua" ? 60 : 20
        aviso = s.agua.estado === "sin_agua" ? "Sin agua" : "Agua para revisar"
      }
      return { sector: s, puntaje, motivo: partes.join(" · "), aviso }
    })
    .sort((a, b) => b.puntaje - a.puntaje || a.sector.nombre.localeCompare(b.sector.nombre))
}
