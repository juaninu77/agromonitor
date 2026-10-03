// Servicio de alta de animales: validación compartida entre el alta individual
// (POST /api/ganado/bovinos) y la alta masiva / importación
// (POST /api/ganado/bovinos/lote). Toda la lógica de negocio vive acá para que
// las dos vías den exactamente los mismos resultados.

import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { scopeCatalogo } from "@/lib/api/tenant"
import {
  animalAltaSchema,
  filaAltaMasivaSchema,
  type AnimalAlta,
  type FilaAltaMasiva,
} from "@/lib/validations/animal-schema"

// ============================================================
// Tipos
// ============================================================

export interface ResultadoFila {
  /** Número de fila informado por el cliente (o posición 1-based). */
  fila: number
  ok: boolean
  errores: string[]
  /** Identificación legible para mostrar en la vista previa. */
  identificacion: string
  animalId?: string
}

export interface AltaPreparada {
  fila: number
  identificacion: string
  animal: Prisma.AnimalCreateManyInput
  pesada?: Prisma.EvtPesadaCreateManyInput
  loteHist?: Prisma.AnimalLoteHistCreateManyInput
  ubicacionHist?: Prisma.UbicacionHistCreateManyInput
}

export interface ContextoAlta {
  establecimientoId: string
  /** Organizaciones cuyo catálogo puede usar el establecimiento (normalmente una). */
  organizacionIds: string[]
}

interface Catalogos {
  especies: { id: string; nombre: string }[]
  razas: { id: string; nombre: string; especieId: string }[]
  categorias: { id: string; nombre: string; especieId: string; sexo: string | null }[]
  lotes: { id: string; nombre: string; especieId: string; activo: boolean }[]
  sectores: { id: string; nombre: string; tipo: string }[]
}

// ============================================================
// Helpers puros (testeables sin base de datos)
// ============================================================

const norm = (s: string) => s.trim().toLowerCase()

/** Busca en un catálogo por id exacto o por nombre (sin distinguir mayúsculas ni espacios). */
export function resolverCatalogo<T extends { id: string; nombre: string }>(
  items: T[],
  idOrNombre: string | undefined,
  nombre: string | undefined,
): T | undefined {
  if (idOrNombre) {
    const porId = items.find((i) => i.id === idOrNombre)
    if (porId) return porId
  }
  const buscado = nombre ?? idOrNombre
  if (!buscado) return undefined
  return items.find((i) => norm(i.nombre) === norm(buscado))
}

/** Mensajes de error de zod aplanados a "campo: mensaje". */
export function erroresZod(error: z.ZodError): string[] {
  return error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
}

/**
 * Detecta identificadores repetidos dentro de la misma tanda. Devuelve, por
 * índice de fila, la lista de mensajes de duplicado.
 */
export function duplicadosEnLote(
  filas: Array<Pick<AnimalAlta, "caravanaVisual" | "caravanaRfid" | "cuig">>,
): Map<number, string[]> {
  const vistos: Record<"caravanaVisual" | "caravanaRfid" | "cuig", Map<string, number>> = {
    caravanaVisual: new Map(),
    caravanaRfid: new Map(),
    cuig: new Map(),
  }
  const etiquetas = { caravanaVisual: "caravana visual", caravanaRfid: "RFID", cuig: "CUIG" } as const
  const resultado = new Map<number, string[]>()
  filas.forEach((fila, idx) => {
    for (const campo of ["caravanaVisual", "caravanaRfid", "cuig"] as const) {
      const valor = fila[campo]
      if (!valor) continue
      const clave = norm(valor)
      const primera = vistos[campo].get(clave)
      if (primera === undefined) {
        vistos[campo].set(clave, idx)
      } else {
        const msg = `${etiquetas[campo]} "${valor}" repetida en la fila ${primera + 1}`
        resultado.set(idx, [...(resultado.get(idx) ?? []), msg])
      }
    }
  })
  return resultado
}

/** Texto corto para identificar la fila en mensajes y vistas previas. */
export function identificacionDe(fila: Partial<Pick<AnimalAlta, "caravanaVisual" | "caravanaRfid" | "cuig" | "otroId">>): string {
  return fila.caravanaVisual ?? fila.caravanaRfid ?? fila.cuig ?? fila.otroId ?? "(sin identificación)"
}

/**
 * Traduce errores conocidos de Prisma a una respuesta HTTP. Para los índices
 * únicos no revela a qué establecimiento pertenece el otro animal.
 */
export function mapearErrorPrisma(error: unknown): { status: number; error: string } | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | string | undefined) ?? []
      const campos = Array.isArray(target) ? target.join(",") : String(target)
      if (campos.includes("caravana_rfid")) return { status: 409, error: "Ya existe un animal registrado con ese RFID" }
      if (campos.includes("cuig")) return { status: 409, error: "Ya existe un animal registrado con ese CUIG" }
      if (campos.includes("caravana_visual")) return { status: 409, error: "Ya existe un animal con esa caravana en este campo" }
      return { status: 409, error: "Ya existe un registro con esos datos" }
    }
    if (error.code === "P2003") return { status: 400, error: "Alguno de los datos referenciados no existe" }
    if (error.code === "P2025") return { status: 404, error: "Registro no encontrado" }
  }
  return null
}

// ============================================================
// Carga de catálogos del tenant
// ============================================================

async function cargarCatalogos(ctx: ContextoAlta): Promise<Catalogos> {
  const scope = scopeCatalogo(ctx.organizacionIds)
  const [especies, razas, categorias, lotes, sectores] = await Promise.all([
    prisma.especie.findMany({ where: scope, select: { id: true, nombre: true } }),
    prisma.raza.findMany({ where: scope, select: { id: true, nombre: true, especieId: true } }),
    prisma.categoria.findMany({ where: scope, select: { id: true, nombre: true, especieId: true, sexo: true } }),
    prisma.lote.findMany({
      where: { establecimientoId: ctx.establecimientoId },
      select: { id: true, nombre: true, especieId: true, activo: true },
    }),
    prisma.sector.findMany({
      where: { establecimientoId: ctx.establecimientoId, activo: true },
      select: { id: true, nombre: true, tipo: true },
    }),
  ])
  return { especies, razas, categorias, lotes, sectores }
}

// ============================================================
// Preparación (validación completa sin escribir)
// ============================================================

/**
 * Valida una tanda de filas contra el esquema, el catálogo del tenant y la base
 * (duplicados). No escribe nada. Devuelve el resultado por fila y las altas listas
 * para ejecutar en una transacción.
 */
export async function prepararAltas(
  filasCrudas: unknown[],
  ctx: ContextoAlta,
): Promise<{ resultados: ResultadoFila[]; preparadas: AltaPreparada[] }> {
  const catalogos = await cargarCatalogos(ctx)
  const ahora = new Date()

  // 1. Esquema por fila
  const parseadas: Array<{ fila: number; data?: FilaAltaMasiva; errores: string[] }> = filasCrudas.map((cruda, idx) => {
    const r = filaAltaMasivaSchema.safeParse(cruda)
    const fila = (cruda as { fila?: number } | null)?.fila ?? idx + 1
    if (!r.success) return { fila, errores: erroresZod(r.error) }
    return { fila: r.data.fila ?? fila, data: r.data, errores: [] }
  })

  // 2. Al menos una identificación (misma regla que el alta individual)
  for (const p of parseadas) {
    if (!p.data) continue
    const r = animalAltaSchema.safeParse({ ...p.data, sexo: p.data.sexo })
    if (!r.success) p.errores.push(...erroresZod(r.error))
  }

  // 3. Duplicados dentro de la tanda
  const dups = duplicadosEnLote(parseadas.map((p) => p.data ?? {}))
  dups.forEach((msgs, idx) => parseadas[idx].errores.push(...msgs))

  // 4. Duplicados contra la base (una sola consulta por campo)
  const caravanas = parseadas.map((p) => p.data?.caravanaVisual).filter((v): v is string => !!v)
  const rfids = parseadas.map((p) => p.data?.caravanaRfid).filter((v): v is string => !!v)
  const cuigs = parseadas.map((p) => p.data?.cuig).filter((v): v is string => !!v)
  const [existentesCaravana, existentesRfid, existentesCuig] = await Promise.all([
    caravanas.length
      ? prisma.animal.findMany({
          where: { establecimientoId: ctx.establecimientoId, caravanaVisual: { in: caravanas } },
          select: { caravanaVisual: true, estadoVital: true },
        })
      : [],
    rfids.length ? prisma.animal.findMany({ where: { caravanaRfid: { in: rfids } }, select: { caravanaRfid: true } }) : [],
    cuigs.length ? prisma.animal.findMany({ where: { cuig: { in: cuigs } }, select: { cuig: true } }) : [],
  ])
  const setCaravana = new Map(existentesCaravana.map((a) => [a.caravanaVisual as string, a.estadoVital]))
  const setRfid = new Set(existentesRfid.map((a) => a.caravanaRfid))
  const setCuig = new Set(existentesCuig.map((a) => a.cuig))

  // 5. Catálogos, coherencia y armado
  const preparadas: AltaPreparada[] = []
  const resultados: ResultadoFila[] = parseadas.map((p) => {
    const errores = [...p.errores]
    const d = p.data
    const identificacion = identificacionDe(d ?? {})
    if (!d) return { fila: p.fila, ok: false, errores, identificacion }

    if (d.caravanaVisual && setCaravana.has(d.caravanaVisual)) {
      const estado = setCaravana.get(d.caravanaVisual)
      errores.push(
        estado === "activo"
          ? `Ya existe un animal activo con la caravana ${d.caravanaVisual} en este campo`
          : `La caravana ${d.caravanaVisual} pertenece a un animal dado de baja (${estado}); reactivalo o usá otra`,
      )
    }
    if (d.caravanaRfid && setRfid.has(d.caravanaRfid)) errores.push(`El RFID ${d.caravanaRfid} ya está registrado`)
    if (d.cuig && setCuig.has(d.cuig)) errores.push(`El CUIG ${d.cuig} ya está registrado`)

    // Especie: id, nombre, o la única del catálogo
    let especie = resolverCatalogo(catalogos.especies, d.especieId, d.especie)
    if (!especie && !d.especieId && !d.especie) {
      especie = catalogos.especies.find((e) => norm(e.nombre) === "bovino") ?? (catalogos.especies.length === 1 ? catalogos.especies[0] : undefined)
    }
    if (!especie) errores.push(d.especie || d.especieId ? `Especie "${d.especie ?? d.especieId}" no encontrada en el catálogo` : "Indicá la especie")

    const raza = especie ? resolverCatalogo(catalogos.razas.filter((r) => r.especieId === especie!.id), d.razaId, d.raza) : undefined
    if (especie && !raza) {
      errores.push(d.raza || d.razaId ? `Raza "${d.raza ?? d.razaId}" no encontrada para ${especie.nombre}` : "Indicá la raza")
    }

    const categoria = especie ? resolverCatalogo(catalogos.categorias.filter((c) => c.especieId === especie!.id), d.categoriaId, d.categoria) : undefined
    if (especie && !categoria) {
      errores.push(d.categoria || d.categoriaId ? `Categoría "${d.categoria ?? d.categoriaId}" no encontrada para ${especie.nombre}` : "Indicá la categoría")
    } else if (categoria?.sexo && categoria.sexo !== d.sexo) {
      errores.push(`La categoría "${categoria.nombre}" es de sexo ${categoria.sexo === "M" ? "macho" : "hembra"} y el animal es ${d.sexo === "M" ? "macho" : "hembra"}`)
    }

    const lote = d.loteId || d.lote ? resolverCatalogo(catalogos.lotes, d.loteId, d.lote) : undefined
    if ((d.loteId || d.lote) && !lote) errores.push(`Lote "${d.lote ?? d.loteId}" no encontrado en este campo`)
    if (lote && !lote.activo) errores.push(`El lote "${lote.nombre}" está inactivo`)
    if (lote && especie && lote.especieId !== especie.id) errores.push(`El lote "${lote.nombre}" es de otra especie`)

    const sector = d.sectorId || d.potrero ? resolverCatalogo(catalogos.sectores, d.sectorId, d.potrero) : undefined
    if ((d.sectorId || d.potrero) && !sector) errores.push(`Potrero/sector "${d.potrero ?? d.sectorId}" no encontrado en este campo`)

    if (errores.length) return { fila: p.fila, ok: false, errores, identificacion }

    const animalId = crypto.randomUUID()
    const fechaIngreso = d.fechaIngreso ?? ahora
    preparadas.push({
      fila: p.fila,
      identificacion,
      animal: {
        id: animalId,
        especieId: especie!.id,
        razaId: raza!.id,
        categoriaId: categoria!.id,
        establecimientoId: ctx.establecimientoId,
        sexo: d.sexo,
        cuig: d.cuig ?? null,
        caravanaVisual: d.caravanaVisual ?? null,
        caravanaRfid: d.caravanaRfid ?? null,
        otroId: d.otroId ?? null,
        fechaNacimiento: d.fechaNacimiento ?? null,
        origen: d.origen,
        proveedorId: d.proveedorId ?? null,
        colorManto: d.colorManto ?? null,
        estadoCastracion: d.estadoCastracion ?? null,
        denticion: d.denticion ?? null,
        esCabana: d.esCabana,
        registroCabana: d.registroCabana ?? null,
        notas: d.notas ?? null,
      },
      pesada: d.pesoInicial !== undefined ? { animalId, fecha: fechaIngreso, pesoKg: d.pesoInicial, cc: d.ccInicial ?? null } : undefined,
      loteHist: lote ? { animalId, loteId: lote.id, desde: fechaIngreso } : undefined,
      ubicacionHist: sector ? { animalId, sectorId: sector.id, desde: fechaIngreso } : undefined,
    })
    return { fila: p.fila, ok: true, errores: [], identificacion, animalId }
  })

  return { resultados, preparadas }
}

// ============================================================
// Ejecución (todo o nada)
// ============================================================

/** Inserta las altas preparadas con `createMany` por tabla dentro de una transacción. */
export async function ejecutarAltas(preparadas: AltaPreparada[]): Promise<void> {
  if (preparadas.length === 0) return
  await prisma.$transaction(
    async (tx) => {
      await tx.animal.createMany({ data: preparadas.map((p) => p.animal) })
      const pesadas = preparadas.flatMap((p) => (p.pesada ? [p.pesada] : []))
      if (pesadas.length) await tx.evtPesada.createMany({ data: pesadas })
      const lotes = preparadas.flatMap((p) => (p.loteHist ? [p.loteHist] : []))
      if (lotes.length) await tx.animalLoteHist.createMany({ data: lotes })
      const ubicaciones = preparadas.flatMap((p) => (p.ubicacionHist ? [p.ubicacionHist] : []))
      if (ubicaciones.length) await tx.ubicacionHist.createMany({ data: ubicaciones })
    },
    { timeout: 30_000, maxWait: 10_000 },
  )
}
