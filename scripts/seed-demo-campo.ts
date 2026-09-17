import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"
import { randomUUID } from "node:crypto"

const db=new PrismaClient()
const actual=new URL(process.env.DATABASE_URL??"").hostname.replace("-pooler.",".")
assert(actual===process.env.ERP_TEST_DATABASE_HOST&&process.env.ERP_TEST_WRITES==="confirmed-test-branch","Confirmar host y rama de ensayo")
assert(!actual.includes("ep-fragrant-firefly"),"No se permite sembrar datos ficticios en main")
const day=(offset:number)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+offset);return new Date(d.toISOString().slice(0,10)+"T00:00:00Z")}

async function seed(){
  if(await db.organizacion.findUnique({where:{slug:"demo-campo-integral"}})){console.log("El escenario DEMO ya existe; se conservaron los cambios hechos durante las pruebas.");return}
  const passwordHash=await hash("CampoDemo-2026!",12)
  await db.$transaction(async tx=>{
    const org=await tx.organizacion.create({data:{nombre:"Campo de demostración",slug:"demo-campo-integral"}})
    const user=await tx.usuario.create({data:{email:"demo.campo@example.invalid",nombre:"Demo",apellido:"Campo",passwordHash,rol:"operario"}})
    const reader=await tx.usuario.create({data:{email:"operario.campo@example.invalid",nombre:"Operario",apellido:"Demo",passwordHash,rol:"operario"}})
    await tx.membresia.createMany({data:[{usuarioId:user.id,organizacionId:org.id,rol:"propietario"},{usuarioId:reader.id,organizacionId:org.id,rol:"operario"}]})
    const field=await tx.establecimiento.create({data:{nombre:"La Alameda · DEMO",organizacionId:org.id,hectareas:320,provincia:"Buenos Aires",localidad:"Escenario ficticio",renspa:"DEMO-NO-VALIDO-01"}})
    await tx.establecimiento.create({data:{nombre:"El Molino · DEMO",organizacionId:org.id,hectareas:140,provincia:"Buenos Aires",localidad:"Escenario ficticio"}})
    const north=await tx.sector.create({data:{establecimientoId:field.id,nombre:"Potrero Norte",tipo:"potrero",superficieHa:40,tieneAgua:true}})
    const south=await tx.sector.create({data:{establecimientoId:field.id,nombre:"Potrero Sur",tipo:"potrero",superficieHa:35,tieneAgua:true}})
    const corral=await tx.sector.create({data:{establecimientoId:field.id,nombre:"Corral de manejo",tipo:"corral",capacidad:60,tieneBalanza:true}})
    const bovine=await tx.especie.create({data:{nombre:"bovino",organizacionId:org.id}})
    const ovine=await tx.especie.create({data:{nombre:"ovino",organizacionId:org.id}})
    const angus=await tx.raza.create({data:{nombre:"Angus",especieId:bovine.id,organizacionId:org.id}})
    const merino=await tx.raza.create({data:{nombre:"Merino",especieId:ovine.id,organizacionId:org.id}})
    const vaca=await tx.categoria.create({data:{nombre:"vaca",sexo:"F",especieId:bovine.id,organizacionId:org.id}})
    const ternera=await tx.categoria.create({data:{nombre:"ternera",sexo:"F",especieId:bovine.id,organizacionId:org.id}})
    const oveja=await tx.categoria.create({data:{nombre:"oveja",sexo:"F",especieId:ovine.id,organizacionId:org.id}})
    const cría=await tx.lote.create({data:{nombre:"Vacas de cría",tipo:"reproductivo",especieId:bovine.id,establecimientoId:field.id}})
    const recria=await tx.lote.create({data:{nombre:"Recría primavera",tipo:"recria",especieId:bovine.id,establecimientoId:field.id}})
    const ovinos=await tx.lote.create({data:{nombre:"Majada ovina",tipo:"reproductivo",especieId:ovine.id,establecimientoId:field.id}})
    const product=await tx.producto.create({data:{nombre:"Vacuna de ejemplo · NO REAL",tipo:"vacuna",organizacionId:org.id,retiroDias:0}})
    for(let i=1;i<=18;i++){
      const sheep=i>12,young=i>8&&!sheep
      const animal=await tx.animal.create({data:{establecimientoId:field.id,especieId:sheep?ovine.id:bovine.id,razaId:sheep?merino.id:angus.id,categoriaId:sheep?oveja.id:young?ternera.id:vaca.id,sexo:"F",caravanaVisual:`DEMO-${String(i).padStart(3,"0")}`,caravanaRfid:i===12?null:`00000000000${String(i).padStart(4,"0")}`,fechaNacimiento:day(sheep?-600:young?-240:-1100),estadoVital:i===18?"vendido":"activo",notas:"Animal ficticio. No utilizar identificación ni datos sanitarios para trámites reales."}})
      if(i!==12&&i!==18){
        await tx.animalLoteHist.create({data:{animalId:animal.id,loteId:sheep?ovinos.id:young?recria.id:cría.id,desde:day(-60)}})
        await tx.ubicacionHist.create({data:{animalId:animal.id,sectorId:sheep?south.id:young?corral.id:north.id,desde:day(-60)}})
      }
      const peso=sheep?45+i:young?210+i*3:400+i*5
      await tx.evtPesada.createMany({data:[{animalId:animal.id,fecha:day(-45),pesoKg:peso-15,cc:5},{animalId:animal.id,fecha:day(-3),pesoKg:peso,cc:5,gdpKg:15/42}]})
      if(i<9)await tx.evtSanidad.create({data:{animalId:animal.id,productoId:product.id,fecha:day(-20),motivo:"Simulación de registro sanitario",dosis:2,unidad:"ml",observ:"Datos ficticios, sin valor sanitario"}})
    }
    const alfalfa=await tx.forraje.upsert({where:{nombre:"Alfalfa"},create:{nombre:"Alfalfa",tipo:"perenne",clase:"pastura"},update:{}})
    const avena=await tx.forraje.upsert({where:{nombre:"Avena"},create:{nombre:"Avena",tipo:"anual",clase:"verdeo"},update:{}})
    const crop=await tx.sectorForraje.create({data:{sectorId:north.id,forrajeId:alfalfa.id,desde:day(-180),superficieHa:25,densidadSiembraKgHa:18,notas:"Campaña ficticia de alfalfa"}})
    await tx.sectorForraje.create({data:{sectorId:south.id,forrajeId:avena.id,desde:day(-90),superficieHa:30,densidadSiembraKgHa:80,notas:"Verdeo de invierno de ejemplo"}})
    for(const [nombre,unidad,forrajeId,stock,minimo] of [["Fardos de alfalfa","fardos",alfalfa.id,240,50],["Rollos de avena","rollos",avena.id,8,10]] as const){
      const r=await tx.reservaForraje.create({data:{establecimientoId:field.id,nombre,unidad,forrajeId,stock,minimo,ubicacion:"Galpón principal · DEMO",cultivoId:forrajeId===alfalfa.id?crop.id:null}})
      await tx.movimientoForraje.create({data:{reservaId:r.id,clave:randomUUID(),tipo:"entrada",cantidad:stock,fecha:day(-2),motivo:"Stock inicial ficticio para ensayo"}})
    }
    for(const [nombre,tipo,marcaModelo,unidad,lectura,next,days] of [["Camioneta de recorridas","vehiculo","Toyota Hilux DEMO","km",80500,80000,-7],["Tractor de siembra","maquinaria","John Deere DEMO","horas",1240,1250,15],["Acoplado de apoyo","vehiculo","Equipo DEMO","km",12000,20000,120]] as const){
      const asset=await tx.activoPatrimonial.create({data:{establecimientoId:field.id,titulo:nombre,tipo,importe:"100000",moneda:"ARS",notas:"Patrimonio ficticio"}})
      await tx.equipoFlota.create({data:{activoId:asset.id,marcaModelo,patente:tipo==="vehiculo"?"DEMO":"S/P",unidad,lectura,proximoServicioLectura:next,proximoServicioFecha:day(days)}})
      await tx.mantenimientoFlota.create({data:{equipoId:asset.id,fecha:day(-100),lectura:lectura-100,detalle:"Servicio anterior de ejemplo",costo:"1000",moneda:"ARS"}})
    }
    await tx.comprobante.create({data:{establecimientoId:field.id,titulo:"Compra de semillas · DEMO",tipo:"factura",referencia:"DEMO-0001",contraparte:"Proveedor ficticio",fecha:day(-10),vencimiento:day(5),importe:"250000",sentido:"egreso"}})
    await tx.tramite.create({data:{establecimientoId:field.id,titulo:"Revisar documentación de movimiento · DEMO",tipo:"dte",referencia:"SIN VALIDEZ OFICIAL",fecha:day(-2),vencimiento:day(5),estado:"pendiente",notas:"Consultar ficha del animal, destino y requisitos vigentes en SENASA."}})
    await tx.tarea.create({data:{establecimientoId:field.id,titulo:"Realizar servicio de la camioneta · DEMO",descripcion:"Ejemplo de tarea prioritaria",prioridad:"alta",estado:"pendiente",tipo:"mantenimiento",fechaLimite:day(-1)}})
  },{timeout:60000})
  console.log("Escenario DEMO creado: 2 campos, 18 animales, 3 lotes, 3 equipos, 2 cultivos, 2 reservas, comprobante y trámite. Usuario: demo.campo@example.invalid")
}
seed().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1}).finally(()=>db.$disconnect())

