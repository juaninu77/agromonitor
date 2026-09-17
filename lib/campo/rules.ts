import { z } from "zod"
import { fechaSchema, importeSchema } from "@/lib/administracion/validation"

export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
const uuid = z.string().uuid()
const text = z.string().trim().min(1).max(180)
const optionalDate = z.union([fechaSchema, z.literal("")]).nullish().transform(v => v || null)
const nonNegative = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Usá un número positivo con hasta dos decimales")
const reading = z.string().regex(/^\d{1,10}(\.\d)?$/, "Usá kilómetros u horas, hasta un decimal")
const optionalReading = z.union([reading,z.literal("")]).nullish().transform(v => v || null)
const base = { establecimientoId: uuid }
export const equipoSchema = z.object({ ...base, nombre:text, tipo:z.enum(["vehiculo","maquinaria"]), marcaModelo:text,
  patente:z.string().trim().max(25).default(""), unidad:z.enum(["km","horas"]), lectura:reading,
  proximoServicioFecha:optionalDate, proximoServicioLectura:optionalReading }).strict()
export const lecturaSchema = z.object({ ...base, equipoId:uuid, version:z.number().int().positive(), lectura:reading }).strict()
export const servicioSchema = z.object({ ...base, equipoId:uuid, version:z.number().int().positive(), fecha:fechaSchema,
  lectura:reading, detalle:z.string().trim().min(1).max(2000), costo:z.union([importeSchema,z.literal("")]).nullish().transform(v=>v||null), moneda:z.enum(["ARS","USD"]),
  proximoServicioFecha:optionalDate, proximoServicioLectura:optionalReading }).strict()
  .refine(v=>v.fecha<=today(),{message:"Un servicio realizado no puede tener fecha futura",path:["fecha"]})
  .refine(v=>!v.proximoServicioFecha||v.proximoServicioFecha>v.fecha,{message:"El próximo servicio debe ser posterior",path:["proximoServicioFecha"]})
  .refine(v=>!v.proximoServicioLectura||Number(v.proximoServicioLectura)>Number(v.lectura),{message:"La próxima lectura debe superar a la actual",path:["proximoServicioLectura"]})
export const cultivoSchema = z.object({ ...base, sectorId:uuid, forrajeId:uuid, desde:fechaSchema,
  superficieHa:z.coerce.number().positive().max(1000000), densidadSiembraKgHa:z.coerce.number().positive().max(10000).optional(), notas:z.string().trim().max(2000).default("") }).strict()
export const cierreCultivoSchema = z.object({ ...base, cultivoId:uuid, version:z.number().int().positive(), hasta:fechaSchema }).strict()
export const reservaSchema = z.object({ ...base, forrajeId:uuid, cultivoId:z.union([uuid,z.literal("")]).nullish().transform(v=>v||null), nombre:text,
  unidad:z.enum(["fardos","rollos","kg"]), ubicacion:text, minimo:nonNegative }).strict()
export const movimientoSchema = z.object({ ...base, reservaId:uuid, clave:uuid, tipo:z.enum(["entrada","salida"]), cantidad:nonNegative.refine(v=>Number(v)>0,"La cantidad debe ser mayor a cero"),
  fecha:fechaSchema, motivo:z.string().trim().min(1).max(2000) }).strict().refine(v=>v.fecha<=today(),{message:"Un movimiento realizado no puede tener fecha futura",path:["fecha"]})

export function estadoServicio(e: { lectura: string | number; unidad:string; proximoServicioFecha?:string|null; proximoServicioLectura?:string|number|null }, fecha=today()) {
  const limite = e.proximoServicioLectura == null ? null : Number(e.proximoServicioLectura)
  const dueDate=e.proximoServicioFecha?.slice(0,10)
  if ((dueDate&&dueDate<=fecha)||(limite!==null&&Number(e.lectura)>=limite)) return "vencido"
  const days=dueDate?(Date.parse(dueDate)-Date.parse(fecha))/86400000:Infinity
  if (days<=30 || (limite!==null&&limite-Number(e.lectura)<=(e.unidad==="horas"?20:500))) return "proximo"
  return dueDate||limite!==null?"al_dia":"sin_plan"
}

export function checklistAnimal(a: { caravanaVisual:string|null; caravanaRfid:string|null; estadoVital:string; establecimiento?:{renspa:string|null}|null; categoria?:unknown; raza?:unknown; loteHist:unknown[]; ubicacionHist:unknown[] }) {
  return [
    {label:"Identificación visual registrada",ok:!!a.caravanaVisual},
    {label:"Identificación electrónica registrada (verificar aplicabilidad y registro oficial)",ok:!!a.caravanaRfid},
    {label:"RENSPA del campo registrado (verificar vigencia en SIGSA)",ok:!!a.establecimiento?.renspa},
    {label:"Categoría registrada",ok:!!a.categoria},
    {label:"Animal activo en el ERP",ok:a.estadoVital==="activo"},
    {label:"Lote actual registrado",ok:a.loteHist.length>0},
    {label:"Ubicación actual registrada",ok:a.ubicacionHist.length>0},
  ]
}
