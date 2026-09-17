import { describe, it, expect } from "vitest"
import { estadoServicio, checklistAnimal, servicioSchema, movimientoSchema, cultivoSchema } from "@/lib/campo/rules"

const id="7c4bb2af-2185-42d4-89cc-e5f759808ccc"
describe("Mantenimiento preventivo",()=>{
  it.each([
    [{lectura:80000,unidad:"km",proximoServicioLectura:80000},"vencido"],
    [{lectura:79000,unidad:"km",proximoServicioFecha:"2026-09-17"},"vencido"],
    [{lectura:79500,unidad:"km",proximoServicioLectura:80000},"proximo"],
    [{lectura:1230,unidad:"horas",proximoServicioLectura:1250},"proximo"],
    [{lectura:1200,unidad:"horas",proximoServicioLectura:1250},"al_dia"],
    [{lectura:100,unidad:"km",proximoServicioFecha:"2026-10-17"},"proximo"],
    [{lectura:100,unidad:"km",proximoServicioFecha:"2026-10-18"},"al_dia"],
    [{lectura:100,unidad:"km"},"sin_plan"],
  ])("resuelve el umbral de fecha o medidor: %j",(equipo,expected)=>expect(estadoServicio(equipo,"2026-09-17")).toBe(expected))
  const service={establecimientoId:id,equipoId:id,version:1,fecha:"2026-01-01",lectura:"100",detalle:"Cambio de filtros",moneda:"ARS"}
  it("rechaza un próximo servicio anterior al realizado",()=>expect(servicioSchema.safeParse({...service,proximoServicioFecha:"2025-12-31"}).success).toBe(false))
  it("rechaza un intervalo de medidor ya cumplido",()=>expect(servicioSchema.safeParse({...service,proximoServicioLectura:"100"}).success).toBe(false))
  it("rechaza registrar servicios futuros como realizados",()=>expect(servicioSchema.safeParse({...service,fecha:"2099-01-01"}).success).toBe(false))
})
describe("Forrajes y preparación de información",()=>{
  const move={establecimientoId:id,reservaId:id,clave:id,tipo:"salida",fecha:"2026-01-01",motivo:"Alimentar recría"}
  it.each(["0","-1","1.001","NaN","1e6"])("rechaza movimiento %s",cantidad=>expect(movimientoSchema.safeParse({...move,cantidad}).success).toBe(false))
  it("conserva kg decimales sin redondear",()=>expect(movimientoSchema.parse({...move,cantidad:"12.25"}).cantidad).toBe("12.25"))
  it("rechaza siembras sin superficie positiva",()=>expect(cultivoSchema.safeParse({establecimientoId:id,sectorId:id,forrajeId:id,desde:"2026-01-01",superficieHa:0}).success).toBe(false))
  it("no confunde ausencia de datos con aptitud sanitaria",()=>{
    const checks=checklistAnimal({caravanaVisual:"DEMO",caravanaRfid:null,estadoVital:"vendido",establecimiento:{renspa:null},loteHist:[],ubicacionHist:[]})
    expect(checks.filter(c=>!c.ok)).toHaveLength(6)
    expect(checks.some(c=>/apto|saludable/i.test(c.label))).toBe(false)
  })
})
