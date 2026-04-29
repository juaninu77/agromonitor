"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Plus,
  Loader2,
  Bug,
  Tags,
  Layers,
  Filter,
} from "lucide-react"
import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Especie {
  id: string
  nombre: string
  descripcion: string | null
  _count: { razas: number; categorias: number; animales: number }
}

interface Raza {
  id: string
  nombre: string
  especieId: string
  especie: { id: string; nombre: string }
  _count: { animales: number }
}

interface Categoria {
  id: string
  nombre: string
  especieId: string
  especie: { id: string; nombre: string }
  sexo: string | null
  edadMinMeses: number | null
  edadMaxMeses: number | null
  _count: { animales: number }
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

async function fetchEspecies(): Promise<Especie[]> {
  const res = await fetch("/api/especies")
  if (!res.ok) throw new Error("Error al cargar especies")
  const json = await res.json()
  return Array.isArray(json) ? json : json.data ?? []
}

async function fetchRazas(especieId?: string): Promise<Raza[]> {
  const url = especieId ? `/api/razas?especieId=${especieId}` : "/api/razas"
  const res = await fetch(url)
  if (!res.ok) throw new Error("Error al cargar razas")
  const json = await res.json()
  return Array.isArray(json) ? json : json.data ?? []
}

async function fetchCategorias(especieId?: string): Promise<Categoria[]> {
  const url = especieId
    ? `/api/categorias?especieId=${especieId}`
    : "/api/categorias"
  const res = await fetch(url)
  if (!res.ok) throw new Error("Error al cargar categorías")
  const json = await res.json()
  return Array.isArray(json) ? json : json.data ?? []
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function sexoLabel(sexo: string | null) {
  if (sexo === "M") return "Macho"
  if (sexo === "F") return "Hembra"
  return "Ambos"
}

function sexoBadgeVariant(sexo: string | null): "default" | "secondary" | "outline" {
  if (sexo === "M") return "default"
  if (sexo === "F") return "secondary"
  return "outline"
}

function edadRangeLabel(min: number | null, max: number | null) {
  if (min != null && max != null) return `${min} – ${max} meses`
  if (min != null) return `≥ ${min} meses`
  if (max != null) return `≤ ${max} meses`
  return "—"
}

// ---------------------------------------------------------------------------
// Table skeleton
// ---------------------------------------------------------------------------

function TableSkeleton({ cols, rows = 4 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <TableCell key={c}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Especies Tab
// ---------------------------------------------------------------------------

function EspeciesTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")

  const { data: especies = [], isLoading, error } = useQuery({
    queryKey: ["especies"],
    queryFn: fetchEspecies,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/especies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, descripcion }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al crear especie")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["especies"] })
      toast.success("Especie creada correctamente")
      resetForm()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  function resetForm() {
    setDialogOpen(false)
    setNombre("")
    setDescripcion("")
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {especies.length} {especies.length === 1 ? "especie" : "especies"} registradas
        </p>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Especie
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-center">Razas</TableHead>
              <TableHead className="text-center">Categorías</TableHead>
              <TableHead className="text-center">Animales</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton cols={5} />}
            {!isLoading && especies.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No hay especies registradas
                </TableCell>
              </TableRow>
            )}
            {especies.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{capitalize(e.nombre)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {e.descripcion || "—"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{e._count.razas}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{e._count.categorias}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{e._count.animales}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Especie</DialogTitle>
            <DialogDescription>
              Agrega una nueva especie al catálogo
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createMutation.mutate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="especie-nombre">Nombre</Label>
              <Input
                id="especie-nombre"
                placeholder="ej. bovino, ovino, equino"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="especie-desc">Descripción</Label>
              <Textarea
                id="especie-desc"
                placeholder="Descripción opcional"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !nombre.trim()}>
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Crear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Razas Tab
// ---------------------------------------------------------------------------

function RazasTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nombre, setNombre] = useState("")
  const [especieId, setEspecieId] = useState("")
  const [filterEspecieId, setFilterEspecieId] = useState<string>("all")

  const { data: especies = [] } = useQuery({
    queryKey: ["especies"],
    queryFn: fetchEspecies,
  })

  const { data: razas = [], isLoading, error } = useQuery({
    queryKey: ["razas", filterEspecieId],
    queryFn: () =>
      fetchRazas(filterEspecieId !== "all" ? filterEspecieId : undefined),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/razas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, especieId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al crear raza")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["razas"] })
      queryClient.invalidateQueries({ queryKey: ["especies"] })
      toast.success("Raza creada correctamente")
      resetForm()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  function resetForm() {
    setDialogOpen(false)
    setNombre("")
    setEspecieId("")
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterEspecieId} onValueChange={setFilterEspecieId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas las especies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las especies</SelectItem>
                {especies.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {capitalize(e.nombre)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            {razas.length} {razas.length === 1 ? "raza" : "razas"}
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Raza
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Especie</TableHead>
              <TableHead className="text-center">Animales</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton cols={3} />}
            {!isLoading && razas.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  No hay razas registradas
                </TableCell>
              </TableRow>
            )}
            {razas.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.nombre}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {r.especie.nombre}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{r._count.animales}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Raza</DialogTitle>
            <DialogDescription>
              Agrega una nueva raza al catálogo
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createMutation.mutate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="raza-nombre">Nombre</Label>
              <Input
                id="raza-nombre"
                placeholder="ej. Angus, Hereford, Brahman"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="raza-especie">Especie</Label>
              <Select value={especieId} onValueChange={setEspecieId} required>
                <SelectTrigger id="raza-especie">
                  <SelectValue placeholder="Seleccionar especie" />
                </SelectTrigger>
                <SelectContent>
                  {especies.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {capitalize(e.nombre)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !nombre.trim() || !especieId}
              >
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Crear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Categorias Tab
// ---------------------------------------------------------------------------

function CategoriasTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nombre, setNombre] = useState("")
  const [especieId, setEspecieId] = useState("")
  const [sexo, setSexo] = useState("")
  const [edadMin, setEdadMin] = useState("")
  const [edadMax, setEdadMax] = useState("")
  const [filterEspecieId, setFilterEspecieId] = useState<string>("all")

  const { data: especies = [] } = useQuery({
    queryKey: ["especies"],
    queryFn: fetchEspecies,
  })

  const { data: categorias = [], isLoading, error } = useQuery({
    queryKey: ["categorias", filterEspecieId],
    queryFn: () =>
      fetchCategorias(filterEspecieId !== "all" ? filterEspecieId : undefined),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          especieId,
          sexo: sexo || null,
          edadMinMeses: edadMin ? Number(edadMin) : null,
          edadMaxMeses: edadMax ? Number(edadMax) : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al crear categoría")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias"] })
      queryClient.invalidateQueries({ queryKey: ["especies"] })
      toast.success("Categoría creada correctamente")
      resetForm()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  function resetForm() {
    setDialogOpen(false)
    setNombre("")
    setEspecieId("")
    setSexo("")
    setEdadMin("")
    setEdadMax("")
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterEspecieId} onValueChange={setFilterEspecieId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas las especies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las especies</SelectItem>
                {especies.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {capitalize(e.nombre)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            {categorias.length}{" "}
            {categorias.length === 1 ? "categoría" : "categorías"}
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Categoría
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Especie</TableHead>
              <TableHead>Sexo</TableHead>
              <TableHead>Rango de Edad</TableHead>
              <TableHead className="text-center">Animales</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton cols={5} />}
            {!isLoading && categorias.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No hay categorías registradas
                </TableCell>
              </TableRow>
            )}
            {categorias.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nombre}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {c.especie.nombre}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={sexoBadgeVariant(c.sexo)}>
                    {sexoLabel(c.sexo)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {edadRangeLabel(c.edadMinMeses, c.edadMaxMeses)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{c._count.animales}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Categoría</DialogTitle>
            <DialogDescription>
              Agrega una nueva categoría al catálogo
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createMutation.mutate()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="cat-nombre">Nombre</Label>
              <Input
                id="cat-nombre"
                placeholder="ej. Ternero, Vaquillona, Novillo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-especie">Especie</Label>
              <Select value={especieId} onValueChange={setEspecieId} required>
                <SelectTrigger id="cat-especie">
                  <SelectValue placeholder="Seleccionar especie" />
                </SelectTrigger>
                <SelectContent>
                  {especies.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {capitalize(e.nombre)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-sexo">Sexo</Label>
              <Select value={sexo} onValueChange={setSexo}>
                <SelectTrigger id="cat-sexo">
                  <SelectValue placeholder="Ambos (sin restricción)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Macho</SelectItem>
                  <SelectItem value="F">Hembra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cat-edad-min">Edad mínima (meses)</Label>
                <Input
                  id="cat-edad-min"
                  type="number"
                  min={0}
                  placeholder="ej. 0"
                  value={edadMin}
                  onChange={(e) => setEdadMin(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-edad-max">Edad máxima (meses)</Label>
                <Input
                  id="cat-edad-max"
                  type="number"
                  min={0}
                  placeholder="ej. 12"
                  value={edadMax}
                  onChange={(e) => setEdadMax(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !nombre.trim() || !especieId}
              >
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Crear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CatalogoPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Catálogo Base</h1>
        <p className="text-muted-foreground">
          Administra las especies, razas y categorías de tu establecimiento
        </p>
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
          <Tabs defaultValue="especies" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="especies" className="gap-2">
                <Bug className="h-4 w-4 hidden sm:inline-block" />
                Especies
              </TabsTrigger>
              <TabsTrigger value="razas" className="gap-2">
                <Tags className="h-4 w-4 hidden sm:inline-block" />
                Razas
              </TabsTrigger>
              <TabsTrigger value="categorias" className="gap-2">
                <Layers className="h-4 w-4 hidden sm:inline-block" />
                Categorías
              </TabsTrigger>
            </TabsList>

            <TabsContent value="especies" className="mt-6">
              <EspeciesTab />
            </TabsContent>

            <TabsContent value="razas" className="mt-6">
              <RazasTab />
            </TabsContent>

            <TabsContent value="categorias" className="mt-6">
              <CategoriasTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
