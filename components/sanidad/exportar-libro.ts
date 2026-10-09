// Libro sanitario: exporta el historial (con los filtros de la vista) a Excel o PDF.
// Se descarga página por página desde la API (máximo 100 por pedido).

import { formatoDia } from "@/lib/inventario/fechas"
import { ETIQUETA_MOTIVO, ETIQUETA_VIA } from "@/lib/sanidad/validation"

interface FilaApi {
  fecha: string
  dosis: number | null
  unidad: string | null
  via: string | null
  motivo: string | null
  carenciaDias: number | null
  veterinario: string | null
  aplicador: string | null
  costo: number | null
  observ: string | null
  cantidadAnimales: number | null
  anuladoAt: string | null
  motivoAnulacion: string | null
  animal: { caravanaVisual: string | null; cuig: string | null; otroId: string | null } | null
  lote: { nombre: string } | null
  producto: { nombre: string; retiroDias?: number | null }
  loteProducto: { nroLote: string } | null
}

const MAX_PAGINAS = 100

async function traerTodo(filtros: Record<string, string>) {
  const filas: FilaApi[] = []
  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const qs = new URLSearchParams({ ...filtros, page: String(page), limit: "100" })
    const r = await fetch(`/api/sanidad?${qs}`)
    const b = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(b.error ?? "No se pudo descargar el historial")
    filas.push(...(b.data as FilaApi[]))
    if (page >= (b.pagination?.totalPages ?? 1)) break
  }
  return filas
}

const destino = (f: FilaApi) => (f.animal ? f.animal.caravanaVisual || f.animal.cuig || f.animal.otroId || "Sin ID" : f.lote ? `Grupo ${f.lote.nombre}${f.cantidadAnimales ? ` (${f.cantidadAnimales})` : ""}` : "—")
const motivo = (m: string | null) => (m ? ETIQUETA_MOTIVO[m as keyof typeof ETIQUETA_MOTIVO] ?? m : "")
const via = (v: string | null) => (v ? ETIQUETA_VIA[v as keyof typeof ETIQUETA_VIA] ?? v : "")
const carencia = (f: FilaApi) => f.carenciaDias ?? f.producto.retiroDias ?? ""
const fechaArchivo = () => new Date().toISOString().slice(0, 10)

/** Descarga el historial filtrado y lo exporta. Devuelve la cantidad de filas. */
export async function exportarLibroSanitario(formato: "excel" | "pdf", filtros: Record<string, string>, subtitulo: string) {
  const filas = await traerTodo(filtros)
  if (formato === "excel") {
    const { exportToExcel } = await import("@/lib/utils/export-excel")
    exportToExcel({
      filename: `libro_sanitario_${fechaArchivo()}.xlsx`, sheetName: "Sanidad",
      data: filas.map((f) => ({
        fecha: formatoDia(f.fecha), destino: destino(f), producto: f.producto.nombre, lote: f.loteProducto?.nroLote ?? "",
        dosis: f.dosis ?? "", unidad: f.unidad ?? "", via: via(f.via), motivo: motivo(f.motivo), carencia: carencia(f),
        veterinario: f.veterinario ?? "", aplicador: f.aplicador ?? "", costo: f.costo ?? "", observ: f.observ ?? "",
        estado: f.anuladoAt ? `Anulado: ${f.motivoAnulacion ?? ""}` : "Vigente",
      })),
      columns: [
        { header: "Fecha", key: "fecha" }, { header: "Animal o grupo", key: "destino", width: 22 }, { header: "Producto", key: "producto", width: 26 },
        { header: "Lote", key: "lote" }, { header: "Dosis", key: "dosis" }, { header: "Unidad", key: "unidad" }, { header: "Vía", key: "via" },
        { header: "Motivo", key: "motivo" }, { header: "Carencia (días)", key: "carencia" }, { header: "Veterinario", key: "veterinario", width: 20 },
        { header: "Aplicador", key: "aplicador", width: 20 }, { header: "Costo ARS", key: "costo" }, { header: "Observaciones", key: "observ", width: 40 },
        { header: "Estado", key: "estado", width: 24 },
      ],
    })
  } else {
    const { exportarTablaPDF } = await import("@/lib/utils/export-pdf")
    exportarTablaPDF({
      titulo: "Libro sanitario", subtitulo: `${subtitulo} · ${filas.length} registros · ${new Date().toLocaleString("es-AR")}`,
      archivo: `libro_sanitario_${fechaArchivo()}.pdf`, horizontal: true,
      columnas: ["Fecha", "Animal o grupo", "Producto", "Lote", "Dosis", "Vía", "Motivo", "Carencia", "Veterinario", "Estado"],
      filas: filas.map((f) => [
        formatoDia(f.fecha), destino(f), f.producto.nombre, f.loteProducto?.nroLote ?? "", f.dosis != null ? `${f.dosis} ${f.unidad ?? ""}`.trim() : "",
        via(f.via), motivo(f.motivo), carencia(f), f.veterinario ?? "", f.anuladoAt ? "Anulado" : "",
      ]),
    })
  }
  return filas.length
}
