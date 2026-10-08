"use client"

import { useCallback, useEffect, useState } from "react"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
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
import { MovimientoStockDialog } from "@/components/inventario/movimiento-stock-dialog"
import { formatoDia, textoVencimiento } from "@/lib/inventario/fechas"

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
  diasRestantes: number | null
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
  ubicacion: { id: string; nombre: string } | null
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
  // La búsqueda consulta al servidor cuando se deja de escribir
  const [busqueda, setBusqueda] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(searchTerm.trim()), 350)
    return () => clearTimeout(t)
  }, [searchTerm])
  const [errorStock, setErrorStock] = useState("")
  const [errorMov, setErrorMov] = useState("")
  const [puedeEditar, setPuedeEditar] = useState(false)
  const [tipoFilter, setTipoFilter] = useState<string>("todos")
  const [movTipoFilter, setMovTipoFilter] = useState<string>("todos")
  // Ubicación: "todas", un galpón del mapa o "sin-asignar"
  const [ubicacionFilter, setUbicacionFilter] = useState<string>("todas")
  const [ubicaciones, setUbicaciones] = useState<{ id: string; nombre: string; campo: string }[]>([])
  const [movPage, setMovPage] = useState(1)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ---- Fetch inventario ----

  const fetchInventario = useCallback(async () => {
    setLoadingStock(true)
    try {
      const params = new URLSearchParams()
      if (tipoFilter && tipoFilter !== "todos") params.set("tipo", tipoFilter)
      if (busqueda) params.set("search", busqueda)
      if (ubicacionFilter !== "todas") params.set("ubicacion", ubicacionFilter)

      setErrorStock("")
      const res = await fetch(`/api/inventario?${params.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) throw new Error(json.error ?? "No se pudo cargar el inventario")
      {
        setPuedeEditar(!!json.puedeEditar)
        setProductos(json.data)
        setResumen(json.resumen)
        setTiposDisponibles(json.tiposDisponibles)
        setUbicaciones(json.ubicaciones ?? [])
      }
    } catch (err) {
      setErrorStock(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "No se pudo cargar el inventario. Revisá la conexión.")
    } finally {
      setLoadingStock(false)
    }
  }, [tipoFilter, busqueda, ubicacionFilter])

  // ---- Fetch movimientos ----

  const fetchMovimientos = useCallback(async () => {
    setLoadingMov(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(movPage))
      params.set("limit", "15")
      if (movTipoFilter && movTipoFilter !== "todos")
        params.set("tipo", movTipoFilter)
      if (ubicacionFilter !== "todas") params.set("ubicacion", ubicacionFilter)

      setErrorMov("")
      const res = await fetch(`/api/inventario/movimientos?${params.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) throw new Error(json.error ?? "No se pudieron cargar los movimientos")
      {
        setMovimientos(json.data)
        setMovPagination(json.pagination)
      }
    } catch (err) {
      setErrorMov(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "No se pudieron cargar los movimientos. Revisá la conexión.")
    } finally {
      setLoadingMov(false)
    }
  }, [movPage, movTipoFilter, ubicacionFilter])

  useEffect(() => {
    fetchInventario()
  }, [fetchInventario])

  useEffect(() => {
    fetchMovimientos()
  }, [fetchMovimientos])

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
          {row.tipo === "salida" || row.cantidad < 0 ? "−" : "+"}
          {Math.abs(row.cantidad).toLocaleString("es-AR")}
        </span>
      ),
    },
    {
      id: "ubicacion",
      header: "Ubicación",
      accessorFn: (row) => (
        <span className="text-sm">{row.ubicacion?.nombre ?? <span className="text-muted-foreground">Sin galpón</span>}</span>
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
    <div className="space-y-6">
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

        {puedeEditar && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Movimiento
          </Button>
        )}
        <MovimientoStockDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          productos={productos}
          onGuardado={() => { fetchInventario(); fetchMovimientos() }}
        />
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
            <Select value={ubicacionFilter} onValueChange={(val) => { setUbicacionFilter(val); setMovPage(1) }}>
              <SelectTrigger className="w-full sm:w-[220px]" aria-label="Ubicación">
                <SelectValue placeholder="Ubicación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las ubicaciones</SelectItem>
                {ubicaciones.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nombre} · {u.campo}</SelectItem>
                ))}
                <SelectItem value="sin-asignar">Sin galpón asignado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {errorStock && (
            <p role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errorStock}
              <Button size="sm" variant="outline" onClick={() => fetchInventario()}>Reintentar</Button>
            </p>
          )}
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
            <Select value={ubicacionFilter} onValueChange={(val) => { setUbicacionFilter(val); setMovPage(1) }}>
              <SelectTrigger className="w-full sm:w-[220px]" aria-label="Ubicación">
                <SelectValue placeholder="Ubicación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las ubicaciones</SelectItem>
                {ubicaciones.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nombre} · {u.campo}</SelectItem>
                ))}
                <SelectItem value="sin-asignar">Sin galpón asignado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {errorMov && (
            <p role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errorMov}
              <Button size="sm" variant="outline" onClick={() => fetchMovimientos()}>Reintentar</Button>
            </p>
          )}
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
                          {formatoDia(l.vencimiento)}
                          {l.diasRestantes !== null && (
                            <span className="ml-1 text-xs text-muted-foreground">({textoVencimiento(l.diasRestantes)})</span>
                          )}
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
