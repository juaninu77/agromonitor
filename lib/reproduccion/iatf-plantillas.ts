// Plantillas de protocolos IATF (Fase E3), en código y aptas para el cliente. Las dosis son de
// referencia (dependen de la concentración de cada producto): se confirman al registrar cada paso.

export interface TratamientoIatf {
  nombre: string
  /** Dosis por hembra en `unidad` */
  dosis: number
  unidad: "ml" | "unidades"
  via: "intramuscular" | null
  nota?: string
}

export interface PasoIatf {
  dia: number
  titulo: string
  tratamientos: TratamientoIatf[]
  /** Paso de la inseminación: cierra el protocolo con el servicio IATF por grupo */
  inseminacion?: boolean
  nota?: string
}

export interface PlantillaIatf {
  id: string
  nombre: string
  descripcion: string
  pasos: PasoIatf[]
}

const DISPOSITIVO: TratamientoIatf = { nombre: "Dispositivo intravaginal con progesterona", dosis: 1, unidad: "unidades", via: null }
const BENZOATO: TratamientoIatf = { nombre: "Benzoato de estradiol (2 mg)", dosis: 2, unidad: "ml", via: "intramuscular", nota: "2 mg; con un producto de 1 mg/ml son 2 ml" }
const PGF: TratamientoIatf = { nombre: "Prostaglandina (cloprostenol 500 µg)", dosis: 2, unidad: "ml", via: "intramuscular" }
const ECG: TratamientoIatf = { nombre: "eCG (400 UI)", dosis: 2, unidad: "ml", via: "intramuscular", nota: "300 a 400 UI según la condición de las hembras" }
const RETIRO: TratamientoIatf = { nombre: "Retiro del dispositivo", dosis: 0, unidad: "unidades", via: null, nota: "Sin producto: se retira el dispositivo" }

export const PLANTILLAS_IATF: PlantillaIatf[] = [
  {
    id: "convencional_8",
    nombre: "Convencional 8 días (BE + eCG + CE)",
    descripcion: "El protocolo más usado en rodeos de cría: dispositivo 8 días, inseminación a las 48–54 h del retiro.",
    pasos: [
      { dia: 0, titulo: "Colocación del dispositivo + benzoato de estradiol", tratamientos: [DISPOSITIVO, BENZOATO] },
      { dia: 8, titulo: "Retiro del dispositivo + PGF + eCG + cipionato de estradiol", tratamientos: [RETIRO, PGF, ECG, { nombre: "Cipionato de estradiol (1 mg)", dosis: 0.5, unidad: "ml", via: "intramuscular", nota: "1 mg; con un producto de 2 mg/ml son 0,5 ml" }] },
      { dia: 10, titulo: "Inseminación (48–54 h del retiro)", tratamientos: [], inseminacion: true },
    ],
  },
  {
    id: "convencional_7",
    nombre: "Convencional 7 días (BE + eCG + CE)",
    descripcion: "Dispositivo 7 días; inseminación a las 52–56 h del retiro.",
    pasos: [
      { dia: 0, titulo: "Colocación del dispositivo + benzoato de estradiol", tratamientos: [DISPOSITIVO, BENZOATO] },
      { dia: 7, titulo: "Retiro del dispositivo + PGF + eCG + cipionato de estradiol", tratamientos: [RETIRO, PGF, ECG, { nombre: "Cipionato de estradiol (0,5 mg)", dosis: 0.25, unidad: "ml", via: "intramuscular" }] },
      { dia: 9, titulo: "Inseminación (52–56 h del retiro)", tratamientos: [], inseminacion: true },
    ],
  },
  {
    id: "jsynch_6",
    nombre: "J-Synch 6 días (vaquillonas)",
    descripcion: "Proestro prolongado: dispositivo 6 días, inseminación a las 72 h del retiro con GnRH.",
    pasos: [
      { dia: 0, titulo: "Colocación del dispositivo + benzoato de estradiol", tratamientos: [DISPOSITIVO, BENZOATO] },
      { dia: 6, titulo: "Retiro del dispositivo + PGF + eCG", tratamientos: [RETIRO, PGF, ECG] },
      { dia: 9, titulo: "Inseminación + GnRH (72 h del retiro)", tratamientos: [{ nombre: "GnRH (gonadorelina 100 µg)", dosis: 2, unidad: "ml", via: "intramuscular" }], inseminacion: true },
    ],
  },
]

export const plantillaIatf = (id: string) => PLANTILLAS_IATF.find((p) => p.id === id)

/** Tratamientos de un paso que llevan producto (el retiro del dispositivo no). */
export const tratamientosConProducto = (paso: PasoIatf) => paso.tratamientos.filter((t) => t.dosis > 0)

/** Fecha de un paso: D0 + días (AAAA-MM-DD). */
export function fechaDelPaso(fechaD0: string, dia: number) {
  return new Date(Date.parse(`${fechaD0}T00:00:00Z`) + dia * 86_400_000).toISOString().slice(0, 10)
}
