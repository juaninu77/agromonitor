// End-to-end HTTP + PostgreSQL. Only a local preview on an explicitly confirmed test branch.
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { PrismaClient } from "@prisma/client"
const base=process.env.ERP_TEST_URL??"http://127.0.0.1:3101"
assert(["localhost","127.0.0.1"].includes(new URL(base).hostname))
const host=new URL(process.env.DATABASE_URL!).hostname.replace("-pooler.",".")
assert(host===process.env.ERP_TEST_DATABASE_HOST&&!host.includes("ep-fragrant-firefly"))
assert.equal(process.env.ERP_TEST_WRITES,"confirmed-test-branch")
const db=new PrismaClient()
let checks=0
const ok=(value:unknown,message:string)=>{assert(value,message);checks++}
class Client {
  cookies=new Map<string,string>()
  async request(path:string,body?:unknown,form=false){
    const r=await fetch(base+path,{method:body===undefined?"GET":"POST",redirect:"manual",headers:{Cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join("; "),...(body===undefined?{}:{"Content-Type":form?"application/x-www-form-urlencoded":"application/json"})},body:body===undefined?undefined:form?new URLSearchParams(body as Record<string,string>):JSON.stringify(body)})
    for(const cookie of r.headers.getSetCookie()){const pair=cookie.split(";")[0],i=pair.indexOf("=");this.cookies.set(pair.slice(0,i),pair.slice(i+1))}
    return r
  }
  async json(path:string,status:number,body?:unknown){const r=await this.request(path,body),data=await r.json();assert.equal(r.status,status,`${path}: ${JSON.stringify(data)}`);checks++;return data}
}
async function login(email:string){const c=new Client(),{csrfToken}=await c.json("/api/auth/csrf",200);const r=await c.request("/api/auth/callback/credentials",{email,password:"CampoDemo-2026!",csrfToken,callbackUrl:base},true);ok([200,302].includes(r.status),"Login");const session=await c.json("/api/auth/session",200);ok(session.user?.email===email,"Authenticated demo account");return c}
async function main(){
  const a=await login("demo.campo@example.invalid"),reader=await login("operario.campo@example.invalid")
  const org=await db.organizacion.findUniqueOrThrow({where:{slug:"demo-campo-integral"}})
  const field=await db.establecimiento.findFirstOrThrow({where:{organizacionId:org.id,nombre:{startsWith:"La Alameda"}}})
  const other=await db.establecimiento.findFirstOrThrow({where:{organizacionId:{not:org.id}}})
  const empty=await db.establecimiento.findFirstOrThrow({where:{organizacionId:org.id,nombre:{startsWith:"El Molino"}}})
  const endpoint=(m:string)=>`/api/campo/${m}`
  const list=(m:string,id=field.id)=>`${endpoint(m)}?establecimientoId=${id}`
  const common={establecimientoId:field.id},stamp=randomUUID().slice(0,8)
  // Compare API identity with direct test-branch data before mutations.
  const orgs=await a.json("/api/organizaciones",200);ok(orgs.some((o:{id:string})=>o.id===org.id),"Preview uses confirmed test database")
  const stats=(await a.json(`/api/dashboard/stats?establecimientoId=${empty.id}`,200)).data
  ok(stats.totalAnimales===0&&stats.totalLotes===0&&stats.pesadasRecientes===0,"Empty field does not inherit another field's dashboard")
  await a.json(`/api/dashboard/stats?establecimientoId=${other.id}`,403)
  await new Client().json(list("flota"),401)
  for(const m of ["flota","cultivos","reservas","catalogos"]){await a.json(list(m),200);await a.json(list(m,other.id),403)}
  const catalog=await a.json(list("catalogos"),200)
  const readCatalog=await reader.json(list("catalogos"),200);ok(!readCatalog.puedeEditar,"Operario is read-only in field modules")
  const fleet={...common,nombre:`Equipo ensayo ${stamp}`,tipo:"vehiculo",marcaModelo:"DEMO",unidad:"km",lectura:"80000",proximoServicioLectura:"80000"}
  await reader.json(endpoint("flota"),403,fleet)
  const equipment=(await a.json(endpoint("flota"),201,fleet)).data
  const search=await a.json(list("flota")+`&q=${stamp}`,200)
  ok(search.total===1&&search.data[0].estadoServicio==="vencido","Due meter alert and search")
  await a.json(endpoint("lecturas"),400,{...common,equipoId:equipment.activoId,version:1,lectura:"79999"})
  await a.json(endpoint("lecturas"),201,{...common,equipoId:equipment.activoId,version:1,lectura:"80100"})
  await a.json(endpoint("lecturas"),409,{...common,equipoId:equipment.activoId,version:1,lectura:"80200"})
  const service={...common,equipoId:equipment.activoId,version:2,lectura:"80100",fecha:"2026-01-01",detalle:"Aceite y filtros",costo:"1200.50",moneda:"ARS",proximoServicioLectura:"90000"}
  await a.json(endpoint("servicios"),400,{...service,fecha:"2099-01-01"})
  await a.json(endpoint("servicios"),201,service)
  const serviced=(await a.json(list("flota")+`&q=${stamp}`,200)).data[0]
  ok(serviced.estadoServicio==="al_dia"&&serviced.mantenimientos.length===1,"Service history and next interval")
  await a.json(endpoint("servicios"),409,service)
  ok(await db.mantenimientoFlota.count({where:{equipoId:equipment.activoId}})===1,"Stale service rolls back history")
  const sector=await db.sector.findFirstOrThrow({where:{establecimientoId:field.id,nombre:"Potrero Norte"}})
  const cropPayload={...common,sectorId:sector.id,forrajeId:catalog.forrajes[0].id,desde:"2026-01-01",superficieHa:5}
  await a.json(endpoint("cultivos"),400,{...cropPayload,superficieHa:500})
  const crop=(await a.json(endpoint("cultivos"),201,cropPayload)).data
  await a.json(endpoint("cierre-cultivo"),400,{...common,cultivoId:crop.id,version:1,hasta:"2025-12-31"})
  await a.json(endpoint("cierre-cultivo"),201,{...common,cultivoId:crop.id,version:1,hasta:"2026-02-01"})
  await a.json(endpoint("cierre-cultivo"),409,{...common,cultivoId:crop.id,version:1,hasta:"2026-02-01"})
  const reserve=(await a.json(endpoint("reservas"),201,{...common,forrajeId:cropPayload.forrajeId,cultivoId:crop.id,nombre:`Fardos ensayo ${stamp}`,unidad:"fardos",ubicacion:"Galpón DEMO",minimo:"5"})).data
  const movement={...common,reservaId:reserve.id,clave:randomUUID(),tipo:"entrada",cantidad:"10",fecha:"2026-01-01",motivo:"Producción de ensayo"}
  await a.json(endpoint("movimientos"),201,movement)
  await a.json(endpoint("movimientos"),201,movement)
  ok((await db.reservaForraje.findUniqueOrThrow({where:{id:reserve.id}})).stock.equals(10),"Retry does not duplicate stock")
  await a.json(endpoint("movimientos"),409,{...movement,cantidad:"11"})
  await a.json(endpoint("movimientos"),400,{...movement,clave:randomUUID(),cantidad:"0.5"})
  await a.json(endpoint("movimientos"),409,{...movement,clave:randomUUID(),tipo:"salida",cantidad:"11"})
  const results=await Promise.all([1,2].map(()=>a.request(endpoint("movimientos"),{...movement,clave:randomUUID(),tipo:"salida",cantidad:"7",motivo:"Consumo simultáneo de prueba"})))
  ok(results.map(r=>r.status).sort().join(",")==="201,409","Concurrent consumption cannot oversell")
  const balance=await db.reservaForraje.findUniqueOrThrow({where:{id:reserve.id},include:{movimientos:true}})
  ok(balance.stock.equals(3)&&balance.movimientos.length===2,"Ledger and balance agree after rejection and concurrency")
  await assert.rejects(db.reservaForraje.update({where:{id:reserve.id},data:{stock:-1}}));checks++
  // Register an animal with full lot/location context, then search and inspect preparation.
  const example=await db.animal.findFirstOrThrow({where:{establecimientoId:field.id,caravanaVisual:"DEMO-001"},include:{loteHist:{where:{hasta:null}},ubicacionHist:{where:{hasta:null}}}})
  const tag=`CAMPO-${stamp}`
  const animal=(await a.json("/api/ganado/bovinos",201,{...common,especieId:example.especieId,razaId:example.razaId,categoriaId:example.categoriaId,sexo:"F",caravanaVisual:tag,caravanaRfid:`TEST-${randomUUID()}`,loteId:example.loteHist[0].loteId,sectorId:example.ubicacionHist[0].sectorId,pesoInicial:350})).data
  const found=await a.json(`/api/ganado/bovinos?establecimientoId=${field.id}&busqueda=${tag}`,200)
  ok(found.data.length===1&&found.data[0].lote==="Vacas de cría"&&found.data[0].ubicacion==="Potrero Norte","New animal searchable with current lot and sector")
  ok(found.data[0].marketValue===null&&found.data[0].healthStatus==="Sin evaluación sanitaria","No invented health or valuation")
  const ficha=(await a.json(`/api/ganado/${animal.id}/preparacion`,200)).data
  ok(ficha.faltantes===0&&ficha.peso===350&&ficha.aviso.includes("No verifica"),"Complete internal checklist is not official authorization")
  const liveStats=(await a.json(`/api/dashboard/stats?establecimientoId=${field.id}`,200)).data
  ok(liveStats.animalesPesadosMes<=liveStats.totalAnimales,"Coverage counts distinct active animals, never events / animals")
  const incomplete=await db.animal.findFirstOrThrow({where:{establecimientoId:field.id,caravanaVisual:"DEMO-012"}})
  ok((await a.json(`/api/ganado/${incomplete.id}/preparacion`,200)).data.faltantes===3,"Missing RFID, lot and location reported")
  const outside=await db.animal.findFirstOrThrow({where:{establecimientoId:other.id}})
  await a.json(`/api/ganado/${outside.id}/preparacion`,404)
  await a.json("/api/auth/forgot-password",503,{email:"demo.campo@example.invalid"})
  for(const path of ["/flota","/cultivos",`/ganado/${animal.id}`,"/administracion"]){ok((await a.request(path)).status===200,`Page ${path}`)}
  console.log(`${checks} comprobaciones integrales de campo aprobadas: flota, cultivos, forrajes, concurrencia, permisos, alta y ficha de ganado.`)
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1}).finally(()=>db.$disconnect())
