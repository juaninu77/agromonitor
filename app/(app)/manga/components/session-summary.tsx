"use client"

import { useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Scale,
  Syringe,
  Stethoscope,
  UserPlus,
  ArrowRightLeft,
  CheckCircle2,
  ListChecks,
  FileDown,
} from "lucide-react"
import { toast } from "sonner"

interface SessionSummaryProps {
  session: any
}

export function SessionSummary({ session }: SessionSummaryProps) {
  const items: any[] = session.items || []

  const stats = useMemo(() => {
    const totalAnimales = items.length
    const conPeso = items.filter((i: any) => i.pesoKg != null)
    const pesoPromedio =
      conPeso.length > 0
        ? conPeso.reduce((sum: number, i: any) => sum + (i.pesoKg || 0), 0) / conPeso.length
        : 0
    const conSanidad = items.filter((i: any) => i.accionSanidad).length
    const tactos = items.filter((i: any) => i.resultadoTacto)
    const preñadas = tactos.filter((i: any) => i.resultadoTacto === "preñada").length
    const vacias = tactos.filter((i: any) => i.resultadoTacto === "vacia").length
    const registrosNuevos = items.filter((i: any) => i.esNuevoRegistro).length
    const apartados = items.filter((i: any) => i.apartadoA).length

    return {
      totalAnimales,
      conPeso: conPeso.length,
      pesoPromedio: Math.round(pesoPromedio * 10) / 10,
      pesoMin: conPeso.length > 0 ? Math.min(...conPeso.map((i: any) => i.pesoKg)) : 0,
      pesoMax: conPeso.length > 0 ? Math.max(...conPeso.map((i: any) => i.pesoKg)) : 0,
      conSanidad,
      totalTactos: tactos.length,
      preñadas,
      vacias,
      registrosNuevos,
      apartados,
    }
  }, [items])

  const exportPDF = useCallback(async () => {
    try {
      const { default: jsPDF } = await import("jspdf")
      const { default: autoTable } = await import("jspdf-autotable")

      const doc = new jsPDF()

      doc.setFontSize(18)
      doc.text("AgroMonitor - Resumen de Manga", 14, 22)

      doc.setFontSize(11)
      doc.setTextColor(100)
      doc.text(`Sesión: ${session.nombre}`, 14, 32)
      doc.text(`Fecha: ${new Date(session.fecha).toLocaleDateString("es-AR")}`, 14, 38)
      doc.text(`Tipo: ${session.tipo}`, 14, 44)
      doc.text(`Total animales: ${stats.totalAnimales}`, 14, 50)

      let yPos = 58
      if (stats.conPeso > 0) {
        doc.text(
          `Pesados: ${stats.conPeso} | Promedio: ${stats.pesoPromedio} kg | Min: ${stats.pesoMin} kg | Max: ${stats.pesoMax} kg`,
          14, yPos
        )
        yPos += 6
      }
      if (stats.conSanidad > 0) {
        doc.text(`Sanidad aplicada: ${stats.conSanidad}`, 14, yPos)
        yPos += 6
      }
      if (stats.totalTactos > 0) {
        doc.text(`Tactos: ${stats.totalTactos} (Preñadas: ${stats.preñadas}, Vacías: ${stats.vacias})`, 14, yPos)
        yPos += 6
      }

      yPos += 4

      const tableData = items.map((item: any, idx: number) => [
        idx + 1,
        item.eidLeido || item.eid || "",
        item.pesoKg != null ? `${item.pesoKg}` : "-",
        item.cc != null ? `${item.cc}` : "-",
        item.accionSanidad ? "Sí" : "-",
        item.resultadoTacto || "-",
        item.apartadoA || "-",
      ])

      autoTable(doc, {
        startY: yPos,
        head: [["#", "EID", "Peso (kg)", "CC", "Sanidad", "Tacto", "Apartado"]],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [22, 163, 74] },
      })

      const fileName = `manga_${session.nombre.replace(/\s+/g, "_")}_${new Date(session.fecha).toISOString().split("T")[0]}.pdf`
      doc.save(fileName)
      toast.success("PDF exportado")
    } catch (err) {
      toast.error("Error al generar PDF")
      console.error(err)
    }
  }, [session, items, stats])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-3">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold">Sesión Finalizada</h2>
        <p className="text-muted-foreground">
          {session.nombre} — {new Date(session.fecha).toLocaleDateString("es-AR")}
        </p>
      </div>

      <div className="flex justify-center">
        <Button variant="outline" onClick={exportPDF} className="gap-2">
          <FileDown className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <ListChecks className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <div className="text-2xl font-bold">{stats.totalAnimales}</div>
            <p className="text-xs text-muted-foreground">Total procesados</p>
          </CardContent>
        </Card>

        {stats.conPeso > 0 && (
          <Card>
            <CardContent className="p-4 text-center">
              <Scale className="h-5 w-5 mx-auto mb-1 text-blue-600" />
              <div className="text-2xl font-bold">{stats.conPeso}</div>
              <p className="text-xs text-muted-foreground">
                Pesados (prom. {stats.pesoPromedio} kg)
              </p>
            </CardContent>
          </Card>
        )}

        {stats.conSanidad > 0 && (
          <Card>
            <CardContent className="p-4 text-center">
              <Syringe className="h-5 w-5 mx-auto mb-1 text-purple-600" />
              <div className="text-2xl font-bold">{stats.conSanidad}</div>
              <p className="text-xs text-muted-foreground">Sanidad aplicada</p>
            </CardContent>
          </Card>
        )}

        {stats.totalTactos > 0 && (
          <Card>
            <CardContent className="p-4 text-center">
              <Stethoscope className="h-5 w-5 mx-auto mb-1 text-green-600" />
              <div className="text-2xl font-bold">{stats.totalTactos}</div>
              <p className="text-xs text-muted-foreground">
                Tactos ({stats.preñadas}P / {stats.vacias}V)
              </p>
            </CardContent>
          </Card>
        )}

        {stats.registrosNuevos > 0 && (
          <Card>
            <CardContent className="p-4 text-center">
              <UserPlus className="h-5 w-5 mx-auto mb-1 text-yellow-600" />
              <div className="text-2xl font-bold">{stats.registrosNuevos}</div>
              <p className="text-xs text-muted-foreground">Nuevos registros</p>
            </CardContent>
          </Card>
        )}

        {stats.apartados > 0 && (
          <Card>
            <CardContent className="p-4 text-center">
              <ArrowRightLeft className="h-5 w-5 mx-auto mb-1 text-indigo-600" />
              <div className="text-2xl font-bold">{stats.apartados}</div>
              <p className="text-xs text-muted-foreground">Apartados</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle de animales procesados</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">
              No se procesaron animales en esta sesión
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium">#</th>
                    <th className="text-left py-2 px-2 font-medium">EID</th>
                    <th className="text-right py-2 px-2 font-medium">Peso</th>
                    <th className="text-left py-2 px-2 font-medium">CC</th>
                    <th className="text-left py-2 px-2 font-medium">Sanidad</th>
                    <th className="text-left py-2 px-2 font-medium">Tacto</th>
                    <th className="text-left py-2 px-2 font-medium">Dentición</th>
                    <th className="text-left py-2 px-2 font-medium">Apartado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, idx: number) => (
                    <tr key={item.id || idx} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-2 font-mono font-medium">{item.eidLeido}</td>
                      <td className="py-2 px-2 text-right">
                        {item.pesoKg != null ? `${item.pesoKg} kg` : "-"}
                      </td>
                      <td className="py-2 px-2">{item.cc != null ? item.cc : "-"}</td>
                      <td className="py-2 px-2">
                        {item.accionSanidad ? (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                            Sí
                          </Badge>
                        ) : "-"}
                      </td>
                      <td className="py-2 px-2">
                        {item.resultadoTacto ? (
                          <Badge
                            className={
                              item.resultadoTacto === "preñada"
                                ? "bg-green-100 text-green-800 border-green-200 text-xs"
                                : item.resultadoTacto === "vacia"
                                  ? "bg-red-100 text-red-800 border-red-200 text-xs"
                                  : "bg-yellow-100 text-yellow-800 border-yellow-200 text-xs"
                            }
                          >
                            {item.resultadoTacto === "preñada" ? "Preñada"
                              : item.resultadoTacto === "vacia" ? "Vacía"
                              : item.resultadoTacto === "dudosa" ? "Dudosa"
                              : "Absorción"}
                            {item.mesesGestacion ? ` (${item.mesesGestacion}m)` : ""}
                          </Badge>
                        ) : "-"}
                      </td>
                      <td className="py-2 px-2">{item.denticion || "-"}</td>
                      <td className="py-2 px-2">{item.apartadoA || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
