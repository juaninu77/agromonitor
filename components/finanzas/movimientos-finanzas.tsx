"use client"

import { useDeferredValue, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeftRight, Download, Pencil, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { CATEGORIAS, etiquetaFinanzas, formatearImporte } from "@/lib/finanzas/constantes"
import { api, claves, formatearFecha, rangoDePeriodo, type Cuenta, type ListadoMovimientos, type Movimiento } from "./api"
import { MovimientoDialog, selectClass } from "./movimiento-dialog"

const LIMITE = 50

export function MovimientosFinanzas({ campo, cuentas }: { campo: string; cuentas: Cuenta[] }) {
  const queryClient = useQueryClient()
  const inicial = rangoDePeriodo("mes")
  const [desde, setDesde] = useState(inicial.desde)
  const [hasta, setHasta] = useState(inicial.hasta)
  const [tipo, setTipo] = useState("")
  const [categoria, setCategoria] = useState("")
  const [cuentaId, setCuentaId] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [page, setPage] = useState(1)
  const [editar, setEditar] = useState<Movimiento | null>(null)
  const q = useDeferredValue(busqueda.trim())

  const filtros = { desde, hasta, tipo, categoria, cuentaId, q }
  const params = (extra: Record<string, string>) =>
    new URLSearchParams({ establecimientoId: campo, ...filtros, ...extra }).toString()

  const query = useQuery({
    queryKey: claves.movimientos(campo, { ...filtros, page }),
    queryFn: () => api<ListadoMovimientos>(`/api/finanzas/movimientos?${params({ page: String(page), limit: String(LIMITE) })}`),
    placeholderData: keepPreviousData,
  })

  const eliminar = useMutation({
    mutationFn: (id: string) => api(`/api/finanzas/movimientos/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Movimiento eliminado")
      queryClient.invalidateQueries({ queryKey: claves.todo })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const confirmarEliminar = (m: Movimiento) => {
    const texto = m.transferenciaId
      ? "Es una transferencia: se eliminan las dos partes (salida y entrada). ¿Continuar?"
      : m.bajaId
        ? "Este ingreso viene de una venta de hacienda. La venta queda registrada; solo se borra el ingreso. ¿Continuar?"
        : `¿Eliminar «${m.descripcion}»?`
    if (window.confirm(texto)) eliminar.mutate(m.id)
  }

  const exportar = async () => {
    try {
      const todos = await api<ListadoMovimientos>(`/api/finanzas/movimientos?${params({ page: "1", limit: "500" })}`)
      const { exportToExcel } = await import("@/lib/utils/export-excel")
      exportToExcel({
        filename: `finanzas_${desde}_${hasta}.xlsx`,
        sheetName: "Movimientos",
        data: todos.data.map((m) => ({
          ...m,
          fecha: formatearFecha(m.fecha),
          tipo: m.categoria === "transferencia" ? `Transferencia (${m.tipo})` : etiquetaFinanzas(m.tipo),
          categoria: etiquetaFinanzas(m.categoria),
          subcategoria: etiquetaFinanzas(m.subcategoria),
          cuenta: m.cuenta.nombre,
          importeConSigno: m.tipo === "ingreso" ? m.importe : -m.importe,
          medioPago: etiquetaFinanzas(m.medioPago),
        })),
        columns: [
          { key: "fecha", header: "Fecha", width: 12 },
          { key: "tipo", header: "Tipo", width: 14 },
          { key: "categoria", header: "Categoría", width: 26 },
          { key: "subcategoria", header: "Impuesto", width: 18 },
          { key: "descripcion", header: "Descripción", width: 36 },
          { key: "contraparte", header: "Contraparte", width: 24 },
          { key: "cuit", header: "CUIT", width: 14 },
          { key: "cuenta", header: "Cuenta", width: 20 },
          { key: "moneda", header: "Moneda", width: 8 },
          { key: "importeConSigno", header: "Importe", width: 14 },
          { key: "medioPago", header: "Medio de pago", width: 16 },
          { key: "notas", header: "Notas", width: 30 },
        ],
      })
      if (todos.pagination.total > 500) toast.info("Se exportaron los primeros 500 movimientos: acotá el período para el resto")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar")
    }
  }

  const cambiar = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    fn(e.target.value)
    setPage(1)
  }

  const resultado = query.data
  const categorias = tipo ? CATEGORIAS[tipo as "ingreso" | "egreso"] : [...CATEGORIAS.ingreso, ...CATEGORIAS.egreso]

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1.5">
            <Label htmlFor="f-desde">Desde</Label>
            <Input id="f-desde" type="date" value={desde} onChange={cambiar(setDesde)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-hasta">Hasta</Label>
            <Input id="f-hasta" type="date" value={hasta} onChange={cambiar(setHasta)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-tipo">Tipo</Label>
            <select
              id="f-tipo"
              className={selectClass}
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value)
                setCategoria("")
                setPage(1)
              }}
            >
              <option value="">Todos</option>
              <option value="ingreso">Ingresos</option>
              <option value="egreso">Gastos</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-categoria">Categoría</Label>
            <select id="f-categoria" className={selectClass} value={categoria} onChange={cambiar(setCategoria)}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {etiquetaFinanzas(c)}
                </option>
              ))}
              <option value="transferencia">Transferencias</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-cuenta">Cuenta</Label>
            <select id="f-cuenta" className={selectClass} value={cuentaId} onChange={cambiar(setCuentaId)}>
              <option value="">Todas</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-busqueda">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input id="f-busqueda" className="pl-8" placeholder="Descripción, contraparte…" value={busqueda} onChange={cambiar(setBusqueda)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm" aria-live="polite">
          {resultado &&
            Object.entries(resultado.totales).map(([moneda, t]) => (
              <p key={moneda} className="tabular-nums">
                <span className="text-muted-foreground">{moneda}: </span>
                ingresos <strong>{formatearImporte(t.ingresos, moneda)}</strong> · gastos{" "}
                <strong>{formatearImporte(t.egresos, moneda)}</strong> · resultado{" "}
                <strong className={cn(t.resultado < 0 && "text-destructive")}>{formatearImporte(t.resultado, moneda)}</strong>
              </p>
            ))}
        </div>
        <Button variant="outline" size="sm" onClick={exportar} disabled={!resultado?.data.length}>
          <Download className="mr-2 h-4 w-4" aria-hidden />
          Exportar a Excel
        </Button>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-64" />
      ) : query.isError ? (
        <Card>
          <CardContent className="py-10 text-center text-destructive">{(query.error as Error).message}</CardContent>
        </Card>
      ) : !resultado?.data.length ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">No hay movimientos con estos filtros.</CardContent>
        </Card>
      ) : (
        <>
          {/* Escritorio */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead className="w-24 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatearFecha(m.fecha)}</TableCell>
                    <TableCell>
                      <p className="font-medium">{m.descripcion}</p>
                      {m.contraparte && <p className="text-xs text-muted-foreground">{m.contraparte}</p>}
                    </TableCell>
                    <TableCell>
                      <CategoriaBadge m={m} />
                    </TableCell>
                    <TableCell className="text-sm">{m.cuenta.nombre}</TableCell>
                    <TableCell className="text-right">
                      <Importe m={m} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Acciones m={m} onEditar={setEditar} onEliminar={confirmarEliminar} ocupado={eliminar.isPending} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Móvil */}
          <ul className="space-y-2 md:hidden">
            {resultado.data.map((m) => (
              <li key={m.id}>
                <Card>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{m.descripcion}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatearFecha(m.fecha)} · {m.cuenta.nombre}
                          {m.contraparte ? ` · ${m.contraparte}` : ""}
                        </p>
                      </div>
                      <Importe m={m} />
                    </div>
                    <div className="flex items-center justify-between">
                      <CategoriaBadge m={m} />
                      <Acciones m={m} onEditar={setEditar} onEliminar={confirmarEliminar} ocupado={eliminar.isPending} />
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          {resultado.pagination.pages > 1 && (
            <nav className="flex items-center justify-between text-sm" aria-label="Paginación">
              <span className="text-muted-foreground">
                Página {resultado.pagination.page} de {resultado.pagination.pages} · {resultado.pagination.total} movimientos
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= resultado.pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </nav>
          )}
        </>
      )}

      {editar && (
        <MovimientoDialog open onOpenChange={(o) => !o && setEditar(null)} campo={campo} cuentas={cuentas} movimiento={editar} />
      )}
    </div>
  )
}

function Importe({ m }: { m: Movimiento }) {
  const ingreso = m.tipo === "ingreso"
  return (
    <span
      className={cn(
        "whitespace-nowrap font-semibold tabular-nums",
        m.transferenciaId ? "text-muted-foreground" : ingreso ? "text-green-700 dark:text-green-400" : "text-foreground",
      )}
    >
      {ingreso ? "+" : "−"} {formatearImporte(m.importe, m.moneda)}
    </span>
  )
}

function CategoriaBadge({ m }: { m: Movimiento }) {
  if (m.transferenciaId) {
    return (
      <Badge variant="outline" className="gap-1">
        <ArrowLeftRight className="h-3 w-3" aria-hidden />
        Transferencia
      </Badge>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={m.tipo === "ingreso" ? "default" : "secondary"}>{etiquetaFinanzas(m.categoria)}</Badge>
      {m.subcategoria && <Badge variant="outline">{etiquetaFinanzas(m.subcategoria)}</Badge>}
      {m.baja && <Badge variant="outline">Venta {m.baja.animal.caravanaVisual ?? ""}</Badge>}
    </div>
  )
}

function Acciones({
  m,
  onEditar,
  onEliminar,
  ocupado,
}: {
  m: Movimiento
  onEditar: (m: Movimiento) => void
  onEliminar: (m: Movimiento) => void
  ocupado: boolean
}) {
  return (
    <div className="flex justify-end gap-1">
      {!m.transferenciaId && (
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEditar(m)} aria-label={`Editar ${m.descripcion}`}>
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={() => onEliminar(m)}
        disabled={ocupado}
        aria-label={`Eliminar ${m.descripcion}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  )
}
