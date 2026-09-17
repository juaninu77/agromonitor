import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAuth, type AuthContext } from "@/lib/api/with-auth"
import * as rules from "./rules"

class InputError extends Error { constructor(message:string,public status=400){super(message)} }
const iso=(v:string|null|undefined)=>v?new Date(`${v}T00:00:00Z`):null
const modules=z.enum(["flota","lecturas","servicios","cultivos","cierre-cultivo","reservas","movimientos","catalogos"])
function campo(ctx:AuthContext,id:string,write=false){
  const ids=write?ctx.establecimientoIdsConRol(["admin","encargado"]):ctx.establecimientoIds
  if(!ids.includes(id))throw new InputError("No tenés permisos para este campo",403)
  return id
}
async function audit(tx:Prisma.TransactionClient,ctx:AuthContext,campoId:string,id:string,tabla:string,accion="INSERT"){
  await tx.auditLog.create({data:{usuarioId:ctx.userId,organizacionId:ctx.organizacionDeEstablecimiento[campoId],tabla,rowPk:id,accion}})
}
export const GET = withAuth(async(request,ctx)=>handle(async()=>{
  const modulo=modules.parse(ctx.params.modulo), id=campo(ctx,z.string().uuid().parse(request.nextUrl.searchParams.get("establecimientoId")))
  const page=z.coerce.number().int().min(1).max(100000).parse(request.nextUrl.searchParams.get("page")??1)
  const q=(request.nextUrl.searchParams.get("q")??"").slice(0,180)
  const pagination={take:25,skip:(page-1)*25}
  if(modulo==="catalogos")return NextResponse.json({
    forrajes:await prisma.forraje.findMany({orderBy:{nombre:"asc"},select:{id:true,nombre:true}}),
    sectores:await prisma.sector.findMany({where:{establecimientoId:id,activo:true},orderBy:{nombre:"asc"},select:{id:true,nombre:true,superficieHa:true}}),
    puedeEditar:ctx.establecimientoIdsConRol(["admin","encargado"]).includes(id),
  })
  if(modulo==="flota"){
    const where={activo:{establecimientoId:id,...(q?{titulo:{contains:q,mode:"insensitive" as const}}:{})}}
    const [rows,total]=await Promise.all([prisma.equipoFlota.findMany({where,include:{activo:true,mantenimientos:{orderBy:{fecha:"desc"},take:10}},...pagination,orderBy:{activo:{titulo:"asc"}}}),prisma.equipoFlota.count({where})])
    return NextResponse.json({data:rows.map(e=>({...e,estadoServicio:rules.estadoServicio({lectura:e.lectura.toString(),unidad:e.unidad,proximoServicioFecha:e.proximoServicioFecha?.toISOString(),proximoServicioLectura:e.proximoServicioLectura?.toString()})})),total,page})
  }
  if(modulo==="cultivos"){
    const where={sector:{establecimientoId:id},...(q?{forraje:{nombre:{contains:q,mode:"insensitive" as const}}}:{})}
    const [data,total]=await Promise.all([prisma.sectorForraje.findMany({where,include:{sector:{select:{nombre:true}},forraje:{select:{nombre:true}}},...pagination,orderBy:{desde:"desc"}}),prisma.sectorForraje.count({where})])
    return NextResponse.json({data,total,page})
  }
  if(modulo==="reservas"){
    const where={establecimientoId:id,...(q?{nombre:{contains:q,mode:"insensitive" as const}}:{})}
    const [data,total]=await Promise.all([prisma.reservaForraje.findMany({where,include:{forraje:{select:{nombre:true}},movimientos:{take:10,orderBy:{createdAt:"desc"}}},...pagination,orderBy:{nombre:"asc"}}),prisma.reservaForraje.count({where})])
    return NextResponse.json({data,total,page})
  }
  throw new InputError("Ruta no encontrada",404)
}))

export const POST=withAuth(async(request,ctx)=>handle(async()=>{
  const origin=request.headers.get("origin")
  if(origin){
    let host:string
    try{host=new URL(origin).host}catch{throw new InputError("Origen no permitido",403)}
    if(host!==request.headers.get("host"))throw new InputError("Origen no permitido",403)
  }
  const raw=await readBody(request)
  const id=campo(ctx,z.string().uuid().parse(raw.establecimientoId),true),modulo=modules.parse(ctx.params.modulo)
  const result=await prisma.$transaction(async tx=>{
    if(modulo==="flota"){
      const v=rules.equipoSchema.parse(raw)
      const asset=await tx.activoPatrimonial.create({data:{establecimientoId:id,titulo:v.nombre,tipo:v.tipo}})
      const row=await tx.equipoFlota.create({data:{activoId:asset.id,marcaModelo:v.marcaModelo,patente:v.patente||null,unidad:v.unidad,lectura:v.lectura,proximoServicioFecha:iso(v.proximoServicioFecha),proximoServicioLectura:v.proximoServicioLectura}})
      await audit(tx,ctx,id,row.activoId,"equipos_flota");return row
    }
    if(modulo==="lecturas"||modulo==="servicios"){
      const v=modulo==="lecturas"?rules.lecturaSchema.parse(raw):rules.servicioSchema.parse(raw)
      const equipo=await tx.equipoFlota.findFirst({where:{activoId:v.equipoId,activo:{establecimientoId:id,estado:"activo"}}})
      if(!equipo)throw new InputError("Equipo no encontrado o fuera de servicio",404)
      if(new Prisma.Decimal(v.lectura).lessThan(equipo.lectura))throw new InputError("La lectura no puede retroceder")
      const data=modulo==="servicios"?rules.servicioSchema.parse(raw):null
      const row=await tx.equipoFlota.update({where:{activoId:v.equipoId,version:v.version},data:{lectura:v.lectura,version:{increment:1},...(data?{proximoServicioFecha:iso(data.proximoServicioFecha),proximoServicioLectura:data.proximoServicioLectura}:{})}})
      if(data)await tx.mantenimientoFlota.create({data:{equipoId:v.equipoId,fecha:iso(data.fecha)!,lectura:data.lectura,detalle:data.detalle,costo:data.costo,moneda:data.moneda}})
      await audit(tx,ctx,id,row.activoId,modulo==="servicios"?"mantenimientos_flota":"lecturas_flota",modulo==="servicios"?"INSERT":"UPDATE");return row
    }
    if(modulo==="cultivos"){
      const v=rules.cultivoSchema.parse(raw)
      const sector=await tx.sector.findFirst({where:{id:v.sectorId,establecimientoId:id,activo:true}})
      if(!sector)throw new InputError("Sector no encontrado en este campo",404)
      if(sector.superficieHa&&v.superficieHa>sector.superficieHa)throw new InputError("La superficie supera la del sector")
      if(!await tx.forraje.findUnique({where:{id:v.forrajeId}}))throw new InputError("Forraje no encontrado",404)
      const row=await tx.sectorForraje.create({data:{sectorId:v.sectorId,forrajeId:v.forrajeId,desde:iso(v.desde)!,superficieHa:v.superficieHa,densidadSiembraKgHa:v.densidadSiembraKgHa,notas:v.notas}})
      await audit(tx,ctx,id,row.id,"sector_forrajes");return row
    }
    if(modulo==="cierre-cultivo"){
      const v=rules.cierreCultivoSchema.parse(raw)
      const cultivo=await tx.sectorForraje.findFirst({where:{id:v.cultivoId,sector:{establecimientoId:id}}})
      if(!cultivo)throw new InputError("Cultivo no encontrado",404)
      if(cultivo.hasta)throw new InputError("El cultivo ya está cerrado",409)
      if(iso(v.hasta)!<cultivo.desde)throw new InputError("El cierre no puede ser anterior a la siembra")
      const row=await tx.sectorForraje.update({where:{id:v.cultivoId,version:v.version},data:{hasta:iso(v.hasta),estado:"finalizado",version:{increment:1}}})
      await audit(tx,ctx,id,row.id,"sector_forrajes","UPDATE");return row
    }
    if(modulo==="reservas"){
      const v=rules.reservaSchema.parse(raw)
      if(!await tx.forraje.findUnique({where:{id:v.forrajeId}}))throw new InputError("Forraje no encontrado",404)
      if(v.cultivoId&&!await tx.sectorForraje.findFirst({where:{id:v.cultivoId,forrajeId:v.forrajeId,sector:{establecimientoId:id}}}))throw new InputError("Cultivo de origen incompatible con el campo o forraje")
      const row=await tx.reservaForraje.create({data:v});await audit(tx,ctx,id,row.id,"reservas_forraje");return row
    }
    if(modulo==="movimientos"){
      const v=rules.movimientoSchema.parse(raw)
      const reserva=await tx.reservaForraje.findFirst({where:{id:v.reservaId,establecimientoId:id}})
      if(!reserva)throw new InputError("Reserva no encontrada",404)
      if(reserva.unidad!=="kg"&&!new Prisma.Decimal(v.cantidad).isInteger())throw new InputError("Fardos y rollos se registran en unidades enteras")
      const prior=await tx.movimientoForraje.findUnique({where:{clave:v.clave}})
      if(prior){
        if(prior.reservaId!==v.reservaId||prior.tipo!==v.tipo||!prior.cantidad.equals(v.cantidad)||prior.fecha.toISOString().slice(0,10)!==v.fecha||prior.motivo!==v.motivo)throw new InputError("La clave de operación ya fue utilizada con otros datos",409)
        return prior
      }
      const changed=await tx.reservaForraje.updateMany({where:{id:v.reservaId,establecimientoId:id,...(v.tipo==="salida"?{stock:{gte:v.cantidad}}:{})},data:{stock:v.tipo==="entrada"?{increment:v.cantidad}:{decrement:v.cantidad}}})
      if(!changed.count)throw new InputError("Stock insuficiente: no se registró la salida",409)
      const row=await tx.movimientoForraje.create({data:{reservaId:v.reservaId,clave:v.clave,tipo:v.tipo,cantidad:v.cantidad,fecha:iso(v.fecha)!,motivo:v.motivo}})
      await audit(tx,ctx,id,row.id,"movimientos_forraje");return row
    }
    throw new InputError("Operación no encontrada",404)
  },{timeout:15000})
  return NextResponse.json({data:result},{status:201})
}))

async function readBody(request:NextRequest):Promise<Record<string,unknown>>{
  const reader=request.body?.getReader();if(!reader)throw new InputError("Solicitud vacía")
  const chunks:Uint8Array[]=[];let n=0
  while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>20000){await reader.cancel();throw new InputError("Solicitud demasiado grande",413)}chunks.push(value)}
  const raw=JSON.parse(Buffer.concat(chunks).toString("utf8"));if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new InputError("Datos inválidos");return raw
}
async function handle(fn:()=>Promise<Response>){try{return await fn()}catch(e){
  if(e instanceof InputError)return NextResponse.json({error:e.message},{status:e.status})
  if(e instanceof z.ZodError)return NextResponse.json({error:e.issues.map(i=>i.message).join("; ")},{status:400})
  if(e instanceof SyntaxError)return NextResponse.json({error:"Datos inválidos"},{status:400})
  if(e instanceof Prisma.PrismaClientKnownRequestError&&["P2025","P2002"].includes(e.code))return NextResponse.json({error:"El registro cambió o la operación ya se registró. Recargá y revisá el historial."},{status:409})
  console.error("Operación de campo fallida",e instanceof Error?e.name:"unknown")
  return NextResponse.json({error:"No se pudo completar la operación"},{status:500})
}}

