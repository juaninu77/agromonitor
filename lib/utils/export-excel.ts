import * as XLSX from 'xlsx'

export interface ExportColumn {
  header: string
  key: string
  width?: number
  formatter?: (value: any) => string | number
}

export interface ExportOptions {
  filename?: string
  sheetName?: string
  columns: ExportColumn[]
  data: any[]
}

/**
 * Exporta datos a un archivo Excel
 */
export function exportToExcel(options: ExportOptions) {
  const {
    filename = `export_${new Date().toISOString().split('T')[0]}.xlsx`,
    sheetName = 'Datos',
    columns,
    data
  } = options

  // Preparar los datos para el export
  const exportData = data.map(row => {
    const exportRow: Record<string, any> = {}
    columns.forEach(col => {
      const value = row[col.key]
      exportRow[col.header] = col.formatter ? col.formatter(value) : value
    })
    return exportRow
  })

  // Crear workbook
  const wb = XLSX.utils.book_new()

  // Crear worksheet
  const ws = XLSX.utils.json_to_sheet(exportData)

  // Ajustar anchos de columna
  const wscols = columns.map(col => ({
    wch: col.width || 15
  }))
  ws['!cols'] = wscols

  // Agregar worksheet al workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // Descargar archivo
  XLSX.writeFile(wb, filename)
}

/**
 * Exporta datos de animales a Excel
 */
export function exportAnimalsToExcel(animals: any[], filename?: string) {
  const columns: ExportColumn[] = [
    { header: 'Caravana', key: 'caravanaVisual', width: 12 },
    { header: 'Nombre', key: 'nombre', width: 20 },
    { header: 'Raza', key: 'raza', width: 15, formatter: (val) => val?.nombre || '' },
    { header: 'Categoría', key: 'categoria', width: 15, formatter: (val) => val?.nombre || '' },
    { header: 'Sexo', key: 'sexo', width: 8, formatter: (val) => val === 'M' ? 'Macho' : 'Hembra' },
    { header: 'Edad', key: 'edad', width: 12 },
    { header: 'Fecha Nacimiento', key: 'fechaNacimiento', width: 15, formatter: (val) => val ? new Date(val).toLocaleDateString() : '' },
    { header: 'Peso (kg)', key: 'pesoActual', width: 10, formatter: (val) => val || '-' },
    { header: 'CC', key: 'ccActual', width: 8, formatter: (val) => val || '-' },
    { header: 'Ubicación', key: 'ubicacion', width: 15, formatter: (val) => val || '-' },
    { header: 'Lote', key: 'lote', width: 15, formatter: (val) => val || '-' },
    { header: 'Estado Salud', key: 'healthStatus', width: 12 },
    { header: 'CUIG', key: 'cuig', width: 20, formatter: (val) => val || '-' },
    { header: 'Origen', key: 'origen', width: 12 },
  ]

  exportToExcel({
    filename: filename || `ganado_${new Date().toISOString().split('T')[0]}.xlsx`,
    sheetName: 'Ganado Bovino',
    columns,
    data: animals
  })
}
