// Importación de animales desde planillas (Excel / CSV).
// Funciones puras para interpretar encabezados y filas; el parseo del archivo
// y la plantilla usan `xlsx`, que ya es dependencia del proyecto.

import * as XLSX from "xlsx"

/** Campos que acepta una fila de importación (coinciden con filaAltaMasivaSchema). */
export type CampoImportacion =
  | "caravanaVisual"
  | "caravanaRfid"
  | "cuig"
  | "otroId"
  | "sexo"
  | "especie"
  | "raza"
  | "categoria"
  | "fechaNacimiento"
  | "fechaIngreso"
  | "pesoInicial"
  | "ccInicial"
  | "origen"
  | "lote"
  | "potrero"
  | "colorManto"
  | "estadoCastracion"
  | "denticion"
  | "notas"

/** Encabezados aceptados (en minúsculas, sin acentos) para cada campo. */
export const ALIAS_ENCABEZADOS: Record<CampoImportacion, string[]> = {
  caravanaVisual: ["caravana", "caravana visual", "visual", "numero", "nro", "n°", "tag", "caravana nro"],
  caravanaRfid: ["rfid", "eid", "caravana rfid", "caravana electronica", "electronica", "chip"],
  cuig: ["cuig", "senasa"],
  otroId: ["otro id", "otroid", "otro", "nombre", "identificacion", "marca"],
  sexo: ["sexo", "sex", "genero"],
  especie: ["especie"],
  raza: ["raza", "breed"],
  categoria: ["categoria", "cat", "clase"],
  fechaNacimiento: ["fecha nacimiento", "fecha de nacimiento", "nacimiento", "nacio", "fec nac", "fecha nac"],
  fechaIngreso: ["fecha ingreso", "fecha de ingreso", "ingreso", "fecha alta", "alta"],
  pesoInicial: ["peso", "peso inicial", "peso kg", "kg", "peso (kg)"],
  ccInicial: ["cc", "condicion corporal", "condicion", "ccorporal"],
  origen: ["origen", "procedencia"],
  lote: ["lote", "rodeo", "tropa"],
  potrero: ["potrero", "sector", "ubicacion", "corral"],
  colorManto: ["color", "pelaje", "color manto", "manto"],
  estadoCastracion: ["castracion", "castrado", "estado castracion"],
  denticion: ["denticion", "dientes"],
  notas: ["notas", "observaciones", "obs", "comentarios"],
}

/** Columnas de la plantilla, en orden, con su encabezado "oficial". */
export const COLUMNAS_PLANTILLA: { campo: CampoImportacion; encabezado: string; obligatorio?: boolean; ayuda: string }[] = [
  { campo: "caravanaVisual", encabezado: "Caravana", obligatorio: true, ayuda: "Número de caravana visual. Obligatoria salvo que cargues RFID o CUIG." },
  { campo: "caravanaRfid", encabezado: "RFID", ayuda: "Caravana electrónica (15 o 16 dígitos). Opcional." },
  { campo: "cuig", encabezado: "CUIG", ayuda: "Clave SENASA. Opcional." },
  { campo: "sexo", encabezado: "Sexo", obligatorio: true, ayuda: "M o F (también Macho / Hembra)." },
  { campo: "raza", encabezado: "Raza", obligatorio: true, ayuda: "Nombre exacto de la raza del catálogo (ej. Angus Negro)." },
  { campo: "categoria", encabezado: "Categoria", obligatorio: true, ayuda: "Nombre exacto de la categoría (ej. vaca, novillo, ternera)." },
  { campo: "fechaNacimiento", encabezado: "Fecha nacimiento", ayuda: "dd/mm/aaaa. Opcional, no puede ser futura." },
  { campo: "pesoInicial", encabezado: "Peso", ayuda: "Peso inicial en kg. Opcional." },
  { campo: "ccInicial", encabezado: "CC", ayuda: "Condición corporal 1 a 9. Opcional." },
  { campo: "lote", encabezado: "Lote", ayuda: "Nombre del lote del campo. Opcional." },
  { campo: "potrero", encabezado: "Potrero", ayuda: "Nombre del potrero o corral. Opcional." },
  { campo: "origen", encabezado: "Origen", ayuda: "cria_propia, compra u otro. Por defecto cria_propia." },
  { campo: "fechaIngreso", encabezado: "Fecha ingreso", ayuda: "Fecha de alta en el campo. Por defecto hoy." },
  { campo: "especie", encabezado: "Especie", ayuda: "bovino / ovino. Si se omite, la especie de la vista actual." },
  { campo: "notas", encabezado: "Observaciones", ayuda: "Texto libre. Opcional." },
]

export const normalizarEncabezado = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

/** Devuelve el campo al que corresponde un encabezado, o null si no se reconoce. */
export function mapearEncabezado(encabezado: string): CampoImportacion | null {
  const n = normalizarEncabezado(encabezado)
  if (!n) return null
  for (const [campo, alias] of Object.entries(ALIAS_ENCABEZADOS) as [CampoImportacion, string[]][]) {
    if (alias.some((a) => normalizarEncabezado(a) === n)) return campo
  }
  return null
}

export interface MapeoColumnas {
  /** Índice de columna → campo */
  columnas: Record<number, CampoImportacion>
  reconocidos: CampoImportacion[]
  ignorados: string[]
}

export function mapearEncabezados(encabezados: unknown[]): MapeoColumnas {
  const columnas: Record<number, CampoImportacion> = {}
  const reconocidos: CampoImportacion[] = []
  const ignorados: string[] = []
  encabezados.forEach((h, idx) => {
    const texto = h == null ? "" : String(h)
    const campo = mapearEncabezado(texto)
    if (campo && !reconocidos.includes(campo)) {
      columnas[idx] = campo
      reconocidos.push(campo)
    } else if (texto.trim()) {
      ignorados.push(texto.trim())
    }
  })
  return { columnas, reconocidos, ignorados }
}

const SEXO_ALIAS: Record<string, "M" | "F"> = {
  m: "M", macho: "M", male: "M", toro: "M", novillo: "M", h: "F", f: "F", hembra: "F", female: "F", vaca: "F",
}
const ORIGEN_ALIAS: Record<string, "cria_propia" | "compra" | "otro"> = {
  "cria propia": "cria_propia", cria_propia: "cria_propia", cria: "cria_propia", propia: "cria_propia", nacimiento: "cria_propia",
  compra: "compra", comprado: "compra", compra_propia: "compra",
  otro: "otro", otros: "otro",
}

/** Valor crudo de celda → valor normalizado para el campo. */
export function normalizarValor(campo: CampoImportacion, valor: unknown): unknown {
  if (valor === null || valor === undefined) return undefined
  if (campo === "fechaNacimiento" || campo === "fechaIngreso") {
    // Fechas: se dejan tal cual (string, número serial o Date); el servidor las interpreta
    if (valor instanceof Date) return valor.toISOString().slice(0, 10)
    return typeof valor === "string" && !valor.trim() ? undefined : valor
  }
  const texto = String(valor).trim()
  if (!texto) return undefined
  switch (campo) {
    case "sexo":
      return SEXO_ALIAS[normalizarEncabezado(texto)] ?? texto.toUpperCase()
    case "origen":
      return ORIGEN_ALIAS[normalizarEncabezado(texto)] ?? texto.toLowerCase()
    case "pesoInicial":
    case "ccInicial":
      return typeof valor === "number" ? valor : texto.replace(",", ".")
    case "estadoCastracion":
      return texto.toLowerCase()
    default:
      return texto
  }
}

export interface FilaImportada {
  fila: number
  [campo: string]: unknown
}

/**
 * Convierte una matriz (fila de encabezados + filas de datos) en filas listas
 * para enviar al endpoint de alta masiva. Saltea filas totalmente vacías.
 */
export function filasDesdeMatriz(matriz: unknown[][], primeraFilaDatos = 2): { filas: FilaImportada[]; mapeo: MapeoColumnas } {
  const [encabezados = [], ...datos] = matriz
  const mapeo = mapearEncabezados(encabezados)
  const filas: FilaImportada[] = []
  datos.forEach((celdas, i) => {
    if (!celdas || celdas.every((c) => c === null || c === undefined || String(c).trim() === "")) return
    const fila: FilaImportada = { fila: primeraFilaDatos + i }
    for (const [idx, campo] of Object.entries(mapeo.columnas)) {
      const v = normalizarValor(campo, celdas[Number(idx)])
      if (v !== undefined) fila[campo] = v
    }
    filas.push(fila)
  })
  return { filas, mapeo }
}

/** Lee la primera hoja de un .xlsx/.xls/.csv y devuelve la matriz de celdas. */
export async function leerArchivoPlanilla(archivo: File | Blob): Promise<unknown[][]> {
  const buffer = await archivo.arrayBuffer()
  const wb = XLSX.read(buffer, { type: "array", cellDates: true })
  const hoja = wb.Sheets[wb.SheetNames[0]]
  if (!hoja) return []
  return XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: null, blankrows: false })
}

/** Genera la plantilla de importación (hoja de datos + hoja de instrucciones). */
export function generarPlantilla(opciones?: { razas?: string[]; categorias?: string[]; lotes?: string[]; potreros?: string[] }): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const encabezados = COLUMNAS_PLANTILLA.map((c) => c.encabezado)
  const ejemplo1: Record<string, unknown> = {
    Caravana: "A-001", RFID: "", CUIG: "", Sexo: "F", Raza: opciones?.razas?.[0] ?? "Angus Negro", Categoria: "vaca",
    "Fecha nacimiento": "15/03/2020", Peso: 420, CC: 5, Lote: opciones?.lotes?.[0] ?? "", Potrero: opciones?.potreros?.[0] ?? "",
    Origen: "cria_propia", "Fecha ingreso": "", Especie: "bovino", Observaciones: "Fila de ejemplo: borrala antes de importar",
  }
  const ejemplo2: Record<string, unknown> = {
    Caravana: "A-002", RFID: "982000000000002", CUIG: "", Sexo: "M", Raza: opciones?.razas?.[1] ?? "Hereford", Categoria: "novillo",
    "Fecha nacimiento": "", Peso: 310, CC: "", Lote: "", Potrero: "", Origen: "compra", "Fecha ingreso": "", Especie: "bovino", Observaciones: "",
  }
  const hoja = XLSX.utils.json_to_sheet([ejemplo1, ejemplo2], { header: encabezados })
  hoja["!cols"] = encabezados.map((h) => ({ wch: Math.max(12, h.length + 4) }))
  XLSX.utils.book_append_sheet(wb, hoja, "Animales")

  const instrucciones = [
    ["Columna", "Obligatoria", "Cómo completarla"],
    ...COLUMNAS_PLANTILLA.map((c) => [c.encabezado, c.obligatorio ? "Sí" : "No", c.ayuda]),
    [],
    ["Razas disponibles", "", (opciones?.razas ?? []).join(", ")],
    ["Categorías disponibles", "", (opciones?.categorias ?? []).join(", ")],
    ["Lotes del campo", "", (opciones?.lotes ?? []).join(", ")],
    ["Potreros del campo", "", (opciones?.potreros ?? []).join(", ")],
  ]
  const hojaInstr = XLSX.utils.aoa_to_sheet(instrucciones)
  hojaInstr["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 90 }]
  XLSX.utils.book_append_sheet(wb, hojaInstr, "Instrucciones")
  return wb
}

export function descargarPlantilla(opciones?: Parameters<typeof generarPlantilla>[0]) {
  const wb = generarPlantilla(opciones)
  XLSX.writeFile(wb, "plantilla-importacion-animales.xlsx")
}
