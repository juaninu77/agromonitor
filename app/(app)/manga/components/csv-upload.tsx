"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { parseTruTestCSV, type ParsedSession } from "@/lib/hardware/csv-parser"

interface CsvUploadProps {
  sessionId: string
  onImportComplete: () => void
}

export function CsvUpload({ sessionId, onImportComplete }: CsvUploadProps) {
  const [parsedData, setParsedData] = useState<ParsedSession | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      try {
        const parsed = parseTruTestCSV(content)
        setParsedData(parsed)
        if (parsed.totalValid === 0) {
          toast.warning("No se encontraron EIDs válidos en el archivo")
        }
      } catch {
        toast.error("Error al leer el archivo CSV")
        setParsedData(null)
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!parsedData || parsedData.items.length === 0) return

    setIsImporting(true)
    try {
      const res = await fetch("/api/manga/importar-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          items: parsedData.items.map((item) => ({
            eidLeido: item.eid,
            pesoKg: item.weight,
            timestampLectura: item.dateTime?.toISOString(),
          })),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al importar")
      }

      const result = await res.json()
      toast.success(`${result.imported} registros importados correctamente`)
      setParsedData(null)
      setFileName(null)
      onImportComplete()
    } catch (err: any) {
      toast.error(err.message || "Error al importar datos")
    } finally {
      setIsImporting(false)
    }
  }

  const handleClear = () => {
    setParsedData(null)
    setFileName(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <Card className="border-2 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Importar desde bastón (CSV)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!parsedData ? (
          <div className="text-center py-6">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              Subí el archivo CSV exportado desde Tru-test Data Link
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              Seleccionar archivo
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{fileName}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{parsedData.totalValid} EIDs válidos</span>
              </div>
              {parsedData.totalSkipped > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span>{parsedData.totalSkipped} omitidos</span>
                </div>
              )}
              {parsedData.hasWeights && (
                <Badge variant="secondary" className="w-fit">Con pesos</Badge>
              )}
              {parsedData.dateRange.from && (
                <span className="text-muted-foreground">
                  {parsedData.dateRange.from.toLocaleDateString("es-AR")}
                  {parsedData.dateRange.to && ` - ${parsedData.dateRange.to.toLocaleDateString("es-AR")}`}
                </span>
              )}
            </div>

            {parsedData.items.length > 0 && (
              <div className="max-h-[150px] overflow-y-auto border rounded text-xs">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left">#</th>
                      <th className="px-2 py-1 text-left">EID</th>
                      <th className="px-2 py-1 text-left">VID</th>
                      <th className="px-2 py-1 text-left">Peso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.items.slice(0, 20).map((item, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-1 font-mono">{item.eid}</td>
                        <td className="px-2 py-1">{item.vid || "—"}</td>
                        <td className="px-2 py-1">{item.weight ? `${item.weight} kg` : "—"}</td>
                      </tr>
                    ))}
                    {parsedData.items.length > 20 && (
                      <tr><td colSpan={4} className="px-2 py-1 text-center text-muted-foreground">
                        ...y {parsedData.items.length - 20} más
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={isImporting || parsedData.totalValid === 0}
              className="w-full"
            >
              {isImporting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" /> Importar {parsedData.totalValid} registros</>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
