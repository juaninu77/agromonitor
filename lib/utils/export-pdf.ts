import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface PDFExportOptions {
  filename?: string
  title?: string
  subtitle?: string
  data: any[]
  includeStats?: boolean
}

/**
 * Exporta datos de animales a PDF
 */
export function exportAnimalsToPDF(options: PDFExportOptions) {
  const {
    filename = `ganado_${new Date().toISOString().split('T')[0]}.pdf`,
    title = 'Reporte de Ganado Bovino',
    subtitle = `Generado el ${new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}`,
    data,
    includeStats = true
  } = options

  // Crear documento PDF
  const doc = new jsPDF('landscape')

  // Configuración de colores (tupla RGB para tipos de jspdf-autotable)
  const primaryColor: [number, number, number] = [37, 99, 235] // Blue-600
  const secondaryColor: [number, number, number] = [243, 244, 246] // Gray-100

  let yPosition = 20

  // Header con título
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(0, 0, doc.internal.pageSize.width, 30, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 15, 15)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(subtitle, 15, 23)

  yPosition = 40

  // Estadísticas si están habilitadas
  if (includeStats && data.length > 0) {
    const stats = calculateStats(data)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Resumen del Rodeo', 15, yPosition)

    yPosition += 7

    // Tabla de estadísticas
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    autoTable(doc, {
      startY: yPosition,
      head: [['Métrica', 'Valor']],
      body: [
        ['Total de Animales', stats.total.toString()],
        ['Peso Promedio', `${stats.pesoPromedio} kg`],
        ['CC Promedio', stats.ccPromedio.toString()],
      ],
      theme: 'grid',
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
      margin: { left: 15 },
      tableWidth: 80,
    })

    yPosition = (doc as any).lastAutoTable.finalY + 15
  }

  // Título de la tabla
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Listado de Animales', 15, yPosition)

  yPosition += 7

  // Preparar datos para la tabla
  const tableData = data.map(animal => [
    animal.caravanaVisual || '-',
    animal.nombre || animal.otroId || '-',
    animal.raza?.nombre || '-',
    animal.categoria?.nombre || '-',
    animal.sexo === 'M' ? 'Macho' : 'Hembra',
    animal.edad || '-',
    animal.pesoActual ? `${animal.pesoActual} kg` : '-',
    animal.ccActual || '-',
    animal.ubicacion || '-',
    animal.healthStatus || 'Saludable',
  ])

  // Tabla principal
  autoTable(doc, {
    startY: yPosition,
    head: [['Caravana', 'Nombre', 'Raza', 'Categoría', 'Sexo', 'Edad', 'Peso', 'CC', 'Ubicación', 'Salud']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: secondaryColor
    },
    margin: { left: 15, right: 15 },
    didDrawPage: (data) => {
      // Footer con número de página
      const pageCount = doc.getNumberOfPages()
      const currentPage = doc.getCurrentPageInfo().pageNumber

      doc.setFontSize(8)
      doc.setTextColor(128, 128, 128)
      doc.text(
        `Página ${currentPage} de ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )

      // Marca de agua
      doc.text(
        'AgroMonitor - Sistema de Gestión Ganadera',
        doc.internal.pageSize.width - 15,
        doc.internal.pageSize.height - 10,
        { align: 'right' }
      )
    }
  })

  // Guardar PDF
  doc.save(filename)
}

/**
 * Calcula estadísticas básicas del rodeo
 */
function calculateStats(data: any[]) {
  const total = data.length

  const pesosValidos = data
    .map(a => a.pesoActual)
    .filter((p): p is number => p !== null && p !== undefined && p > 0)

  const pesoPromedio = pesosValidos.length > 0
    ? Math.round(pesosValidos.reduce((acc, p) => acc + p, 0) / pesosValidos.length)
    : 0

  const ccValidos = data
    .map(a => a.ccActual)
    .filter((cc): cc is number => cc !== null && cc !== undefined && cc > 0)

  const ccPromedio = ccValidos.length > 0
    ? (ccValidos.reduce((acc, cc) => acc + cc, 0) / ccValidos.length).toFixed(1)
    : '0'

  return {
    total,
    pesoPromedio,
    ccPromedio,
  }
}
