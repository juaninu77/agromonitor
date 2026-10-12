"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowRight, BookOpen, Lightbulb, Search, UserCheck, X } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeading } from "@/components/ui/page-heading"
import { anclaGuia, buscarAyuda, type GuiaAyuda, type SeccionAyuda } from "@/lib/ayuda/buscar"
import { SECCIONES_AYUDA } from "@/lib/ayuda/contenido"

/** Texto con «nombres de botones» resaltados. */
function Texto({ children }: { children: string }) {
  const partes = children.split(/(«[^»]+»)/g)
  return <>{partes.map((p, i) => (p.startsWith("«") ? <strong key={i} className="font-semibold text-foreground">{p}</strong> : p))}</>
}

function Guia({ seccion, guia }: { seccion: SeccionAyuda; guia: GuiaAyuda }) {
  return (
    <AccordionItem value={anclaGuia(seccion.id, guia.id)} id={anclaGuia(seccion.id, guia.id)} className="scroll-mt-24">
      <AccordionTrigger className="text-left text-base hover:no-underline">{guia.titulo}</AccordionTrigger>
      <AccordionContent className="space-y-3 text-sm leading-6 text-muted-foreground">
        {guia.resumen && <p><Texto>{guia.resumen}</Texto></p>}
        {guia.quien && <p className="flex items-center gap-2"><UserCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden /><span><span className="font-medium text-foreground">Quién puede:</span> {guia.quien}</span></p>}
        {guia.pasos?.length ? (
          <ol className="space-y-2">
            {guia.pasos.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden>{i + 1}</span>
                <span className="pt-0.5"><Texto>{p}</Texto></span>
              </li>
            ))}
          </ol>
        ) : null}
        {guia.notas?.length ? (
          <ul className="space-y-1.5 rounded-lg border bg-muted/40 p-3">
            {guia.notas.map((n, i) => <li key={i} className="flex gap-2"><Lightbulb className="mt-1 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden /><span><Texto>{n}</Texto></span></li>)}
          </ul>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  )
}

export function AyudaCliente() {
  const params = useSearchParams()
  const [consulta, setConsulta] = useState(params.get("q") ?? "")
  const [abiertas, setAbiertas] = useState<string[]>([])
  const secciones = useMemo(() => buscarAyuda(SECCIONES_AYUDA, consulta), [consulta])
  const total = secciones.reduce((n, s) => n + s.guias.length, 0)
  const buscando = consulta.trim().length > 1

  // Un enlace a una guía (#seccion--guia) la abre; a una sección (#seccion), la muestra
  useEffect(() => {
    const irAlAncla = () => {
      const ancla = decodeURIComponent(window.location.hash.slice(1))
      if (!ancla) return
      // Un enlace a una guía la muestra aunque haya una búsqueda que la oculte
      setConsulta("")
      if (ancla.includes("--")) setAbiertas((a) => (a.includes(ancla) ? a : [...a, ancla]))
      requestAnimationFrame(() => document.getElementById(ancla)?.scrollIntoView({ block: "start" }))
    }
    irAlAncla()
    window.addEventListener("hashchange", irAlAncla)
    return () => window.removeEventListener("hashchange", irAlAncla)
  }, [])

  return (
    <div className="space-y-6">
      <PageHeading icon={BookOpen} title="Ayuda" description="Cómo hacer cada cosa en AgroMonitor: guías paso a paso por módulo, con los nombres de los botones tal como aparecen en la pantalla." />

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Buscar en la ayuda" placeholder="Buscar: vacunar, destete, invitar, transferir stock…" className="pl-9 pr-9" value={consulta} onChange={(e) => setConsulta(e.target.value)} />
        {consulta && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" aria-label="Limpiar búsqueda" onClick={() => setConsulta("")}><X className="h-4 w-4" /></Button>}
      </div>
      {buscando && <p className="text-sm text-muted-foreground" role="status">{total ? `${total} ${total === 1 ? "guía encontrada" : "guías encontradas"}` : "No hay guías con esas palabras. Probá con otra palabra o revisá el índice."}</p>}

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Índice de la ayuda" className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Índice</p>
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-0.5">
            {secciones.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1 text-sm hover:bg-accent lg:border-0 lg:py-1.5">
                  {s.titulo}<span className="text-xs text-muted-foreground">{s.guias.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-10">
          {secciones.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titulo`} className="scroll-mt-20">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                <div className="min-w-0">
                  <h2 id={`${s.id}-titulo`} className="text-xl font-semibold tracking-tight">{s.titulo}</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{s.descripcion}</p>
                </div>
                {s.ruta && <Button asChild variant="outline" size="sm"><Link href={s.ruta}>Ir a {s.titulo}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}
              </div>
              <Accordion type="multiple" value={buscando ? s.guias.map((g) => anclaGuia(s.id, g.id)) : abiertas} onValueChange={(v) => { if (!buscando) setAbiertas(v) }}>
                {s.guias.map((g) => <Guia key={g.id} seccion={s} guia={g} />)}
              </Accordion>
            </section>
          ))}
        </div>
      </div>
      {!buscando && <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline">Consejo</Badge>Desde cualquier pantalla, el botón «?» del encabezado abre la ayuda de ese módulo.</div>}
    </div>
  )
}
