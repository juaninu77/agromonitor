"use client"

import { useCallback, useEffect, useState } from "react"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Package,
  AlertTriangle,
  TrendingDown,
  Calendar,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  Loader2,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

// ============================================
// TIPOS
// ============================================

interface LoteProductoUI {
  id: string
  nroLote: string
  vencimiento: string | null
  proveedor: string | null
  cantidad: number | null
  unidad: string | null
  costo: number | null
  proximoAVencer: boolean
  vencido: boolean
}

interface ProductoStock {
  id: string
  nombre: string
  tipo: string
  principioActivo: string | null
  laboratorio: string | null
  retiroDias: number
  dosisReferencia: string | null
  notas: string | null
  stockTotal: number
  stockBajo: boolean
  tieneVencimientoProximo: boolean
  lotes: LoteProductoUI[]
}

interface Resumen {
  totalProductos: number
  productosStockBajo: number
  productosConVencimientoProximo: number
  umbralStockBajo: number
  diasAlertaVencimiento: number
}

interface Movimiento {
  id: string
  tipo: "entrada" | "salida" | "ajuste"
  cantidad: number
  motivo: string | null
  fecha: string
  createdAt: string
  producto: { id: string; nombre: string; tipo: string }
  loteProducto: { id: string; nroLote: string; vencimiento: string | null } | null
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function InventarioPage() {
  const [productos, setProductos] = useState<ProductoStock[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [tiposDisponibles, setTiposDisponibles] = useState<string[]>([])
  const [loadingStock, setLoadingStock] = useState(true)

  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [movPagination, setMovPagination] = useState<PaginationInfo | null>(null)
  const [loadingMov, setLoadingMov] = useState(true)

  const [searchTerm, setSearchTerm] = useState("")
  const [tipoFilter, setTipoFilter] = useState<string>("todos")
  const [movTipoFilter, setMovTipoFilter] = useState<string>("todos")
  const [movPage, setMovPage] = useState(1)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ---- Fetch inventario ----

  const fetchInventario = useCallback(async () => {
    setLoadingStock(true)
    try {
      const params = new URLSearchParams()
      if (tipoFilter && tipoFilter !== "todos") params.set("tipo", tipoFilter)
      if (searchTerm) params.set("search", searchTerm)

      const res = await fetch(`/api/inventario?${params.toString()}`)
      const json = await res.json()

      if (json.success) {
        setProductos(json.data)
        setResumen(json.resumen)
        setTiposDisponibles(json.tiposDisponibles)
      }
    } catch (err) {
      console.error("Error al cargar inventario:", err)
    } finally {
      setLoadingStock(false)
    }
  }, [tipoFilter, searchTerm])

  // ---- Fetch movimientos ----

  const fetchMovimientos = useCallback(async () => {
    setLoadingMov(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(movPage))
      params.set("limit", "15")
      if (movTipoFilter && movTipoFilter !== "todos")
        params.set("tipo", movTipoFilter)

      const res = await fetch(`/api/inventario/movimientos?${params.toString()}`)
      const json = await res.json()

      if (json.success) {
        setMovimientos(json.data)
        setMovPagination(json.pagination)
      }
    } catch (err) {
      console.error("Error al cargar movimientos:", err)
    } finally {
      setLoadingMov(false)
    }
  }, [movPage, movTipoFilter])

  useEffect(() => {
    fetchInventario()
  }, [fetchInventario])

  useEffect(() => {
    fetchMovimientos()
  }, [fetchMovimientos])

  // ---- Submit nuevo movimiento ----

  async function handleNuevoMovimiento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const body = {
      productoId: formData.get("productoId") as string,
      tipo: formData.get("tipo") as string,
      cantidad: parseFloat(formData.get("cantidad") as string),
      motivo: (formData.get("motivo") as string) || null,
    }

    try {
      const res = await fetch("/api/inventario/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setDialogOpen(false)
        fetchInventario()
        fetchMovimientos()
      }
    } catch (err) {
      console.error("Error al crear movimiento:", err)
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Columnas de la tabla de Stock ----

  const stockColumns: ColumnDef<ProductoStock>[] = [
    {
      id: "nombre",
      header: "Producto",
      accessorFn: (row) => (
        <div>
          <p className="font-medium">{row.nombre}</p>
          {row.principioActivo && (
            <p className="text-xs text-muted-foreground">{row.principioActivo}</p>
          )}
        </div>
      ),
    },
    {
      id: "tipo",
      header: "Tipo",
      accessorFn: (row) => (
        <Badge variant="outline" className="capitalize">
          {row.tipo}
        </Badge>
      ),
    },
    {
      id: "laboratorio",
      header: "Laboratorio",
      accessorKey: "laboratorio",
    },
    {
      id: "stockTotal",
      header: "Stock",
      accessorFn: (row) => (
        <div className="flex items-center gap-2">
          <span className={row.stockBajo ? "font-bold text-destructive" : "font-medium"}>
            {row.stockTotal}
          </span>
          {row.stockBajo && (
            <Badge variant="destructive" className="text-xs">
              Bajo
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "lotes",
      header: "Lotes",
      accessorFn: (row) => (
        <div className="flex items-center gap-1">
          <span>{row.lotes.length}</span>
          {row.tieneVencimientoProximo && (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </div>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (row) => {
        if (row.stockBajo && row.tieneVencimientoProximo) {
          return <Badge variant="destructive">Stock bajo + Vencimiento</Badge>
        }
        if (row.stockBajo) {
          return <Badge variant="destructive">Stock bajo</Badge>
        }
        if (row.tieneVencimientoProximo) {
          return (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">
              Vencimiento próximo
            </Badge>
          )
        }
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            OK
          </Badge>
        )
      },
    },
  ]

  // ---- Columnas de la tabla de Movimientos ----

  const movColumns: ColumnDef<Movimiento>[] = [
    {
      id: "fecha",
      header: "Fecha",
      accessorFn: (row) => (
        <div>
          <p className="text-sm">
            {format(new Date(row.fecha), "dd/MM/yyyy HH:mm", { locale: es })}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(row.fecha), {
              addSuffix: true,
              locale: es,
            })}
          </p>
        </div>
      ),
    },
    {
      id: "tipo",
      header: "Tipo",
      accessorFn: (row) => {
        const config = {
          entrada: {
            label: "Entrada",
            icon: ArrowDownToLine,
            className: "bg-green-100 text-green-800",
          },
          salida: {
            label: "Salida",
            icon: ArrowUpFromLine,
            className: "bg-red-100 text-red-800",
          },
          ajuste: {
            label: "Ajuste",
            icon: Package,
            className: "bg-blue-100 text-blue-800",
          },
        }[row.tipo]

        const Icon = config.icon

        return (
          <Badge className={config.className}>
            <Icon className="mr-1 h-3 w-3" />
            {config.label}
          </Badge>
        )
      },
    },
    {
      id: "producto",
      header: "Producto",
      accessorFn: (row) => (
        <div>
          <p className="font-medium">{row.producto.nombre}</p>
          {row.loteProducto && (
            <p className="text-xs text-muted-foreground">
              Lote: {row.loteProducto.nroLote}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "cantidad",
      header: "Cantidad",
      accessorFn: (row) => (
        <span className="font-medium">
          {row.tipo === "salida" ? "-" : row.tipo === "entrada" ? "+" : "±"}
          {row.cantidad}
        </span>
      ),
    },
    {
      id: "motivo",
      header: "Motivo",
      accessorFn: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.motivo || "—"}
        </span>
      ),
    },
  ]

  // ---- Alertas ----

  const productosStockBajo = productos.filter((p) => p.stockBajo)
  const lotesProximosVencer = productos.flatMap((p) =>
    p.lotes
      .filter((l) => l.proximoAVencer)
      .map((l) => ({
        ...l,
        productoNombre: p.nombre,
        productoTipo: p.tipo,
      }))
  )

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            Inventario de Insumos
          </h1>
          <p className="text-muted-foreground mt-1">
            Control de stock, movimientos y alertas de productos
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Movimiento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Movimiento de Stock</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleNuevoMovimiento} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="productoId">Producto</Label>
                <Select name="productoId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {productos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre} ({p.tipo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de movimiento</Label>
                <Select name="tipo" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="salida">Salida</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cantidad">Cantidad</Label>
                <Input
                  name="cantidad"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Ej: 50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo (opcional)</Label>
                <Input
                  name="motivo"
                  placeholder="Ej: Compra a proveedor, uso en sanidad..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Registrar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de resumen */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Productos
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStock ? "..." : resumen?.totalProductos ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Productos registrados en el sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {loadingStock ? "..." : resumen?.productosStockBajo ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Menos de {resumen?.umbralStockBajo ?? 10} unidades
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Vencimientos Próximos
            </CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {loadingStock
                ? "..."
                : resumen?.productosConVencimientoProximo ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              En los próximos {resumen?.diasAlertaVencimiento ?? 30} días
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alertas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStock
                ? "..."
                : (resumen?.productosStockBajo ?? 0) +
                  (resumen?.productosConVencimientoProximo ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Alertas activas totales
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="alertas" className="relative">
            Alertas
            {(resumen?.productosStockBajo ?? 0) +
              (resumen?.productosConVencimientoProximo ?? 0) >
              0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {(resumen?.productosStockBajo ?? 0) +
                  (resumen?.productosConVencimientoProximo ?? 0)}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ====== TAB: STOCK ====== */}
        <TabsContent value="stock" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, principio activo o laboratorio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                {tiposDisponibles.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={stockColumns}
            data={productos}
            isLoading={loadingStock}
            emptyMessage="No hay productos en el inventario"
            rowKey={(row) => row.id}
          />
        </TabsContent>

        {/* ====== TAB: MOVIMIENTOS ====== */}
        <TabsContent value="movimientos" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={movTipoFilter} onValueChange={(val) => { setMovTipoFilter(val); setMovPage(1) }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="salida">Salidas</SelectItem>
                <SelectItem value="ajuste">Ajustes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={movColumns}
            data={movimientos}
            isLoading={loadingMov}
            emptyMessage="No hay movimientos de stock registrados"
            rowKey={(row) => row.id}
            pagination={
              movPagination
                ? {
                    page: movPagination.page,
                    totalPages: movPagination.totalPages,
                    total: movPagination.total,
                    hasNextPage: movPagination.hasNextPage,
                    hasPrevPage: movPagination.hasPrevPage,
                  }
                : undefined
            }
            onPageChange={setMovPage}
          />
        </TabsContent>

        {/* ====== TAB: ALERTAS ====== */}
        <TabsContent value="alertas" className="space-y-6">
          {/* Productos con stock bajo */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <TrendingDown className="h-5 w-5 text-destructive" />
              Productos con Stock Bajo
            </h3>
            {loadingStock ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                  Cargando...
                </CardContent>
              </Card>
            ) : productosStockBajo.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No hay productos con stock bajo. ¡Todo en orden!
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {productosStockBajo.map((p) => (
                  <Card key={p.id} className="border-destructive/30">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{p.nombre}</CardTitle>
                        <Badge variant="destructive">Stock: {p.stockTotal}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {p.tipo} {p.laboratorio ? `· ${p.laboratorio}` : ""}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Lotes con vencimiento próximo */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Calendar className="h-5 w-5 text-amber-500" />
              Lotes Próximos a Vencer
            </h3>
            {loadingStock ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                  Cargando...
                </CardContent>
              </Card>
            ) : lotesProximosVencer.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No hay lotes próximos a vencer. ¡Todo en orden!
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {lotesProximosVencer.map((l) => (
                  <Card
                    key={l.id}
                    className={
                      l.vencido
                        ? "border-destructive/30"
                        : "border-amber-300/50"
                    }
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">
                          {l.productoNombre}
                        </CardTitle>
                        {l.vencido ? (
                          <Badge variant="destructive">Vencido</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800">
                            Por vencer
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Lote:</span>{" "}
                        {l.nroLote}
                      </p>
                      {l.vencimiento && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Vence:</span>{" "}
                          {format(new Date(l.vencimiento), "dd/MM/yyyy", {
                            locale: es,
                          })}
                          <span className="ml-1 text-xs text-muted-foreground">
                            (
                            {formatDistanceToNow(new Date(l.vencimiento), {
                              addSuffix: true,
                              locale: es,
                            })}
                            )
                          </span>
                        </p>
                      )}
                      {l.cantidad !== null && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Cantidad:</span>{" "}
                          {l.cantidad} {l.unidad ?? ""}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
