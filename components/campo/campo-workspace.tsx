"use client"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"

import { useEffect, useState, type FormEvent } from "react"
import { Truck, Sprout, Plus, Wrench, Gauge, ArrowDownToLine, ArrowUpFromLine, Search, Package, CheckCircle2 } from "lucide-react"
import { useTenant } from "@/lib/context/tenant-context"
import { PageHeading } from "@/components/ui/page-heading"
import { StatusPill } from "@/components/ui/status-pill"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { CONCEPTO_FORRAJE_LABEL, CONCEPTOS_FORRAJE, today } from "@/lib/campo/rules"
import { livestockTypes } from "@/lib/mapa/sector-state"

type Equipment={activoId:string;activo:{titulo:string;tipo:string;estado:string};marcaModelo:string;patente:string|null;unidad:string;lectura:string;version:number;estadoServicio:string;proximoServicioFecha:string|null;proximoServicioLectura:string|null;mantenimientos:{id:string;fecha:string;detalle:string;lectura:string}[]}
type Total={unidad:string;cantidad:string}
type Crop={id:string;sectorId:string;forrajeId:string;cosechado:Total[];forraje:{nombre:string};sector:{nombre:string};desde:string;hasta:string|null;superficieHa:number|null;estado:string;version:number;notas:string|null}
type Reserve={id:string;depositoId:string|null;deposito:{nombre:string}|null;cultivo:{desde:string;sector:{nombre:string}}|null;nombre:string;forraje:{nombre:string};stock:string;minimo:string;unidad:string;ubicacion:string;movimientos:{id:string;fecha:string;tipo:string;cantidad:string;motivo:string;concepto:string|null;sector:{nombre:string}|null;lote:{nombre:string}|null;cultivo:{sector:{nombre:string}}|null}[]}
type ReservaCatalogo={id:string;nombre:string;forrajeId:string;unidad:string;deposito:{nombre:string}|null}
type Row=Equipment|Crop|Reserve
type Mode="flota"|"cultivos"|"reservas"
type Action=Mode|"lecturas"|"servicios"|"cierre-cultivo"|"movimientos"|"cosechas"|"transferencias"
type Field={key:string;label:string;type?:string;required?:boolean;optional?:boolean;options?:{id:string;nombre:string}[];step?:string}
const option=(values:string[])=>values.map(id=>({id,nombre:id}))
const names:Record<Action,string>={flota:"Registrar equipo",lecturas:"Actualizar lectura",servicios:"Registrar servicio realizado",cultivos:"Registrar siembra",reservas:"Crear reserva",movimientos:"Registrar movimiento", "cierre-cultivo":"Cerrar cultivo",cosechas:"Registrar cosecha",transferencias:"Transferir a otro galpón"}
const fmt=(v:string)=>Number(v).toLocaleString("es-AR",{maximumFractionDigits:2})
const totales=(t:Total[])=>t.map(x=>`${fmt(x.cantidad)} ${x.unidad}`).join(" · ")
const statusNames:Record<string,string>={vencido:"Servicio vencido",proximo:"Servicio próximo",al_dia:"Al día",sin_plan:"Sin plan de servicio"}

export function CampoWorkspace({initialMode}:{initialMode:"flota"|"cultivos"}){
  const {establecimientoActivo,isLoading}=useTenant()
  if(isLoading)return <p role="status">Cargando campo…</p>
  if(!establecimientoActivo)return <p>Elegí un campo en el selector superior para comenzar.</p>
  return <Workspace key={establecimientoActivo.id} campo={establecimientoActivo.id} nombre={establecimientoActivo.nombre} initialMode={initialMode}/>
}
function Workspace({campo,nombre,initialMode}:{campo:string;nombre:string;initialMode:"flota"|"cultivos"}){
  const queryClient=useQueryClient(), router=useRouter(), params=useSearchParams(), sectorId=params.get("sectorId")??""
  const [mode,setMode]=useState<Mode>(params.get("vista")==="reservas"?"reservas":initialMode),[rows,setRows]=useState<Row[]>([]),[page,setPage]=useState(1),[total,setTotal]=useState(0),[q,setQ]=useState("")
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[revision,setRevision]=useState(0)
  const [catalog,setCatalog]=useState<{forrajes:{id:string;nombre:string}[];sectores:{id:string;nombre:string;tipo?:string}[];depositos?:{id:string;nombre:string}[];lotes?:{id:string;nombre:string}[];reservas?:ReservaCatalogo[];puedeEditar:boolean}>({forrajes:[],sectores:[],puedeEditar:false})
  const [ubicacion,setUbicacion]=useState(""),cosechar=params.get("cosechar")
  const [action,setAction]=useState<Action|null>(null),[selected,setSelected]=useState<Row|null>(null),[draft,setDraft]=useState<Record<string,string>>({}),[saving,setSaving]=useState(false),[formError,setFormError]=useState("")
  useEffect(()=>{
    const c=new AbortController();setLoading(true);setError("")
    Promise.all([
      fetch(`/api/campo/${mode}?establecimientoId=${campo}&page=${page}&q=${encodeURIComponent(q)}${ubicacion&&mode==="reservas"?`&ubicacion=${encodeURIComponent(ubicacion)}`:""}${sectorId?`&sectorId=${encodeURIComponent(sectorId)}`:""}`,{signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error);return b}),
      fetch(`/api/campo/catalogos?establecimientoId=${campo}`,{signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error);return b}),
    ]).then(([b,catalogs])=>{if(!c.signal.aborted){setRows(b.data);setTotal(b.total);setCatalog(catalogs)}})
      .catch(e=>{if(!c.signal.aborted){setError(e.message);setRows([])}}).finally(()=>{if(!c.signal.aborted)setLoading(false)})
    return()=>c.abort()
  },[campo,mode,page,q,revision,sectorId,ubicacion])
  // ?cosechar=<campaña> (desde la ficha del mapa) abre directamente el formulario de cosecha
  const [cosechaAbierta,setCosechaAbierta]=useState(false)
  useEffect(()=>{
    if(!cosechar||cosechaAbierta||loading||mode!=="cultivos"||!catalog.puedeEditar)return
    const row=rows.find(r=>"sector"in r&&r.id===cosechar);if(row){setCosechaAbierta(true);begin("cosechas",row)}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cosechar,loading,rows,catalog.puedeEditar])
  function begin(next:Action,row:Row|null=null,tipo="entrada"){
    setAction(next);setSelected(row);setFormError("");setNotice("")
    setDraft({sectorId:next==="cultivos"?sectorId:"",depositoId:mode==="reservas"?sectorId:"",concepto:tipo==="salida"?"consumo":"compra",fecha:today(),desde:today(),hasta:today(),tipo:next==="flota"?"vehiculo":tipo,unidad:next==="flota"?"km":"fardos",lectura:row&&"lectura"in row?row.lectura:"0",minimo:"0",moneda:"ARS",clave:crypto.randomUUID()})
  }
  function fields():Field[]{
    if(action==="flota")return [{key:"nombre",label:"Nombre del equipo",required:true},{key:"tipo",label:"Tipo",options:option(["vehiculo","maquinaria"])},{key:"marcaModelo",label:"Marca y modelo",required:true},{key:"patente",label:"Patente / identificación"},{key:"unidad",label:"Medidor",options:option(["km","horas"])},{key:"lectura",label:"Lectura actual",type:"number",step:"0.1",required:true},{key:"proximoServicioFecha",label:"Próximo servicio por fecha",type:"date"},{key:"proximoServicioLectura",label:"Próximo servicio por lectura",type:"number",step:"0.1"}]
    if(action==="lecturas")return [{key:"lectura",label:"Nueva lectura",type:"number",step:"0.1",required:true}]
    if(action==="servicios")return [{key:"fecha",label:"Fecha del servicio",type:"date",required:true},{key:"lectura",label:"Lectura al realizarlo",type:"number",step:"0.1",required:true},{key:"detalle",label:"Trabajo realizado / taller",required:true},{key:"costo",label:"Costo (opcional)",type:"number",step:"0.01"},{key:"moneda",label:"Moneda",options:option(["ARS","USD"])},{key:"proximoServicioFecha",label:"Próximo servicio por fecha",type:"date"},{key:"proximoServicioLectura",label:"Próximo servicio por lectura",type:"number",step:"0.1"}]
    if(action==="cultivos")return [{key:"sectorId",label:"Sector / potrero",options:catalog.sectores,required:true},{key:"forrajeId",label:"Cultivo / forraje",options:catalog.forrajes,required:true},{key:"desde",label:"Fecha de siembra",type:"date",required:true},{key:"superficieHa",label:"Superficie (ha)",type:"number",step:"0.01",required:true},{key:"densidadSiembraKgHa",label:"Densidad de siembra (kg/ha)",type:"number",step:"0.01"},{key:"notas",label:"Notas de la campaña"}]
    if(action==="cierre-cultivo")return [{key:"hasta",label:"Fecha de finalización",type:"date",required:true}]
    if(action==="reservas")return [{key:"depositoId",label:"Galpón del mapa (opcional)",options:catalog.depositos??[]},{key:"nombre",label:"Nombre de la reserva",required:true},{key:"forrajeId",label:"Forraje",options:catalog.forrajes,required:true},{key:"unidad",label:"Unidad de stock",options:option(["fardos","rollos","kg"])},{key:"ubicacion",label:"Lugar de almacenamiento",required:true},{key:"minimo",label:"Stock mínimo",type:"number",step:"0.01",required:true}]
    const paso=(unidad?:string)=>unidad==="kg"?"0.01":"1"
    if(action==="cosechas"){
      const crop=selected as Crop,compatibles=(catalog.reservas??[]).filter(r=>r.forrajeId===crop.forrajeId)
      const elegida=compatibles.find(r=>r.id===draft.reservaId)
      return [{key:"cantidad",label:"Cantidad cosechada",type:"number",step:paso(elegida?.unidad??draft.unidad),required:true},{key:"fecha",label:"Fecha de cosecha",type:"date",required:true},
        {key:"reservaId",label:"Guardar en reserva existente",optional:true,options:compatibles.map(r=>({id:r.id,nombre:`${r.nombre} (${r.unidad}${r.deposito?` · ${r.deposito.nombre}`:""})`}))},
        ...(elegida?[]:[{key:"nombre",label:"…o crear reserva: nombre",required:true},{key:"unidad",label:"Unidad",options:option(["fardos","rollos","kg"]),required:true},{key:"depositoId",label:"Galpón (opcional)",optional:true,options:catalog.depositos??[]}]),
        {key:"motivo",label:"Observaciones",optional:true}]
    }
    if(action==="transferencias"){
      const r=selected as Reserve
      return [{key:"depositoDestinoId",label:"Galpón de destino",required:true,options:(catalog.depositos??[]).filter(d=>d.id!==r.depositoId)},{key:"cantidad",label:`Cantidad (${r.unidad})`,type:"number",step:paso(r.unidad),required:true},{key:"fecha",label:"Fecha",type:"date",required:true},{key:"motivo",label:"Observaciones",optional:true}]
    }
    const tipo=(draft.tipo==="salida"?"salida":"entrada") as "entrada"|"salida",consumo=tipo==="salida"&&draft.concepto==="consumo"
    return [{key:"tipo",label:"Movimiento",options:[{id:"entrada",nombre:"Entrada"},{id:"salida",nombre:"Salida"}]},
      {key:"concepto",label:"Concepto",required:true,options:CONCEPTOS_FORRAJE[tipo].map(c=>({id:c,nombre:CONCEPTO_FORRAJE_LABEL[c]}))},
      {key:"cantidad",label:"Cantidad",type:"number",step:paso(selected&&"unidad"in selected?selected.unidad:undefined),required:true},{key:"fecha",label:"Fecha",type:"date",required:true},
      ...(consumo?[{key:"sectorId",label:"Potrero o corral donde se dio",optional:true,options:catalog.sectores.filter(x=>!x.tipo||livestockTypes.has(x.tipo))},{key:"loteId",label:"Grupo alimentado",optional:true,options:catalog.lotes??[]}]:[]),
      {key:"motivo",label:tipo==="salida"&&draft.concepto==="venta"?"Comprador / detalle":"Detalle (opcional)",optional:true}]
  }
  async function save(e:FormEvent){e.preventDefault();if(!action)return;setSaving(true);setFormError("")
    try{
      const data:Record<string,unknown>={establecimientoId:campo}
      for(const f of fields()){const value=draft[f.key]??"";if((f.optional||f.key==="densidadSiembraKgHa"||f.key==="depositoId")&&!value)continue;data[f.key]=value}
      if(action==="lecturas"||action==="servicios"){const r=selected as Equipment;data.equipoId=r.activoId;data.version=r.version}
      if(action==="cierre-cultivo"){const r=selected as Crop;data.cultivoId=r.id;data.version=r.version}
      if(action==="movimientos"||action==="transferencias"){data.reservaId=(selected as Reserve).id;data.clave=draft.clave}
      if(action==="cosechas"){data.cultivoId=(selected as Crop).id;data.clave=draft.clave}
      const r=await fetch(`/api/campo/${action}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}),b=await r.json()
      if(!r.ok)throw Error(b.error)
      await Promise.all(["sector-ficha","mapa","sectores"].map(key=>queryClient.invalidateQueries({queryKey:[key]})))
      setAction(null);setRevision(v=>v+1);setNotice(action==="reservas"?"Reserva creada. Registrá una entrada para cargar el stock inicial.":action==="cosechas"?"Cosecha registrada: la reserva ya suma lo cosechado.":action==="transferencias"?"Transferencia registrada: salió de un galpón y entró en el otro.":"Registro guardado correctamente.")
    }catch(e){setFormError(e instanceof Error?e.message:"No se pudo guardar")}finally{setSaving(false)}
  }
  function switchMode(m:Mode){router.replace(m==="reservas"?"/cultivos?vista=reservas":"/cultivos",{scroll:false});setMode(m);setPage(1);setQ("");setUbicacion("");setRows([]);setAction(null);setNotice("")}
  return <div className="space-y-6">
    <PageHeading title={initialMode==="flota"?"Flota":"Cultivos y Forrajes"} icon={initialMode==="flota"?Truck:Sprout} context={nombre}
      description={initialMode==="flota"?"Vehículos y maquinaria, lecturas y mantenimiento preventivo. Cada equipo también forma parte del patrimonio.":"Planificá el uso del suelo, registrá siembras y controlá tus reservas de alfalfa, avena y otros forrajes."}
      actions={<Button disabled={!catalog.puedeEditar||saving||loading} onClick={()=>begin(mode)}><Plus/>{names[mode]}</Button>}/>
    {sectorId && <p className="erp-notice">Mostrando registros vinculados al lugar seleccionado. <Link className="underline" href={`/potreros?vista=mapa&sector=${sectorId}`}>Volver al mapa</Link> · <Link className="underline" href="/cultivos">Ver todos</Link></p>}
    {initialMode==="cultivos"&&<div className="erp-tabs" aria-label="Cultivos y reservas"><Button variant={mode==="cultivos"?"default":"ghost"} disabled={saving} onClick={()=>switchMode("cultivos")}><Sprout/>Siembras y pasturas</Button><Button variant={mode==="reservas"?"default":"ghost"} disabled={saving} onClick={()=>switchMode("reservas")}><Package/>Reservas de forraje</Button></div>}
    {notice&&<p role="status" className="erp-notice">{notice}</p>}
    {action&&<Card><CardHeader><CardTitle>{names[action]}</CardTitle><CardDescription>{selected&&("activo"in selected?selected.activo.titulo:"nombre"in selected?selected.nombre:`${selected.forraje.nombre} · ${selected.sector.nombre}`)}</CardDescription></CardHeader><CardContent><form onSubmit={save} className="space-y-5"><fieldset disabled={saving} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{fields().map(f=><label className="erp-field" key={f.key}><span>{f.label}{f.required?" *":""}</span>{f.options?<select className="erp-select" required={f.required} value={draft[f.key]??""} onChange={e=>{const value=e.target.value;setDraft(d=>({...d,[f.key]:value,...(f.key==="tipo"?{concepto:value==="salida"?"consumo":"compra"}:{})}))}}><option value="">{f.optional?"Ninguno":"Seleccionar"}</option>{f.options.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}</select>:<Input required={f.required} type={f.type??"text"} step={f.step} min={f.type==="number"?"0":undefined} maxLength={2000} value={draft[f.key]??""} onChange={e=>setDraft(d=>({...d,[f.key]:e.target.value}))}/>}</label>)}</fieldset>{formError&&<p role="alert" className="text-sm text-destructive">{formError}</p>}<div className="flex gap-2"><Button disabled={saving} type="submit">{saving?"Guardando…":"Guardar"}</Button><Button variant="outline" type="button" disabled={saving} onClick={()=>setAction(null)}>Cancelar</Button></div></form></CardContent></Card>}
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="relative w-full max-w-sm"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" aria-label="Buscar registros" placeholder={mode==="cultivos"?"Buscar alfalfa, avena…":"Buscar por nombre…"} value={q} onChange={e=>{setQ(e.target.value);setPage(1)}}/></div>{mode==="reservas"&&!sectorId&&<select className="erp-select w-auto" aria-label="Ubicación de las reservas" value={ubicacion} onChange={e=>{setUbicacion(e.target.value);setPage(1)}}><option value="">Todo el campo</option>{(catalog.depositos??[]).map(d=><option key={d.id} value={d.id}>{d.nombre}</option>)}<option value="sin-asignar">Sin galpón asignado</option></select>}<p className="text-sm text-muted-foreground">{total} registros</p></div>
    {error?<p role="alert" className="erp-error">{error} <button className="underline" onClick={()=>setRevision(v=>v+1)}>Reintentar</button></p>:loading?<p role="status">Cargando registros…</p>:!rows.length?<Card><CardContent className="py-12 text-center"><Sprout className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><p className="font-medium">{q?"No encontramos coincidencias":"Todavía no hay registros en este campo"}</p><p className="mt-2 text-sm text-muted-foreground">{catalog.puedeEditar?`Empezá con “${names[mode]}”.`:"Un propietario o encargado puede cargar los datos."}</p></CardContent></Card>:<div className="grid gap-4 xl:grid-cols-2">{rows.map(row=>{
      if("activoId"in row)return <Card key={row.activoId}><CardHeader><div className="flex flex-wrap items-start justify-between gap-2"><CardTitle>{row.activo.titulo}</CardTitle><StatusPill tone={row.estadoServicio==="vencido"?"danger":row.estadoServicio==="proximo"?"warning":row.estadoServicio==="al_dia"?"success":"neutral"}>{statusNames[row.estadoServicio]}</StatusPill></div><CardDescription>{row.marcaModelo} · {row.patente||"Sin patente"}</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-2xl font-semibold tabular-nums">{row.lectura} <span className="text-sm font-normal text-muted-foreground">{row.unidad}</span></p><div className="grid gap-2 text-sm sm:grid-cols-2"><p>Próxima fecha: <strong>{row.proximoServicioFecha?.slice(0,10)||"Sin definir"}</strong></p><p>Próxima lectura: <strong>{row.proximoServicioLectura??"Sin definir"} {row.proximoServicioLectura?row.unidad:""}</strong></p></div><details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">Últimos servicios ({row.mantenimientos.length})</summary>{row.mantenimientos.length?row.mantenimientos.map(m=><p className="mt-3 border-t pt-3" key={m.id}>{m.fecha.slice(0,10)} · {m.lectura} {row.unidad}<br/>{m.detalle}</p>):<p className="mt-2 text-muted-foreground">Sin servicios registrados.</p>}</details></CardContent><CardFooter className="flex-wrap gap-2"><Button variant="outline" disabled={!catalog.puedeEditar||saving} onClick={()=>begin("lecturas",row)}><Gauge/>Actualizar lectura</Button><Button disabled={!catalog.puedeEditar||saving} onClick={()=>begin("servicios",row)}><Wrench/>Registrar servicio</Button></CardFooter></Card>
      if("sector"in row)return <Card key={row.id}><CardHeader><div className="flex items-start justify-between gap-2"><CardTitle>{row.forraje.nombre}</CardTitle><StatusPill tone={row.hasta?"neutral":"success"}>{row.hasta?"Finalizado":"Implantado"}</StatusPill></div><CardDescription>{row.sector.nombre}</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><p className="text-2xl font-semibold">{row.superficieHa??"—"} <span className="text-sm font-normal text-muted-foreground">ha</span></p><p>Siembra: {row.desde.slice(0,10)}{row.hasta?` · Cierre: ${row.hasta.slice(0,10)}`:""}</p>{row.cosechado.length>0&&<p>Cosechado: <strong>{totales(row.cosechado)}</strong></p>}{row.notas&&<p className="text-muted-foreground">{row.notas}</p>}</CardContent><CardFooter className="flex-wrap gap-2"><Button variant="outline" disabled={!!row.hasta||!catalog.puedeEditar||saving} onClick={()=>begin("cierre-cultivo",row)}><CheckCircle2/>{row.hasta?"Cultivo cerrado":"Finalizar cultivo"}</Button><Button variant="outline" disabled={!catalog.puedeEditar||saving} onClick={()=>begin("cosechas",row)}><Package/>Registrar cosecha</Button><Button variant="ghost" asChild><Link href={"/potreros?vista=mapa&sector="+row.sectorId}>Ver parcela en el mapa</Link></Button></CardFooter></Card>
      const low=Number(row.stock)<=Number(row.minimo)
      return <Card key={row.id}><CardHeader><div className="flex items-start justify-between gap-2"><CardTitle>{row.nombre}</CardTitle><StatusPill tone={low?"warning":"success"}>{low?"Reponer reserva":"Stock disponible"}</StatusPill></div><CardDescription>{row.forraje.nombre} · {row.deposito?.nombre??row.ubicacion}{row.cultivo?` · de ${row.cultivo.sector.nombre} (${row.cultivo.desde.slice(0,4)})`:""}</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-2xl font-semibold tabular-nums">{row.stock} <span className="text-sm font-normal text-muted-foreground">{row.unidad}</span></p><p className="text-sm text-muted-foreground">Mínimo: {row.minimo} {row.unidad}. Las unidades se mantienen separadas; no se convierten fardos a kg.</p><details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">Últimos movimientos ({row.movimientos.length})</summary>{row.movimientos.map(m=><p className="mt-3 border-t pt-3" key={m.id}>{m.fecha.slice(0,10)} · {m.tipo==="entrada"?"+":"−"}{m.cantidad} {row.unidad}{m.concepto?` · ${CONCEPTO_FORRAJE_LABEL[m.concepto]}`:""}{m.cultivo?` de ${m.cultivo.sector.nombre}`:""}{m.sector?` en ${m.sector.nombre}`:""}{m.lote?` · ${m.lote.nombre}`:""}<br/>{m.motivo}</p>)}</details></CardContent><CardFooter className="flex-wrap gap-2"><Button variant="outline" disabled={!catalog.puedeEditar||saving} onClick={()=>begin("movimientos",row,"entrada")}><ArrowDownToLine/>Entrada</Button><Button disabled={!catalog.puedeEditar||saving} onClick={()=>begin("movimientos",row,"salida")}><ArrowUpFromLine/>Salida / consumo</Button>{(catalog.depositos??[]).some(d=>d.id!==row.depositoId)&&<Button variant="outline" disabled={!catalog.puedeEditar||saving||Number(row.stock)<=0} onClick={()=>begin("transferencias",row)}><Truck/>Transferir</Button>}{row.depositoId&&<Button variant="ghost" asChild><Link href={"/potreros?vista=mapa&sector="+row.depositoId}>Ver galpón en el mapa</Link></Button>}</CardFooter></Card>
    })}</div>}
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Página {page} de {Math.max(1,Math.ceil(total/25))}</p><div className="flex gap-2"><Button variant="outline" disabled={loading||page===1} onClick={()=>setPage(p=>p-1)}>Anterior</Button><Button variant="outline" disabled={loading||page*25>=total} onClick={()=>setPage(p=>p+1)}>Siguiente</Button></div></div>
  </div>
}
