"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import { Gate } from "@/components/auth/gate"
import { Shield, Search, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface AuditEntry {
  id: string
  tabla: string
  rowPk: string
  accion: string
  detalle: Record<string, unknown> | null
  fecha: string
  usuario?: { nombre: string; apellido: string; email: string } | null
}

export default function AuditoriaPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterTable, setFilterTable] = useState("")
  const [filterAction, setFilterAction] = useState("")
  const [search, setSearch] = useState("")

  const fetchAudit = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (filterTable) params.set("tabla", filterTable)
      if (filterAction) params.set("accion", filterAction)
      if (search) params.set("busqueda", search)

      const res = await fetch(`/api/audit?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.data || [])
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [filterTable, filterAction, search])

  useEffect(() => {
    fetchAudit()
  }, [fetchAudit])

  const columns: ColumnDef<AuditEntry>[] = [
    {
      id: "fecha",
      header: "Fecha",
      sortable: true,
      accessorFn: (row) =>
        format(new Date(row.fecha), "dd/MM/yyyy HH:mm", { locale: es }),
    },
    {
      id: "usuario",
      header: "Usuario",
      accessorFn: (row) =>
        row.usuario
          ? `${row.usuario.nombre} ${row.usuario.apellido}`
          : "Sistema",
    },
    {
      id: "accion",
      header: "Accion",
      accessorFn: (row) => {
        const colors: Record<string, string> = {
          INSERT: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
          UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        }
        return (
          <Badge variant="outline" className={colors[row.accion] || ""}>
            {row.accion}
          </Badge>
        )
      },
    },
    { id: "tabla", header: "Tabla", accessorKey: "tabla", sortable: true },
    { id: "rowPk", header: "Registro ID", accessorKey: "rowPk", className: "font-mono text-xs" },
    {
      id: "detalle",
      header: "Detalle",
      accessorFn: (row) =>
        row.detalle ? (
          <pre className="max-w-[200px] truncate text-xs text-muted-foreground">
            {JSON.stringify(row.detalle)}
          </pre>
        ) : (
          "—"
        ),
    },
  ]

  return (
    <Gate roles={["admin"]} fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
            <CardTitle>Acceso restringido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Solo los administradores pueden ver el registro de auditoria.
            </p>
          </CardContent>
        </Card>
      </div>
    }>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registro de Auditoria</h1>
          <p className="text-muted-foreground">
            Historial de todas las operaciones realizadas en el sistema
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por tabla o ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Accion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  <SelectItem value="INSERT">INSERT</SelectItem>
                  <SelectItem value="UPDATE">UPDATE</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchAudit}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={entries}
              isLoading={isLoading}
              emptyMessage="No hay registros de auditoria"
              rowKey={(row) => row.id}
            />
          </CardContent>
        </Card>
      </div>
    </Gate>
  )
}
