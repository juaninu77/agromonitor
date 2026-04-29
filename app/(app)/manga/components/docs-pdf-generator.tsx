"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { BookOpen, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function DocsPdfGenerator() {
  const [generating, setGenerating] = useState(false)

  const generate = useCallback(async () => {
    setGenerating(true)
    try {
      const { default: jsPDF } = await import("jspdf")
      const doc = new jsPDF()

      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 16
      const contentWidth = pageWidth - margin * 2
      let y = 20

      const addLine = () => {
        doc.setDrawColor(200)
        doc.line(margin, y, pageWidth - margin, y)
        y += 6
      }

      const addTitle = (text: string, size = 16) => {
        doc.setFontSize(size)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(22, 163, 74)
        doc.text(text, margin, y)
        y += size * 0.5 + 4
      }

      const addSubtitle = (text: string) => {
        doc.setFontSize(12)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(40, 40, 40)
        doc.text(text, margin, y)
        y += 8
      }

      const addParagraph = (text: string) => {
        doc.setFontSize(10)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(60, 60, 60)
        const lines = doc.splitTextToSize(text, contentWidth)
        doc.text(lines, margin, y)
        y += lines.length * 5 + 4
      }

      const addBullet = (text: string) => {
        doc.setFontSize(10)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(60, 60, 60)
        const lines = doc.splitTextToSize(text, contentWidth - 8)
        doc.text("•", margin + 2, y)
        doc.text(lines, margin + 8, y)
        y += lines.length * 5 + 2
      }

      const checkPage = (needed = 30) => {
        if (y + needed > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage()
          y = 20
        }
      }

      // === COVER ===
      doc.setFillColor(22, 163, 74)
      doc.rect(0, 0, pageWidth, 80, "F")

      doc.setFontSize(28)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(255, 255, 255)
      doc.text("AgroMonitor", margin, 35)

      doc.setFontSize(16)
      doc.setFont("helvetica", "normal")
      doc.text("Módulo Sesión de Manga", margin, 48)

      doc.setFontSize(10)
      doc.text("Integración Tru-test SRS2 / SRS2i", margin, 60)
      doc.text(`Documentación v1.0 — ${new Date().toLocaleDateString("es-AR")}`, margin, 70)

      y = 100

      // === INTRO ===
      addTitle("¿Qué es el módulo de Manga?")
      addParagraph(
        "El módulo de Manga de AgroMonitor permite digitalizar el trabajo en la manga del establecimiento ganadero. " +
        "Se conecta al bastón lector de caravanas electrónicas Tru-test SRS2 o SRS2i vía Bluetooth, " +
        "lee los EID de cada animal en tiempo real, y permite registrar peso, sanidad, tacto, condición corporal y más."
      )
      addParagraph(
        "También funciona sin conexión a internet (modo offline) y permite importar datos desde archivos CSV " +
        "exportados con Tru-test Data Link."
      )
      y += 4

      // === HARDWARE ===
      checkPage(60)
      addTitle("Hardware compatible")
      addSubtitle("Bastón lector")
      addBullet("Tru-test SRS2 / SRS2i (Bluetooth Classic SPP)")
      addBullet("Cualquier lector RFID ISO 11784/11785 con salida serial Bluetooth")
      addBullet("Formato de tag: decimal de 15-16 dígitos (estándar SENASA)")

      addSubtitle("Requisitos del navegador")
      addBullet("Google Chrome 117+ o Microsoft Edge (escritorio)")
      addBullet("Web Serial API habilitada (viene activa por defecto)")
      addBullet("Bluetooth del dispositivo activado y bastón emparejado")
      addParagraph(
        "Nota: Safari/iOS no soporta Web Serial API. En iPad o iPhone usar la importación por CSV."
      )
      y += 4

      // === FLUJO ===
      checkPage(80)
      addTitle("Flujo de trabajo")

      addSubtitle("1. Crear sesión")
      addParagraph(
        "Desde la pantalla principal de Manga, presionar 'Nueva Sesión'. Configurar:"
      )
      addBullet("Nombre descriptivo (ej: 'Pesada terneros lote 3')")
      addBullet("Tipo de trabajo: Pesada, Vacunación, Tacto, Destete, Señalada, Recepción o General")
      addBullet("Fecha del trabajo")
      addBullet("Lote de origen (opcional)")
      addBullet("Acciones habilitadas (se pre-seleccionan según el tipo)")

      checkPage(50)
      addSubtitle("2. Conectar el bastón (opcional)")
      addParagraph(
        "En la barra superior del workspace, presionar 'Conectar bastón'. " +
        "El navegador mostrará un diálogo para seleccionar el dispositivo Bluetooth emparejado. " +
        "Una vez conectado, cada lectura de caravana se carga automáticamente."
      )

      checkPage(50)
      addSubtitle("3. Procesar animales")
      addParagraph(
        "Con cada lectura de EID (manual o automática por Bluetooth):"
      )
      addBullet("Si el animal existe en el sistema: se muestra su ficha con datos actuales")
      addBullet("Si es nuevo: aparece como 'No registrado' con opción de alta rápida")
      addBullet("Registrar los datos según las acciones habilitadas")
      addBullet("Presionar 'Confirmar y Siguiente' para guardar y pasar al próximo")

      checkPage(50)
      addSubtitle("4. Finalizar sesión")
      addParagraph(
        "Al terminar, presionar 'Finalizar'. El sistema genera automáticamente:"
      )
      addBullet("Eventos de pesada (EvtPesada) para animales con peso registrado")
      addBullet("Eventos de sanidad (EvtSanidad) para animales con tratamiento aplicado")
      addBullet("Eventos de tacto (EvtTacto) para animales con diagnóstico de preñez")
      addBullet("Resumen exportable a PDF con totales y detalle")
      y += 4

      // === TIPOS ===
      checkPage(80)
      addTitle("Tipos de sesión")

      const tipos = [
        { tipo: "Pesada de rodeo", desc: "Solo peso + CC. Para control periódico o previo a venta.", acciones: "peso, cc" },
        { tipo: "Vacunación / Antiparasitario", desc: "Sanidad pre-configurada (mismo producto y dosis para todos).", acciones: "sanidad" },
        { tipo: "Tacto", desc: "Diagnóstico de preñez + apartado (preñadas vs vacías).", acciones: "tacto, apartado" },
        { tipo: "Destete", desc: "Separar terneros de madres + peso + cambio de lote.", acciones: "peso, cc, apartado" },
        { tipo: "Señalada", desc: "Marcar + registrar nuevos animales (ovinos).", acciones: "registro" },
        { tipo: "Recepción de hacienda", desc: "Registrar animales nuevos (compra) + peso de ingreso.", acciones: "peso, cc, registro" },
        { tipo: "Trabajo general", desc: "Todas las acciones disponibles.", acciones: "todas" },
      ]

      for (const t of tipos) {
        checkPage(20)
        addSubtitle(t.tipo)
        addParagraph(`${t.desc} Acciones: ${t.acciones}.`)
      }

      // === CSV ===
      checkPage(60)
      addTitle("Importación por CSV")
      addParagraph(
        "Si el bastón se usó en modo standalone (sin conexión Bluetooth durante el trabajo), " +
        "los datos quedan guardados en su memoria interna (hasta 250,000 tags)."
      )
      addSubtitle("Pasos:")
      addBullet("Conectar el bastón a una PC con Tru-test Data Link via USB o Bluetooth")
      addBullet("Exportar la sesión como archivo CSV")
      addBullet("En AgroMonitor, dentro de una sesión activa, buscar 'Importar desde bastón (CSV)'")
      addBullet("Seleccionar el archivo — se muestran los datos en vista previa")
      addBullet("Presionar 'Importar' para cargar todos los registros a la sesión")

      addParagraph(
        "El parser detecta automáticamente el formato de columnas (EID, VID, Date, Time, Weight) " +
        "y valida que los EIDs sean números de 15-16 dígitos."
      )
      y += 4

      // === OFFLINE ===
      checkPage(50)
      addTitle("Modo offline")
      addParagraph(
        "El módulo de manga está diseñado para funcionar en el campo donde puede no haber internet."
      )
      addBullet("Los datos se guardan automáticamente en el almacenamiento local del navegador (IndexedDB)")
      addBullet("Un indicador en la barra superior muestra el estado de conexión y los registros pendientes")
      addBullet("Cuando vuelve el internet, se sincronizan automáticamente o con el botón 'Sincronizar'")
      addBullet("La app funciona como PWA: se puede instalar en la tablet como aplicación nativa")
      y += 4

      // === TROUBLESHOOTING ===
      checkPage(60)
      addTitle("Solución de problemas")

      addSubtitle("El bastón no aparece en el diálogo de Bluetooth")
      addBullet("Verificar que el Bluetooth del dispositivo esté encendido")
      addBullet("Asegurarse de que el bastón esté emparejado en la configuración de Bluetooth del SO")
      addBullet("Usar Google Chrome o Edge (Firefox/Safari no soportan Web Serial)")

      checkPage(40)
      addSubtitle("El EID no se reconoce")
      addBullet("Verificar que la caravana electrónica esté correctamente colocada")
      addBullet("El bastón debe estar a menos de 30cm de la caravana")
      addBullet("Verificar que la caravana sea HDX o FDX-B (ISO 11784/11785)")

      checkPage(40)
      addSubtitle("Los datos no se sincronizan")
      addBullet("Verificar la conexión a internet del dispositivo")
      addBullet("Presionar el botón 'Sincronizar' manualmente")
      addBullet("Si persiste, verificar que la sesión no esté finalizada")

      // === FOOTER ===
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text(
          `AgroMonitor — Módulo Manga — Página ${i} de ${totalPages}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        )
      }

      doc.save("AgroMonitor_Manga_Documentacion.pdf")
      toast.success("Documentación PDF generada")
    } catch (err) {
      console.error(err)
      toast.error("Error al generar el PDF")
    } finally {
      setGenerating(false)
    }
  }, [])

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={generate}
            disabled={generating}
            className="h-9 w-9 rounded-full border-2 text-muted-foreground hover:text-primary hover:border-primary/50"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Descargar documentación PDF</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
