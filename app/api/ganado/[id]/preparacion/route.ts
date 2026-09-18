import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { checklistAnimal } from "@/lib/campo/rules"

export const GET=withAuth(async(_request,ctx)=>{
  const id=z.string().uuid().safeParse(ctx.params.id)
  if(!id.success)return NextResponse.json({error:"Identificador inválido"},{status:400})
  const animal=await prisma.animal.findFirst({where:{id:id.data,establecimientoId:{in:ctx.establecimientoIds}},include:{
    establecimiento:{select:{nombre:true,renspa:true}},especie:{select:{nombre:true}},categoria:{select:{nombre:true}},raza:{select:{nombre:true}},
    loteHist:{where:{hasta:null},include:{lote:{select:{nombre:true}}}},
    ubicacionHist:{where:{hasta:null},include:{sector:{select:{nombre:true}}}},
    eventosPesada:{orderBy:[{fecha:"desc"},{createdAt:"desc"},{id:"desc"}],take:1},
    eventosSanidad:{orderBy:{fecha:"desc"},take:5,include:{producto:{select:{nombre:true}}}},
  }})
  if(!animal)return NextResponse.json({error:"Animal no encontrado"},{status:404})
  const checks=checklistAnimal(animal)
  return NextResponse.json({data:{identificacion:{visual:animal.caravanaVisual,rfid:animal.caravanaRfid},estado:animal.estadoVital,
    establecimiento:animal.establecimiento,lote:animal.loteHist[0]?.lote.nombre??null,ubicacion:animal.ubicacionHist[0]?.sector.nombre??null,
    peso:animal.eventosPesada[0]?.pesoKg??null,sanidad:animal.eventosSanidad.map(e=>({fecha:e.fecha,producto:e.producto.nombre,motivo:e.motivo})),
    checks,faltantes:checks.filter(c=>!c.ok).length,
    aviso:"Esta ficha comprueba datos cargados en el ERP. No verifica vigencia del RENSPA, dispositivos oficiales, restricciones sanitarias ni habilita movimientos. El DT-e se gestiona en SENASA/SIGSA y depende también del destino y del movimiento.",
    fuente:"https://www.argentina.gob.ar/node/102531",
  }},{headers:{"Cache-Control":"private, no-store"}})
})
