// Plantillas de protocolos sanitarios (spec 02 §2.2–2.5, §2.9). Viven en código: una
// organización las copia y las ajusta con su veterinario (productos, dosis, fechas).
// Las dosis no vienen precargadas: dependen del producto que use cada campo.
// Client-safe.

import type { ItemPlan } from "./plan"

export interface PlantillaProtocolo {
  codigo: string
  nombre: string
  descripcion: string
  especie: "bovino" | "ovino"
  zonaAplicable: "con_vacunacion" | "libre_sin_vacunacion" | null
  items: ItemPlan[]
}

const item = (i: Partial<ItemPlan> & Pick<ItemPlan, "nombre" | "momento">): ItemPlan => ({
  mes: null, dia: null, diasOffset: 0, repetirCadaDias: null, destinatarios: null, productoTipo: null, productoId: null,
  dosis: null, unidad: null, via: null, esAftosa: false, obligatorio: true, notas: null, ...i,
})

const PARASITOS_Y_SARNA_BOVINO: ItemPlan[] = [
  item({ nombre: "Antiparasitario interno (otoño)", momento: "campania_otono", destinatarios: "Categorías jóvenes y adultos", productoTipo: "antiparasitario", notas: "Rotar principios activos (ivermectina, levamisol…)." }),
  item({ nombre: "Antiparasitario interno (primavera)", momento: "campania_primavera", destinatarios: "Categorías jóvenes y adultos", productoTipo: "antiparasitario", notas: "Rotar principios activos." }),
  item({ nombre: "Sarna y piojos (otoño)", momento: "campania_otono", diasOffset: 15, destinatarios: "Todas las categorías", productoTipo: "antiparasitario", via: "pour-on", obligatorio: false, notas: "Con diagnóstico previo." }),
  item({ nombre: "Sarna y piojos (primavera)", momento: "campania_primavera", diasOffset: 15, destinatarios: "Todas las categorías", productoTipo: "antiparasitario", via: "pour-on", obligatorio: false, notas: "Con diagnóstico previo." }),
]

const CLOSTRIDIALES_BOVINO: ItemPlan[] = [
  item({ nombre: "Mancha y gangrena (clostridial)", momento: "destete", destinatarios: "Terneros al destete", productoTipo: "vacuna", notas: "Vacuna polivalente clostridial." }),
  item({ nombre: "Refuerzo clostridial", momento: "destete", diasOffset: 30, destinatarios: "Terneros y recría", productoTipo: "vacuna" }),
]

export const PLANTILLAS: PlantillaProtocolo[] = [
  {
    codigo: "bovino_con_vacunacion",
    nombre: "Bovino general (con vacunación)",
    descripcion: "Pampa húmeda estándar: aftosa en 2 campañas, brucelosis B19, carbunclo, clostridiales, parásitos y sarna.",
    especie: "bovino",
    zonaAplicable: "con_vacunacion",
    items: [
      item({ nombre: "Aftosa — campaña 1 (todas las categorías)", momento: "campania_otono", destinatarios: "Todas las categorías", productoTipo: "vacuna", esAftosa: true, notas: "Cronograma SENASA. Solo en zona con vacunación." }),
      item({ nombre: "Aftosa — campaña 2 (terneros)", momento: "campania_primavera", destinatarios: "Terneros y terneras", productoTipo: "vacuna", esAftosa: true, notas: "Cronograma SENASA." }),
      item({ nombre: "Brucelosis B19", momento: "campania_otono", destinatarios: "Terneras de 3 a 8 meses (una vez en la vida)", productoTipo: "vacuna", notas: "Simultánea con aftosa. RB51 para refugos." }),
      item({ nombre: "Carbunclo", momento: "campania_primavera", destinatarios: "Bovinos de más de 6 meses", productoTipo: "vacuna", notas: "Anual. Foco endémico en pampa húmeda." }),
      ...CLOSTRIDIALES_BOVINO,
      ...PARASITOS_Y_SARNA_BOVINO,
    ],
  },
  {
    codigo: "bovino_zlsv",
    nombre: "Bovino Patagonia (libre sin vacunación)",
    descripcion: "Zona libre de aftosa sin vacunación: sin aftosa; brucelosis B19, clostridiales, parásitos y sarna.",
    especie: "bovino",
    zonaAplicable: "libre_sin_vacunacion",
    items: [
      item({ nombre: "Brucelosis B19", momento: "campania_otono", destinatarios: "Terneras de 3 a 8 meses (una vez en la vida)", productoTipo: "vacuna", notas: "Excepto Tierra del Fuego." }),
      item({ nombre: "Carbunclo", momento: "campania_primavera", destinatarios: "Bovinos de más de 6 meses", productoTipo: "vacuna", obligatorio: false, notas: "En Patagonia, confirmar con el veterinario local." }),
      ...CLOSTRIDIALES_BOVINO,
      ...PARASITOS_Y_SARNA_BOVINO,
    ],
  },
  {
    codigo: "ovino_patagonia",
    nombre: "Ovino Patagonia base",
    descripcion: "Sarna, melofagosis y pediculosis 2 veces al año (Res. SENASA 40/2016), enterotoxemia, parásitos, brucelosis ovina e hidatidosis canina.",
    especie: "ovino",
    zonaAplicable: null,
    items: [
      item({ nombre: "Sarna, melofagosis y pediculosis (otoño)", momento: "campania_otono", destinatarios: "Toda la majada", productoTipo: "antiparasitario", notas: "Obligatorio (Res. SENASA 40/2016). Baño o inyectable." }),
      item({ nombre: "Sarna, melofagosis y pediculosis (primavera)", momento: "campania_primavera", destinatarios: "Toda la majada", productoTipo: "antiparasitario", notas: "Segunda dosis anual en majadas trashumantes." }),
      item({ nombre: "Enterotoxemia (clostridiales)", momento: "destete", destinatarios: "Corderos al destete y borregos", productoTipo: "vacuna", notas: "Vacuna polivalente." }),
      item({ nombre: "Parásitos gastrointestinales (otoño)", momento: "campania_otono", diasOffset: 15, destinatarios: "Corderos, borregos y vientres", productoTipo: "antiparasitario", notas: "Recomendado: control de resistencia (HPG)." }),
      item({ nombre: "Parásitos gastrointestinales (preparto)", momento: "campania_primavera", diasOffset: -30, destinatarios: "Vientres preparto", productoTipo: "antiparasitario" }),
      item({ nombre: "Brucelosis ovina (B. ovis)", momento: "pre_servicio", diasOffset: -45, destinatarios: "Carneros", notas: "Serología y examen testicular." }),
      item({ nombre: "Ectima contagioso", momento: "campania_primavera", destinatarios: "Majada con antecedentes", productoTipo: "vacuna", obligatorio: false, notas: "Solo si hubo casos." }),
      item({ nombre: "Hidatidosis: dosificar perros", momento: "inicio", repetirCadaDias: 45, destinatarios: "Perros del campo", productoTipo: "antiparasitario", notas: "Praziquantel cada 45 días (programa provincial)." }),
    ],
  },
  {
    codigo: "ovino_prolana",
    nombre: "Ovino PROLANA",
    descripcion: "Base ovina Patagonia con el calendario ordenado alrededor de la esquila (sin tratamientos cerca de la zafra).",
    especie: "ovino",
    zonaAplicable: null,
    items: [
      item({ nombre: "Revisar tratamientos antes de la esquila", momento: "pre_esquila", diasOffset: -30, destinatarios: "Toda la majada", obligatorio: false, notas: "No bañar ni aplicar pour-on cerca de la zafra." }),
      item({ nombre: "Sarna, melofagosis y pediculosis (post-esquila)", momento: "pre_esquila", diasOffset: 15, destinatarios: "Toda la majada", productoTipo: "antiparasitario", notas: "Res. SENASA 40/2016. Confirmar momento con el veterinario." }),
      item({ nombre: "Sarna, melofagosis y pediculosis (otoño)", momento: "campania_otono", destinatarios: "Toda la majada", productoTipo: "antiparasitario", notas: "Obligatorio (Res. SENASA 40/2016)." }),
      item({ nombre: "Enterotoxemia (clostridiales)", momento: "destete", destinatarios: "Corderos al destete y borregos", productoTipo: "vacuna" }),
      item({ nombre: "Parásitos gastrointestinales", momento: "campania_otono", diasOffset: 15, destinatarios: "Corderos, borregos y vientres", productoTipo: "antiparasitario" }),
      item({ nombre: "Brucelosis ovina (B. ovis)", momento: "pre_servicio", diasOffset: -45, destinatarios: "Carneros", notas: "Serología y examen testicular." }),
      item({ nombre: "Hidatidosis: dosificar perros", momento: "inicio", repetirCadaDias: 45, destinatarios: "Perros del campo", productoTipo: "antiparasitario", notas: "Praziquantel cada 45 días." }),
    ],
  },
  {
    codigo: "bovino_reproductores",
    nombre: "Bovino reproductores (toros)",
    descripcion: "Sanidad venérea y tuberculinización antes del servicio.",
    especie: "bovino",
    zonaAplicable: null,
    items: [
      item({ nombre: "Raspaje prepucial (tricomoniasis y campilobacteriosis)", momento: "pre_servicio", diasOffset: -45, destinatarios: "Toros", notas: "Anual, solo machos reproductores." }),
      item({ nombre: "Tuberculinización", momento: "pre_servicio", diasOffset: -60, destinatarios: "Reproductores", notas: "Anual y antes de movimientos (60–90 días antes del DT-e)." }),
      item({ nombre: "Revisión clínica y andrológica", momento: "pre_servicio", diasOffset: -30, destinatarios: "Toros", obligatorio: false }),
    ],
  },
]

export const plantillaPorCodigo = (codigo: string) => PLANTILLAS.find((p) => p.codigo === codigo) ?? null
