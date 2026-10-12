// Contenido de la página de Ayuda (/ayuda), en el orden del menú. Los textos entre «» son los
// nombres de botones y pestañas tal como aparecen en la pantalla: si cambia la interfaz, actualizar acá.
import type { SeccionAyuda } from "./buscar"
import { PRIMEROS_PASOS } from "./general"
import { GANADO, MANGA, PANEL, REPRODUCCION, SANIDAD } from "./hacienda"
import { CULTIVOS, FLOTA, INVENTARIO, POTREROS } from "./campo"
import { ADMINISTRACION, CONFIGURACION, CUENTA, EQUIPO, FINANZAS, TAREAS, VENTAS } from "./gestion"

export const SECCIONES_AYUDA: SeccionAyuda[] = [
  PRIMEROS_PASOS, PANEL, GANADO, MANGA, SANIDAD, REPRODUCCION, POTREROS, CULTIVOS, FLOTA,
  VENTAS, INVENTARIO, FINANZAS, ADMINISTRACION, TAREAS, EQUIPO, CUENTA, CONFIGURACION,
]
