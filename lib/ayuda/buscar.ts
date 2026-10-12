// Búsqueda y navegación de la ayuda (apto para el cliente, sin dependencias).

export interface GuiaAyuda {
  id: string
  titulo: string
  /** Una o dos oraciones: para qué sirve */
  resumen?: string
  /** Pasos numerados, con los nombres exactos de los botones */
  pasos?: string[]
  /** Reglas, avisos y consejos */
  notas?: string[]
  /** Quién puede hacerlo (roles) */
  quien?: string
}

export interface SeccionAyuda {
  id: string
  titulo: string
  /** Pantalla de la app a la que se refiere */
  ruta?: string
  descripcion: string
  guias: GuiaAyuda[]
}

/** Minúsculas y sin tildes, para buscar "vacunacion" y encontrar "vacunación". */
export const normalizar = (texto: string) => texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

const textoDe = (s: SeccionAyuda, g: GuiaAyuda) => normalizar([s.titulo, g.titulo, g.resumen, g.quien, ...(g.pasos ?? []), ...(g.notas ?? [])].filter(Boolean).join(" "))

/** Raíz de una palabra larga, para que «vacunación» encuentre «vacunar» y «transferencia», «transferir». */
const raiz = (palabra: string) => (palabra.length >= 6 ? palabra.slice(0, 5) : palabra)

/** Secciones con las guías que contienen todas las palabras buscadas (vacío = todo). */
export function buscarAyuda(secciones: SeccionAyuda[], consulta: string): SeccionAyuda[] {
  const palabras = normalizar(consulta).split(/\s+/).filter((p) => p.length > 1).map(raiz)
  if (!palabras.length) return secciones
  return secciones
    .map((s) => ({ ...s, guias: s.guias.filter((g) => { const t = textoDe(s, g); return palabras.every((p) => t.includes(p)) }) }))
    .filter((s) => s.guias.length > 0)
}

/** Ancla de una guía dentro de la página de ayuda. */
export const anclaGuia = (seccionId: string, guiaId: string) => `${seccionId}--${guiaId}`

/** Sección de la ayuda que corresponde a la pantalla actual (para el botón «Ayuda» del encabezado). */
export function seccionDeRuta(pathname: string): string | null {
  const [primero, segundo] = pathname.split("/").filter(Boolean)
  if (!primero) return "panel"
  if (primero === "configuracion") return segundo === "equipo" ? "equipo" : segundo === "cuenta" ? "cuenta" : "configuracion"
  if (primero === "mapa") return "potreros"
  return primero
}
