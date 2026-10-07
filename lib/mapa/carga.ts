// Carga animal en equivalentes vaca (EV), según docs/spec/06-forraje-carga-animal.md §6.5.
// Las equivalencias se buscan por nombre de categoría (sin acentos ni mayúsculas);
// si la categoría no está en la tabla se usa un valor por especie.

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

export const EV_POR_CATEGORIA: Record<string, number> = {
  "vaca con ternero": 1,
  "vaca + ternero": 1,
  vaca: 1,
  "vaca seca": 0.85,
  vaquillona: 0.75,
  novillito: 0.7,
  novillo: 0.95,
  ternero: 0.5,
  ternera: 0.5,
  toro: 1.2,
  torito: 0.9,
  oveja: 0.17,
  capon: 0.13,
  borrega: 0.13,
  borrego: 0.13,
  carnero: 0.18,
  cordero: 0.08,
  cordera: 0.08,
}

export const EV_POR_ESPECIE: Record<string, number> = {
  bovino: 0.8,
  ovino: 0.15,
  caprino: 0.15,
  equino: 1.2,
  porcino: 0.3,
}

/** EV de un animal según su categoría (o su especie si no hay categoría conocida). */
export function evDeAnimal(especie: string, categoria?: string | null): number {
  if (categoria) {
    const ev = EV_POR_CATEGORIA[normalizar(categoria)]
    if (ev !== undefined) return ev
  }
  return EV_POR_ESPECIE[normalizar(especie)] ?? 1
}

export interface ConteoUbicacion {
  especie: string
  categoria: string | null
  cantidad: number
}

export interface CargaLugar {
  animales: number
  porEspecie: Record<string, number>
  ev: number
  /** EV por hectárea (superficie declarada o, si no hay, la medida en el mapa). */
  evHa: number | null
  /** Animales ubicados respecto de la capacidad declarada, en %. */
  ocupacionPct: number | null
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Resume los conteos por especie/categoría de un lugar en animales, EV y carga. */
export function cargaDeLugar(conteos: ConteoUbicacion[], superficieHa: number | null, capacidad: number | null): CargaLugar {
  const porEspecie: Record<string, number> = {}
  let animales = 0
  let ev = 0
  for (const c of conteos) {
    const especie = normalizar(c.especie)
    porEspecie[especie] = (porEspecie[especie] ?? 0) + c.cantidad
    animales += c.cantidad
    ev += evDeAnimal(c.especie, c.categoria) * c.cantidad
  }
  return {
    animales,
    porEspecie,
    ev: r2(ev),
    evHa: superficieHa && superficieHa > 0 ? r2(ev / superficieHa) : null,
    ocupacionPct: capacidad && capacidad > 0 ? Math.round((animales / capacidad) * 100) : null,
  }
}

const PLURAL: Record<string, string> = { bovino: "bovinos", ovino: "ovinos", caprino: "caprinos", equino: "equinos", porcino: "porcinos" }

/** "12 bovinos · 3 equinos" (solo especies con animales). */
export function textoEspecies(porEspecie: Record<string, number>): string {
  return Object.entries(porEspecie)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([especie, n]) => `${n} ${n === 1 ? especie : PLURAL[especie] ?? `${especie}s`}`)
    .join(" · ")
}

export const formatearEv = (ev: number) => ev.toLocaleString("es-AR", { maximumFractionDigits: 1 })
