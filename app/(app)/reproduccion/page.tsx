"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Activity, Baby, Ban, ChevronLeft, ChevronRight, Heart, Loader2, MoreHorizontal, Pencil, Plus, Search, Syringe, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AnularEventoDialog, EditarEventoDialog, ToradaEditarDialog, type EventoAccion, type ToradaEditable } from "@/components/reproduccion/acciones"
import { etiquetaAnimal, type AnimalOpcion } from "@/components/reproduccion/animal-combobox"
import { DesteteDialog, ParicionDialog, ServicioDialog, TactoDialog, ToradaDialog, type Opcion } from "@/components/reproduccion/dialogos"
import { useTenant } from "@/lib/context/tenant-context"
import { usePermissions } from "@/lib/hooks/use-permissions"
import { formatoDia } from "@/lib/inventario/fechas"
import {
  ETIQUETA_METODO_DESTETE, ETIQUETA_METODO_TACTO, ETIQUETA_RESULTADO_TACTO, ETIQUETA_TIPO_PARTO, ETIQUETA_TIPO_SERVICIO, ROLES_ANULAR, ROLES_REPRODUCCION,
  type AccionReproduccion, type ResultadoTacto, type TipoEvento,
} from "@/lib/reproduccion/validation"

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface Ident { id: string; caravanaVisual: string | null; cuig: string | null }
interface Anulable { id: string; fecha: string; observ: string | null; anuladoAt?: string | null; motivoAnulacion?: string | null }
interface Servicio extends Anulable { tipo: string; toroNombre: string | null; loteSemen: string | null; inseminador: string | null; hembra: Ident; macho: Ident | null; torada: { nombre: string } | null; tacto: { resultado: string; anuladoAt: string | null } | null }
interface Tacto extends Anulable { resultado: string; mesesGest: number | null; fechaProbableParto: string | null; metodo: string; veterinario: string | null; hembra: Ident }
interface Paricion extends Anulable { resultado: string; pesoNacerKg: number | null; tipoParto: string | null; dificultad: number | null; sexoCria: string | null; padreExterno: string | null; madre: Ident; padre: Ident | null; nacido: Ident | null }
interface Destete extends Anulable { pesoKg: number | null; edadDias: number | null; metodo: string | null; gdpKg: number | null; peso205: number | null; animal: Ident & { raza: { nombre: string } | null }; loteDestete: { nombre: string } | null }
interface Torada { id: string; nombre: string; tipo: string; fechaInicio: string; fechaFin: string | null; observ: string | null; cantidadHembras: number | null; cantidadMachos: number | null; lote: { nombre: string; especieId: string }; machos: { animal: AnimalOpcion }[]; _count: { servicios: number } }
interface Resumen {
  anio: number
  servidasSinTacto: number
  tacto: { prenadas: number; vacias: number; dudosas: number; absorcion: number; porcentajePrenez: number | null }
  aParir: number
  partosAtrasados: number
  partosProximos30: number
  partosAnio: { vivos: number; muertos: number; abortos: number }
  destetesAnio: number
}
interface Pagina<T> { data: T[]; pagination: { page: number; totalPages: number; total: number } }
interface Columna<T> { titulo: string; celda: (fila: T) => ReactNode; derecha?: boolean }

// ─── Badges ─────────────────────────────────────────────────────────────────

const CLASE_TIPO: Record<string, string> = {
  natural: "bg-blue-100 text-blue-800 border-blue-200", ia: "bg-purple-100 text-purple-800 border-purple-200",
  iatf: "bg-violet-100 text-violet-800 border-violet-200", mixto: "bg-indigo-100 text-indigo-800 border-indigo-200",
}
const CLASE_TACTO: Record<string, string> = {
  "preñada": "bg-green-100 text-green-800 border-green-200", vacia: "bg-red-100 text-red-800 border-red-200",
  dudosa: "bg-yellow-100 text-yellow-800 border-yellow-200", absorcion: "bg-orange-100 text-orange-800 border-orange-200",
}
const TipoBadge = ({ tipo }: { tipo: string }) => <Badge className={CLASE_TIPO[tipo]}>{ETIQUETA_TIPO_SERVICIO[tipo as keyof typeof ETIQUETA_TIPO_SERVICIO] ?? tipo}</Badge>
const ResultadoBadge = ({ resultado }: { resultado: string }) => <Badge className={CLASE_TACTO[resultado]}>{ETIQUETA_RESULTADO_TACTO[resultado as ResultadoTacto] ?? resultado}</Badge>
const guion = (v: ReactNode) => (v == null || v === "" ? <span className="text-muted-foreground">—</span> : v)
const num = (n: number | null) => (n == null ? null : n.toLocaleString("es-AR", { maximumFractionDigits: 1 }))

// ─── Columnas ───────────────────────────────────────────────────────────────

const COL_SERVICIOS: Columna<Servicio>[] = [
  { titulo: "Fecha", celda: (s) => formatoDia(s.fecha) },
  { titulo: "Hembra", celda: (s) => <span className="font-medium">{etiquetaAnimal(s.hembra)}</span> },
  { titulo: "Tipo", celda: (s) => <TipoBadge tipo={s.tipo} /> },
  { titulo: "Macho / toro", celda: (s) => guion(s.macho ? etiquetaAnimal(s.macho) : s.toroNombre) },
  { titulo: "Torada", celda: (s) => guion(s.torada?.nombre) },
  { titulo: "Inseminador", celda: (s) => guion(s.inseminador) },
  { titulo: "Tacto", celda: (s) => (s.tacto && !s.tacto.anuladoAt ? <ResultadoBadge resultado={s.tacto.resultado} /> : <span className="text-muted-foreground">Pendiente</span>) },
]
const COL_TACTOS: Columna<Tacto>[] = [
  { titulo: "Fecha", celda: (t) => formatoDia(t.fecha) },
  { titulo: "Hembra", celda: (t) => <span className="font-medium">{etiquetaAnimal(t.hembra)}</span> },
  { titulo: "Resultado", celda: (t) => <ResultadoBadge resultado={t.resultado} /> },
  { titulo: "Meses gest.", celda: (t) => guion(num(t.mesesGest)), derecha: true },
  { titulo: "Parto probable", celda: (t) => guion(t.fechaProbableParto && formatoDia(t.fechaProbableParto)) },
  { titulo: "Método", celda: (t) => <Badge variant="outline">{ETIQUETA_METODO_TACTO[t.metodo as keyof typeof ETIQUETA_METODO_TACTO] ?? t.metodo}</Badge> },
  { titulo: "Veterinario", celda: (t) => guion(t.veterinario) },
]
const COL_PARICIONES: Columna<Paricion>[] = [
  { titulo: "Fecha", celda: (p) => formatoDia(p.fecha) },
  { titulo: "Madre", celda: (p) => <span className="font-medium">{etiquetaAnimal(p.madre)}</span> },
  { titulo: "Cría", celda: (p) => (
    p.resultado === "aborto" ? <Badge className="bg-orange-100 text-orange-800 border-orange-200">Aborto</Badge>
    : p.resultado === "vivo" ? (
      <span className="flex items-center gap-2"><Badge className="bg-green-100 text-green-800 border-green-200">Viva</Badge>
        {p.nacido && <Link href={`/ganado/${p.nacido.id}`} className="text-primary underline">{etiquetaAnimal(p.nacido)}</Link>}</span>
    ) : <Badge className="bg-red-100 text-red-800 border-red-200">Muerta</Badge>
  ) },
  { titulo: "Peso (kg)", celda: (p) => guion(num(p.pesoNacerKg)), derecha: true },
  { titulo: "Tipo de parto", celda: (p) => guion(p.tipoParto && ETIQUETA_TIPO_PARTO[p.tipoParto as keyof typeof ETIQUETA_TIPO_PARTO]) },
  { titulo: "Sexo", celda: (p) => guion(p.sexoCria === "M" ? "Macho" : p.sexoCria === "F" ? "Hembra" : null) },
  { titulo: "Padre", celda: (p) => guion(p.padre ? etiquetaAnimal(p.padre) : p.padreExterno) },
]
const COL_DESTETES: Columna<Destete>[] = [
  { titulo: "Fecha", celda: (d) => formatoDia(d.fecha) },
  { titulo: "Animal", celda: (d) => <span className="font-medium">{etiquetaAnimal(d.animal)}</span> },
  { titulo: "Raza", celda: (d) => guion(d.animal.raza?.nombre) },
  { titulo: "Peso (kg)", celda: (d) => guion(num(d.pesoKg)), derecha: true },
  { titulo: "Edad (días)", celda: (d) => guion(d.edadDias), derecha: true },
  { titulo: "Ganancia (kg/día)", celda: (d) => guion(d.gdpKg != null ? d.gdpKg.toLocaleString("es-AR", { maximumFractionDigits: 3 }) : null), derecha: true },
  { titulo: "Peso 205 d", celda: (d) => guion(num(d.peso205)), derecha: true },
  { titulo: "Método", celda: (d) => guion(d.metodo && ETIQUETA_METODO_DESTETE[d.metodo as keyof typeof ETIQUETA_METODO_DESTETE]) },
  { titulo: "Grupo", celda: (d) => guion(d.loteDestete?.nombre) },
]
const COL_TORADAS: Columna<Torada>[] = [
  { titulo: "Nombre", celda: (t) => <span className="font-medium">{t.nombre}</span> },
  { titulo: "Tipo", celda: (t) => <TipoBadge tipo={t.tipo} /> },
  { titulo: "Inicio", celda: (t) => formatoDia(t.fechaInicio) },
  { titulo: "Fin", celda: (t) => (t.fechaFin ? formatoDia(t.fechaFin) : <Badge className="bg-green-100 text-green-800 border-green-200">Abierta</Badge>) },
  { titulo: "Grupo", celda: (t) => t.lote.nombre },
  { titulo: "Hembras", celda: (t) => guion(t.cantidadHembras), derecha: true },
  { titulo: "Toros", celda: (t) => guion(t.machos.length ? t.machos.map((m) => etiquetaAnimal(m.animal)).join(", ") : t.cantidadMachos) },
  { titulo: "Servicios", celda: (t) => t._count.servicios, derecha: true },
]

// ─── Página ─────────────────────────────────────────────────────────────────

type Pestania = "servicios" | "tactos" | "pariciones" | "destetes" | "toradas"
const ACCION_DE: Record<Pestania, AccionReproduccion> = { servicios: "servicio", tactos: "tacto", pariciones: "paricion", destetes: "destete", toradas: "torada" }

export default function ReproduccionPage() {
  const { establecimientoActivo, isLoading: tenantLoading } = useTenant()
  const estId = establecimientoActivo?.id ?? ""
  const queryClient = useQueryClient()
  const { hasRole } = usePermissions()
  const puede = (a: AccionReproduccion) => hasRole(...ROLES_REPRODUCCION[a])
  const [pestania, setPestania] = useState<Pestania>("servicios")
  const [abierto, setAbierto] = useState<Pestania | null>(null)
  const [editando, setEditando] = useState<EventoAccion | null>(null)
  const [anulando, setAnulando] = useState<EventoAccion | null>(null)
  const [torada, setTorada] = useState<ToradaEditable | null>(null)
  const puedeAnular = hasRole(...ROLES_ANULAR)
  /** Menú de acciones de una fila (según el rol en la organización activa; el servidor revalida por campo). */
  const acciones = (tipo: TipoEvento, accion: AccionReproduccion, descripcion: (f: never) => string, valores: (f: never) => Record<string, unknown>) =>
    (puede(accion) || puedeAnular)
      ? (f: Anulable) => (f.anuladoAt ? null : (
        <MenuFila>
          {puede(accion) && <DropdownMenuItem onSelect={() => setEditando({ tipo, id: f.id, descripcion: descripcion(f as never), valores: valores(f as never) })}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>}
          {puedeAnular && <DropdownMenuItem className="text-destructive" onSelect={() => setAnulando({ tipo, id: f.id, descripcion: descripcion(f as never), valores: {} })}><Ban className="mr-2 h-4 w-4" />Anular</DropdownMenuItem>}
        </MenuFila>
      ))
      : undefined

  const resumen = useQuery({
    queryKey: ["repro", "resumen", estId],
    queryFn: async () => { const r = await fetch(`/api/reproduccion/resumen?establecimientoId=${estId}`); const b = await r.json(); if (!r.ok) throw new Error(b.error ?? "No se pudo cargar"); return b.data as Resumen },
    enabled: !!estId,
  })
  const lotes = useQuery({
    queryKey: ["repro", "lotes", estId],
    queryFn: async () => {
      const r = await fetch(`/api/establecimientos/${estId}/lotes`)
      const b = await r.json().catch(() => [])
      const lista = (Array.isArray(b) ? b : b.data ?? []) as (Opcion & { activo?: boolean })[]
      return lista.filter((l) => l.activo !== false).map((l) => ({ id: l.id, nombre: l.nombre }))
    },
    enabled: !!estId,
  })
  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["repro"] })
  const abrir = (p: Pestania) => { setPestania(p); setAbierto(p) }

  if (tenantLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-64" /><div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-96" /></div>
  }
  if (!establecimientoActivo) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
        <Heart className="mb-4 h-16 w-16 text-muted-foreground/30" />
        <h2 className="mb-2 text-xl font-semibold">Sin campo seleccionado</h2>
        <p className="max-w-md text-muted-foreground">Elegí un campo en el menú superior para ver los datos reproductivos.</p>
      </div>
    )
  }

  const r = resumen.data
  const kpi = (v: ReactNode) => (resumen.isPending ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Cargando" /> : v)
  const diagnosticadas = r ? r.tacto.prenadas + r.tacto.vacias + r.tacto.absorcion : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight md:text-3xl"><Heart className="h-8 w-8 text-primary" />Reproducción</h1>
          <p className="mt-1 text-muted-foreground">Toradas, servicio, tacto, parición y destete · {establecimientoActivo.nombre}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {puede("servicio") && <Button size="sm" variant="outline" onClick={() => abrir("servicios")}><Syringe className="mr-2 h-4 w-4" />Nuevo servicio</Button>}
          {puede("tacto") && <Button size="sm" variant="outline" onClick={() => abrir("tactos")}><Activity className="mr-2 h-4 w-4" />Registrar tacto</Button>}
          {puede("paricion") && <Button size="sm" onClick={() => abrir("pariciones")}><Baby className="mr-2 h-4 w-4" />Registrar parto</Button>}
        </div>
      </div>

      {resumen.isError && <p role="alert" className="erp-error">{resumen.error.message} <button className="underline" onClick={() => resumen.refetch()}>Reintentar</button></p>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi titulo="Servidas sin tactar" icono={Syringe} valor={kpi(r?.servidasSinTacto)} detalle="hembras con servicio en los últimos 12 meses" />
        <Kpi titulo="% Preñez" icono={TrendingUp} valor={kpi(r?.tacto.porcentajePrenez != null ? `${r.tacto.porcentajePrenez} %` : "—")}
          detalle={r ? `${r.tacto.prenadas} preñadas de ${diagnosticadas} tactadas (12 meses)${r.tacto.dudosas ? ` · ${r.tacto.dudosas} dudosas` : ""}` : ""} />
        <Kpi titulo="Preñadas a parir" icono={Heart} valor={kpi(r?.aParir)}
          detalle={r ? <>{r.partosProximos30} en los próximos 30 días{r.partosAtrasados > 0 && <span className="text-amber-700"> · {r.partosAtrasados} pasadas de fecha</span>}</> : ""} />
        <Kpi titulo={`Partos ${r?.anio ?? ""}`} icono={Baby} valor={kpi(r ? r.partosAnio.vivos + r.partosAnio.muertos : null)}
          detalle={r ? `${r.partosAnio.vivos} vivos · ${r.partosAnio.muertos} muertos${r.partosAnio.abortos ? ` · ${r.partosAnio.abortos} abortos` : ""} · ${r.destetesAnio} destetes` : ""} />
      </div>

      <Tabs value={pestania} onValueChange={(v) => setPestania(v as Pestania)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="servicios">Servicios</TabsTrigger>
          <TabsTrigger value="tactos">Tactos</TabsTrigger>
          <TabsTrigger value="pariciones">Partos</TabsTrigger>
          <TabsTrigger value="destetes">Destetes</TabsTrigger>
          <TabsTrigger value="toradas">Toradas</TabsTrigger>
        </TabsList>
        <TabsContent value="servicios"><ListaEventos<Servicio> titulo="Servicios" ruta="servicios" estId={estId} columnas={COL_SERVICIOS} vacio="No hay servicios registrados."
          acciones={acciones("servicio", "servicio", (s: Servicio) => `Servicio de ${etiquetaAnimal(s.hembra)} del ${formatoDia(s.fecha)}`, (s: Servicio) => ({ toroNombre: s.toroNombre, loteSemen: s.loteSemen, inseminador: s.inseminador, observ: s.observ }))} nuevo={puede("servicio") ? { texto: "Nuevo servicio", onClick: () => setAbierto("servicios") } : undefined} /></TabsContent>
        <TabsContent value="tactos"><ListaEventos<Tacto> titulo="Diagnósticos de preñez" ruta="tactos" estId={estId} columnas={COL_TACTOS} vacio="No hay tactos registrados."
          acciones={acciones("tacto", "tacto", (t: Tacto) => `Tacto de ${etiquetaAnimal(t.hembra)} del ${formatoDia(t.fecha)}`, (t: Tacto) => ({ veterinario: t.veterinario, observ: t.observ }))} nuevo={puede("tacto") ? { texto: "Nuevo tacto", onClick: () => setAbierto("tactos") } : undefined} /></TabsContent>
        <TabsContent value="pariciones"><ListaEventos<Paricion> titulo="Partos" ruta="pariciones" estId={estId} columnas={COL_PARICIONES} vacio="No hay partos registrados."
          acciones={acciones("paricion", "paricion", (p: Paricion) => `Parto de ${etiquetaAnimal(p.madre)} del ${formatoDia(p.fecha)}`, (p: Paricion) => ({ tipoParto: p.tipoParto, dificultad: p.dificultad, observ: p.observ }))} nuevo={puede("paricion") ? { texto: "Nuevo parto", onClick: () => setAbierto("pariciones") } : undefined} /></TabsContent>
        <TabsContent value="destetes"><ListaEventos<Destete> titulo="Destetes" ruta="destetes" estId={estId} columnas={COL_DESTETES} vacio="No hay destetes registrados."
          acciones={acciones("destete", "destete", (d: Destete) => `Destete de ${etiquetaAnimal(d.animal)} del ${formatoDia(d.fecha)}`, (d: Destete) => ({ metodo: d.metodo, observ: d.observ }))} nuevo={puede("destete") ? { texto: "Nuevo destete", onClick: () => setAbierto("destetes") } : undefined} /></TabsContent>
        <TabsContent value="toradas"><ListaEventos<Torada> titulo="Temporadas de servicio" ruta="toradas" estId={estId} columnas={COL_TORADAS} vacio="No hay toradas. Creá una para empezar." sinBusqueda sinAnulados
          acciones={puede("torada") ? (t: Torada) => <Button size="sm" variant="outline" onClick={() => setTorada(t)}>{t.fechaFin ? "Editar" : "Cerrar / toros"}</Button> : undefined} nuevo={puede("torada") ? { texto: "Nueva torada", onClick: () => setAbierto("toradas") } : undefined} /></TabsContent>
      </Tabs>

      <ServicioDialog open={abierto === "servicios" && puede(ACCION_DE.servicios)} onOpenChange={(o) => !o && setAbierto(null)} estId={estId} onSuccess={invalidar} />
      <TactoDialog open={abierto === "tactos" && puede(ACCION_DE.tactos)} onOpenChange={(o) => !o && setAbierto(null)} estId={estId} onSuccess={invalidar} />
      <ParicionDialog open={abierto === "pariciones" && puede(ACCION_DE.pariciones)} onOpenChange={(o) => !o && setAbierto(null)} estId={estId} onSuccess={invalidar} />
      <DesteteDialog open={abierto === "destetes" && puede(ACCION_DE.destetes)} onOpenChange={(o) => !o && setAbierto(null)} estId={estId} lotes={lotes.data ?? []} onSuccess={invalidar} />
      <ToradaDialog open={abierto === "toradas" && puede(ACCION_DE.toradas)} onOpenChange={(o) => !o && setAbierto(null)} lotes={lotes.data ?? []} onSuccess={invalidar} />
      <EditarEventoDialog evento={editando} onOpenChange={(o) => !o && setEditando(null)} onGuardado={invalidar} />
      <AnularEventoDialog evento={anulando} onOpenChange={(o) => !o && setAnulando(null)} onAnulado={() => { invalidar(); queryClient.invalidateQueries({ queryKey: ["ganado"] }) }} />
      <ToradaEditarDialog torada={torada} estId={estId} onOpenChange={(o) => !o && setTorada(null)} onGuardado={invalidar} />
    </div>
  )
}

function Kpi({ titulo, icono: Icono, valor, detalle }: { titulo: string; icono: typeof Heart; valor: ReactNode; detalle: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{titulo}</CardTitle><Icono className="h-4 w-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{valor}</div><p className="text-xs text-muted-foreground">{detalle}</p></CardContent>
    </Card>
  )
}

/** Listado paginado de un tipo de evento del campo, con búsqueda por caravana. */
function MenuFila({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" aria-label="Acciones"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

function ListaEventos<T extends { id: string; anuladoAt?: string | null; motivoAnulacion?: string | null }>({ titulo, ruta, estId, columnas, vacio, nuevo, sinBusqueda, sinAnulados, acciones }: {
  titulo: string; ruta: string; estId: string; columnas: Columna<T>[]; vacio: string
  nuevo?: { texto: string; onClick: () => void }; sinBusqueda?: boolean; sinAnulados?: boolean
  acciones?: (fila: T) => ReactNode
}) {
  const [verAnulados, setVerAnulados] = useState(false)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [busqueda, setBusqueda] = useState("")
  useEffect(() => { const t = setTimeout(() => { setBusqueda(q.trim()); setPage(1) }, 300); return () => clearTimeout(t) }, [q])
  useEffect(() => setPage(1), [estId])
  const params = new URLSearchParams({ establecimientoId: estId, page: String(page), limit: "20", ...(busqueda ? { q: busqueda } : {}), ...(verAnulados ? { verAnulados: "true" } : {}) })
  const lista = useQuery({
    queryKey: ["repro", ruta, params.toString()],
    queryFn: async () => { const r = await fetch(`/api/reproduccion/${ruta}?${params}`); const b = await r.json(); if (!r.ok) throw new Error(b.error ?? "No se pudo cargar"); return b as Pagina<T> },
    enabled: !!estId,
    placeholderData: (prev) => prev,
  })
  const filas = lista.data?.data ?? []
  const pag = lista.data?.pagination
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{titulo}{pag ? <span className="ml-2 text-sm font-normal text-muted-foreground">({pag.total})</span> : null}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {!sinBusqueda && (
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input aria-label="Buscar por caravana" placeholder="Buscar caravana…" className="w-48 pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
          {!sinAnulados && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={verAnulados} onChange={(e) => { setVerAnulados(e.target.checked); setPage(1) }} />Ver anulados</label>
          )}
          {nuevo && <Button onClick={nuevo.onClick}><Plus className="mr-2 h-4 w-4" />{nuevo.texto}</Button>}
        </div>
      </CardHeader>
      <CardContent>
        {lista.isPending ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Cargando" /></div>
        ) : lista.isError ? (
          <p role="alert" className="erp-error">{lista.error.message} <button className="underline" onClick={() => lista.refetch()}>Reintentar</button></p>
        ) : !filas.length ? (
          <p className="py-12 text-center text-muted-foreground">{busqueda ? "Sin resultados para esa búsqueda." : vacio}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b">{columnas.map((c) => <th key={c.titulo} className={`px-2 py-3 font-medium ${c.derecha ? "text-right" : "text-left"}`}>{c.titulo}</th>)}{acciones && <th className="w-10"><span className="sr-only">Acciones</span></th>}</tr></thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.id} className={`border-b hover:bg-muted/50 ${f.anuladoAt ? "text-muted-foreground" : ""}`}>
                      {columnas.map((c, k) => (
                        <td key={c.titulo} className={`px-2 py-3 ${c.derecha ? "text-right tabular-nums" : ""} ${f.anuladoAt ? "line-through decoration-muted-foreground/60" : ""}`}>
                          {c.celda(f)}
                          {k === 0 && f.anuladoAt && <Badge variant="outline" className="ml-2 no-underline" title={f.motivoAnulacion ?? undefined}>Anulado</Badge>}
                        </td>
                      ))}
                      {acciones && <td className="px-1 py-2 text-right">{acciones(f)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pag && pag.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Página {pag.page} de {pag.totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" aria-label="Página siguiente" disabled={page >= pag.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
