"use client"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, CircleAlert, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/ui/status-pill"

type Ficha={identificacion:{visual:string|null;rfid:string|null};estado:string;establecimiento:{nombre:string;renspa:string|null}|null;lote:string|null;ubicacion:string|null;peso:number|null;checks:{label:string;ok:boolean}[];faltantes:number;aviso:string;fuente:string;sanidad:{fecha:string;producto:string;motivo:string|null}[]}
export function PreparacionSenasa({animalId}:{animalId:string}){
  const query=useQuery<Ficha>({queryKey:["preparacion-senasa",animalId],queryFn:async()=>{const r=await fetch(`/api/ganado/${animalId}/preparacion`);const b=await r.json();if(!r.ok)throw Error(b.error);return b.data}})
  if(query.isPending)return <p role="status">Revisando datos del animal…</p>
  if(query.isError)return <p role="alert" className="erp-error">No se pudo cargar la ficha. <button className="underline" onClick={()=>query.refetch()}>Reintentar</button></p>
  const d=query.data
  function download(){
    const lines=["AGROMONITOR — FICHA INTERNA, NO ES UN DOCUMENTO OFICIAL",`Caravana: ${d.identificacion.visual??"Sin dato"}`,`RFID: ${d.identificacion.rfid??"Sin dato"}`,`Campo: ${d.establecimiento?.nombre??"Sin dato"}`,`RENSPA: ${d.establecimiento?.renspa??"Sin dato"}`,`Estado ERP: ${d.estado}`,`Lote: ${d.lote??"Sin dato"}`,`Ubicación: ${d.ubicacion??"Sin dato"}`,`Último peso: ${d.peso??"Sin dato"} kg`,"",...d.checks.map(c=>`${c.ok?"Cargado":"Falta"}: ${c.label}`),"",d.aviso,d.fuente]
    const url=URL.createObjectURL(new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=`ficha-animal-${animalId}.txt`;a.click();URL.revokeObjectURL(url)
  }
  return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Preparación de documentación</h3><p className="mt-1 text-sm text-muted-foreground">Revisión de los datos internos antes de consultar SENASA.</p></div><StatusPill tone={d.faltantes?"warning":"neutral"}>{d.faltantes?`${d.faltantes} datos por completar`:"Datos internos cargados"}</StatusPill></div>
    <p className="rounded-lg border bg-muted/50 p-4 text-sm leading-6">{d.aviso}</p>
    <div className="grid gap-3 md:grid-cols-2">{d.checks.map(c=><div key={c.label} className="flex items-start gap-3 rounded-lg border p-3 text-sm">{c.ok?<CheckCircle2 className="h-5 w-5 shrink-0 text-status-ok"/>:<CircleAlert className="h-5 w-5 shrink-0 text-status-warn"/>}<span>{c.label}</span></div>)}</div>
    <div className="grid gap-3 text-sm sm:grid-cols-3"><p>Lote: <strong>{d.lote??"Sin asignar"}</strong></p><p>Ubicación: <strong>{d.ubicacion??"Sin asignar"}</strong></p><p>Último peso: <strong>{d.peso??"Sin dato"} kg</strong></p></div>
    <div><h4 className="mb-2 text-sm font-semibold">Últimos registros sanitarios individuales</h4>{d.sanidad.length?d.sanidad.map((e,i)=><p className="border-t py-2 text-sm" key={i}>{e.fecha.slice(0,10)} · {e.producto} · {e.motivo||"Sin motivo"}</p>):<p className="text-sm text-muted-foreground">No hay eventos sanitarios individuales registrados. Revisá también los tratamientos del lote con el veterinario.</p>}</div>
    <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={download}><Download/>Descargar ficha interna</Button><Button variant="link" asChild><a href={d.fuente} target="_blank" rel="noreferrer">Consultar el trámite oficial</a></Button></div>
  </section>
}
