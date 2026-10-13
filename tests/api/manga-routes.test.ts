import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), lock: vi.fn(), session: vi.fn(), update: vi.fn(),
  animal: vi.fn(), animals: vi.fn(), createAnimal: vi.fn(), especie: vi.fn(), aggregate: vi.fn(),
  item: vi.fn(), createMany: vi.fn(), lastItem: vi.fn(), pesada: vi.fn(), sanidad: vi.fn(), tacto: vi.fn(),
  producto: vi.fn(), descontar: vi.fn(), preparar: vi.fn(), insertar: vi.fn(), lote: vi.fn(), categoria: vi.fn(),
  especieCampo: vi.fn(), audit: vi.fn(), lotesProducto: vi.fn(), idemPrevia: vi.fn(), idemTx: vi.fn(), idemCrear: vi.fn(),
}))
vi.mock("@/lib/ganado/alta", () => ({ prepararAltas: mocks.preparar, insertarAltas: mocks.insertar, especieDelCampo: mocks.especieCampo }))
vi.mock("@/lib/api/with-auth", () => ({ withAuth: (handler: Function) => (request: unknown) => handler(request, {
  params: { id: "00000000-0000-4000-8000-000000000001" }, establecimientoIds: ["est1", "est2"], userId: "u1",
  organizacionDeEstablecimiento: { est1: "org1" },
}) }))
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction, operacionIdempotente: { findUnique: mocks.idemPrevia } } }))
vi.mock("@/lib/api/audit-log", () => ({ logAudit: vi.fn() }))
vi.mock("@/lib/inventario/aplicaciones", async () => ({ consumoSugerido: (await import("@/lib/inventario/consumo")).consumoSugerido, descontarAplicacion: mocks.descontar, revertirAplicaciones: vi.fn() }))
import { POST as addItemRoute } from "@/app/api/manga/[id]/items/route"
import { POST as finalizeRoute } from "@/app/api/manga/[id]/finalizar/route"
import { POST as importCSVRoute } from "@/app/api/manga/importar-csv/route"
import { PATCH as patchRoute } from "@/app/api/manga/[id]/route"
const context = { params: Promise.resolve({}) }
const addItem = (request: NextRequest) => addItemRoute(request, context)
const finalize = (request: NextRequest) => finalizeRoute(request, context)
const importCSV = (request: NextRequest) => importCSVRoute(request, context)
const PATCH = (request: NextRequest) => patchRoute(request, context)

const id = "00000000-0000-4000-8000-000000000001"
const tx = {
  sesionManga: { updateMany: mocks.lock, findFirst: mocks.session, update: mocks.update },
  animal: { findFirst: mocks.animal, findMany: mocks.animals, create: mocks.createAnimal }, especie: { findFirst: mocks.especie },
  sesionMangaItem: { aggregate: mocks.aggregate, create: mocks.item, createMany: mocks.createMany, findFirst: mocks.lastItem },
  evtPesada: { create: mocks.pesada }, evtSanidad: { createMany: mocks.sanidad }, evtTacto: { create: mocks.tacto },
  producto: { findUnique: mocks.producto }, lote: { findFirst: mocks.lote }, categoria: { findUnique: mocks.categoria },
  auditLog: { create: mocks.audit }, loteProducto: { findMany: mocks.lotesProducto },
  operacionIdempotente: { findUnique: mocks.idemTx, create: mocks.idemCrear },
}
/** Animales activos del campo (finalizar solo trata a estos) */
const activos = (...ids: string[]) => mocks.animals.mockResolvedValue(ids.map((id) => ({ id })))
function request(body: object = {}) {
  return new NextRequest("http://localhost/api/manga/test", { method: "POST", body: JSON.stringify(body) })
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  mocks.transaction.mockImplementation((callback) => callback(tx))
  mocks.lock.mockResolvedValue({ count: 1 })
  mocks.session.mockResolvedValue({ id, estado: "activa", establecimientoId: "est1", fecha: new Date(), items: [] })
  mocks.aggregate.mockResolvedValue({ _max: { orden: 3 } })
  mocks.especie.mockResolvedValue({ id: "bovino" })
  mocks.createAnimal.mockResolvedValue({ id: "new-animal" })
  mocks.item.mockResolvedValue({ id: "item" })
  mocks.animals.mockResolvedValue([])
  mocks.preparar.mockResolvedValue({ resultados: [{ fila: 1, ok: true, errores: [] }], preparadas: [{ animal: { id: "new-animal" } }] })
  mocks.categoria.mockResolvedValue({ nombre: "Vaquillona" })
  mocks.especieCampo.mockResolvedValue(null)
  mocks.lotesProducto.mockResolvedValue([])
})
const RAZA = "00000000-0000-4000-8000-000000000011", CAT = "00000000-0000-4000-8000-000000000012", ESP = "00000000-0000-4000-8000-000000000013"
const alta = { esNuevoRegistro: true, sexo: "F", razaId: RAZA, categoriaId: CAT }
afterEach(() => vi.restoreAllMocks())

describe("rutas de manga", () => {
  it("busca animales exclusivamente en el establecimiento de la sesión", async () => {
    mocks.animal.mockResolvedValue(null)
    expect((await addItem(request({ eidLeido: "123", animalId: id }))).status).toBe(404)
    expect(mocks.animal).toHaveBeenCalledWith({ where: { id, establecimientoId: "est1" } })
    expect(mocks.item).not.toHaveBeenCalled()
  })
  it("crea animal, lectura y contador en la misma transacción", async () => {
    expect((await addItem(request({ eidLeido: "123", ...alta }))).status).toBe(201)
    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(mocks.insertar).toHaveBeenCalledWith(tx, [{ animal: { id: "new-animal" } }])
    expect(mocks.item).toHaveBeenCalledWith({ data: expect.objectContaining({ animalId: "new-animal", orden: 4, categoria: "Vaquillona" }) })
    expect(mocks.update).toHaveBeenCalledWith({ where: { id }, data: { totalAnimales: { increment: 1 } } })
  })
  it("propaga el fallo de lectura fuera del callback para revertir el alta", async () => {
    mocks.item.mockRejectedValue(new Error("insert failed"))
    let rolledBack = false
    mocks.transaction.mockImplementation(async (callback) => {
      try { return await callback(tx) } catch (error) { rolledBack = true; throw error }
    })
    expect((await addItem(request({ eidLeido: "123", ...alta }))).status).toBe(500)
    expect(rolledBack).toBe(true)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it("requiere sexo, raza y categoría para altas nuevas, con mensajes claros", async () => {
    const r1 = await addItem(request({ eidLeido: "123", esNuevoRegistro: true, razaId: RAZA, categoriaId: CAT }))
    expect(r1.status).toBe(400)
    expect((await r1.json()).error).toMatch(/elegí el sexo/)
    const r2 = await addItem(request({ eidLeido: "123", esNuevoRegistro: true, sexo: "M" }))
    expect((await r2.json()).error).toMatch(/raza y la categoría/)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it("el alta usa el catálogo, el EID leído y el lote de origen de la misma especie", async () => {
    mocks.session.mockResolvedValue({ id, estado: "activa", establecimientoId: "est1", fecha: new Date("2026-10-10"), tipo: "recepcion", loteOrigenId: "L1", items: [] })
    mocks.lote.mockResolvedValue({ id: "L1", especieId: ESP })
    await addItem(request({ eidLeido: "982 000123456789", caravanaVisual: "A-1", ...alta, especieId: ESP }))
    expect(mocks.preparar).toHaveBeenCalledWith([expect.objectContaining({
      sexo: "F", razaId: RAZA, categoriaId: CAT, especieId: ESP, caravanaVisual: "A-1", caravanaRfid: "982000123456789", loteId: "L1", origen: "compra",
    })], { establecimientoId: "est1", organizacionIds: ["org1"] })
    // Un error del catálogo o un RFID repetido vuelve con su mensaje y no guarda nada
    mocks.preparar.mockResolvedValue({ resultados: [{ fila: 1, ok: false, errores: ["El RFID 982000123456789 ya está registrado"] }], preparadas: [] })
    const r = await addItem(request({ eidLeido: "982000123456789", ...alta }))
    expect(r.status).toBe(400)
    expect((await r.json()).error).toMatch(/ya está registrado/)
    expect(mocks.insertar).toHaveBeenCalledOnce()
  })
  it("sin especie elegida, el alta toma la del lote de origen y, si no hay lote, la del campo", async () => {
    mocks.session.mockResolvedValue({ id, estado: "activa", establecimientoId: "est1", fecha: new Date("2026-10-10"), tipo: "señalada", loteOrigenId: "L1", items: [] })
    mocks.lote.mockResolvedValue({ id: "L1", especieId: "ovino" })
    await addItem(request({ eidLeido: "982000123456789", ...alta }))
    expect(mocks.preparar.mock.calls[0][0][0]).toMatchObject({ especieId: "ovino", loteId: "L1", origen: "cria_propia" })
    expect(mocks.especieCampo).not.toHaveBeenCalled()

    mocks.session.mockResolvedValue({ id, estado: "activa", establecimientoId: "est1", fecha: new Date("2026-10-10"), tipo: "general", loteOrigenId: null, items: [] })
    mocks.especieCampo.mockResolvedValue("caprino")
    await addItem(request({ eidLeido: "982000123456780", ...alta }))
    expect(mocks.especieCampo).toHaveBeenCalledWith(tx, "est1")
    expect(mocks.preparar.mock.calls[1][0][0]).toMatchObject({ especieId: "caprino", loteId: undefined })
  })
  it("con otra especie elegida, el animal nuevo no entra al lote de origen", async () => {
    mocks.session.mockResolvedValue({ id, estado: "activa", establecimientoId: "est1", fecha: new Date("2026-10-10"), tipo: "general", loteOrigenId: "L1", items: [] })
    mocks.lote.mockResolvedValue({ id: "L1", especieId: "ovino" })
    await addItem(request({ eidLeido: "982000123456789", ...alta, especieId: ESP }))
    expect(mocks.preparar.mock.calls[0][0][0]).toMatchObject({ especieId: ESP, loteId: undefined })
  })
  it("sin sexo el alta falla con un mensaje claro y no guarda nada", async () => {
    const r = await addItem(request({ eidLeido: "123", esNuevoRegistro: true }))
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBe("Para registrar el animal nuevo elegí el sexo, la raza y la categoría")
    expect(mocks.preparar).not.toHaveBeenCalled()
  })
  it("una lectura sin alta no exige sexo ni catálogo", async () => {
    expect((await addItem(request({ eidLeido: "982000123456789", pesoKg: 300, cc: 7 }))).status).toBe(201)
    expect(mocks.preparar).not.toHaveBeenCalled()
    expect(mocks.item).toHaveBeenCalledWith({ data: expect.objectContaining({ animalId: null, cc: 7, esNuevoRegistro: false }) })
  })
  it("la condición corporal usa la escala 1 a 9 de Ganado", async () => {
    expect((await addItem(request({ eidLeido: "123", cc: 10 }))).status).toBe(400)
    expect((await addItem(request({ eidLeido: "123", cc: 0 }))).status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it("una lectura repetida desde la cola sin conexión no se registra dos veces", async () => {
    const CLAVE = "00000000-0000-4000-8000-0000000000c1"
    // Primer envío: se registra y guarda la clave en la misma transacción
    expect((await addItem(request({ eidLeido: "123", pesoKg: 300, clave: CLAVE }))).status).toBe(201)
    expect(mocks.idemCrear).toHaveBeenCalledWith({ data: expect.objectContaining({ clave: CLAVE, usuarioId: "u1", ruta: "/api/manga/items" }) })
    // Reenvío (la respuesta anterior se perdió): devuelve lo mismo sin tocar la sesión, aunque esté finalizada
    vi.clearAllMocks()
    mocks.idemPrevia.mockResolvedValue({ clave: CLAVE, usuarioId: "u1", ruta: "/api/manga/items", resultado: { id: "item" } })
    const r = await addItem(request({ eidLeido: "123", pesoKg: 300, clave: CLAVE, ...alta }))
    expect(r.status).toBe(201)
    expect(await r.json()).toMatchObject({ data: { id: "item" }, repetida: true })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.insertar).not.toHaveBeenCalled()
  })
  it("una clave usada por otro usuario o en otra operación se rechaza", async () => {
    mocks.idemPrevia.mockResolvedValue({ clave: "x", usuarioId: "otro", ruta: "/api/manga/items", resultado: {} })
    expect((await addItem(request({ eidLeido: "123", clave: "00000000-0000-4000-8000-0000000000c2" }))).status).toBe(409)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it("una lectura sin animal elegido se vincula con el animal activo del campo que tiene ese EID", async () => {
    mocks.animal.mockResolvedValue({ id: "animal-eid", sexo: "F" })
    expect((await addItem(request({ eidLeido: "982 000123456789", pesoKg: 300, resultadoTacto: "preñada" }))).status).toBe(201)
    expect(mocks.animal).toHaveBeenCalledWith({ where: { caravanaRfid: "982000123456789", establecimientoId: "est1", estadoVital: "activo" }, select: { id: true, sexo: true } })
    expect(mocks.item).toHaveBeenCalledWith({ data: expect.objectContaining({ animalId: "animal-eid", esNuevoRegistro: false }) })
    // Un macho con tacto se rechaza con el motivo (queda para revisar en el dispositivo)
    mocks.animal.mockResolvedValue({ id: "toro", sexo: "M" })
    const r = await addItem(request({ eidLeido: "982000123456789", resultadoTacto: "vacia" }))
    expect(r.status).toBe(400)
    expect((await r.json()).error).toMatch(/hembra/)
  })
  it("genera eventos al finalizar", async () => {
    activos("animal")
    mocks.session.mockResolvedValue({ id, estado: "activa", establecimientoId: "est1", fecha: new Date(), productoSanidadId: "producto", items: [
      { animalId: "animal", pesoKg: 320, accionSanidad: true, resultadoTacto: "preñada" },
    ] })
    const response = await finalize(request())
    expect(response.status).toBe(200)
    expect((await response.json()).data).toMatchObject({ totalPesados: 1, totalSanidad: 1, totalTactos: 1 })
    expect(mocks.pesada).toHaveBeenCalledOnce()
    expect(mocks.sanidad).toHaveBeenCalledOnce()
    expect(mocks.tacto).toHaveBeenCalledOnce()
  })
  it("el tratamiento lleva los datos de la sesión y se agrupa por la sesión (anular uno anula todos)", async () => {
    mocks.session.mockResolvedValue({ id, nombre: "Vacunación terneros", estado: "activa", establecimientoId: "est1", fecha: new Date(), productoSanidadId: "producto", dosisSanidad: 2, unidadSanidad: "ml", viaSanidad: "subcutanea", motivoSanidad: "preventivo", carenciaSanidad: 21, items: [
      { animalId: "a1", accionSanidad: true }, { animalId: "a2", accionSanidad: false },
    ] })
    activos("a1")
    mocks.producto.mockResolvedValue({ unidad: "ml", activo: true, nombre: "Clostridial", organizacionId: "org1" })
    mocks.descontar.mockResolvedValue({ descontado: 2, faltante: 0, unidad: "ml", ubicacion: null, lotes: [] })
    await finalize(request())
    expect(mocks.sanidad).toHaveBeenCalledOnce()
    const eventos = mocks.sanidad.mock.calls[0][0].data
    expect(eventos).toHaveLength(1)
    expect(eventos[0]).toMatchObject({ animalId: "a1", productoId: "producto", dosis: 2, unidad: "ml", via: "subcutanea", motivo: "preventivo", carenciaDias: 21, operacionId: id, observ: "Manga: Vacunación terneros" })
    expect(mocks.descontar.mock.calls[0][1]).toMatchObject({ cantidad: 2, origenTipo: "manga", origenId: id })
    // Auditoría en la misma transacción
    expect(mocks.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ tabla: "evt_sanidad", rowPk: id, organizacionId: "org1" }) })
  })
  it("un animal leído dos veces recibe un tratamiento; uno dado de baja no recibe ninguno", async () => {
    mocks.session.mockResolvedValue({ id, nombre: "Antiparasitario", estado: "activa", establecimientoId: "est1", fecha: new Date(), productoSanidadId: "producto", dosisSanidad: 5, unidadSanidad: "ml", items: [
      { animalId: "a1", accionSanidad: true }, { animalId: "a1", accionSanidad: true }, { animalId: "baja", accionSanidad: true },
    ] })
    activos("a1")
    mocks.producto.mockResolvedValue({ unidad: "ml", activo: true, nombre: "Ivermectina", organizacionId: "org1" })
    mocks.descontar.mockResolvedValue({ descontado: 5, faltante: 0, unidad: "ml", ubicacion: null, lotes: [] })
    const response = await finalize(request())
    expect(mocks.animals).toHaveBeenCalledWith({ where: { id: { in: ["a1", "baja"] }, establecimientoId: "est1", estadoVital: "activo" }, select: { id: true } })
    expect(mocks.sanidad.mock.calls[0][0].data.map((e: { animalId: string }) => e.animalId)).toEqual(["a1"])
    expect(mocks.descontar.mock.calls[0][1]).toMatchObject({ cantidad: 5 })
    expect((await response.json()).data).toMatchObject({ totalSanidad: 1, sanidadOmitidos: 1 })
  })
  it("el costo de lo descontado se reparte entre los animales tratados", async () => {
    mocks.session.mockResolvedValue({ id, nombre: "Vacunación", estado: "activa", establecimientoId: "est1", fecha: new Date(), productoSanidadId: "producto", dosisSanidad: 2, unidadSanidad: "ml", items: [
      { animalId: "a1", accionSanidad: true }, { animalId: "a2", accionSanidad: true },
    ] })
    activos("a1", "a2")
    mocks.producto.mockResolvedValue({ unidad: "ml", activo: true, nombre: "Aftosa", organizacionId: "org1", costoReferencia: null, monedaCosto: "ARS" })
    mocks.descontar.mockResolvedValue({ descontado: 4, faltante: 0, unidad: "ml", ubicacion: null, lotes: [{ loteProductoId: "LP1", cantidad: 4 }] })
    const { Prisma } = await import("@prisma/client")
    mocks.lotesProducto.mockResolvedValue([{ id: "LP1", costo: new Prisma.Decimal(150), moneda: "ARS" }])
    await finalize(request())
    expect(mocks.sanidad.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ animalId: "a1", costo: 300, loteProductoId: "LP1" }),
      expect.objectContaining({ animalId: "a2", costo: 300, loteProductoId: "LP1" }),
    ])
  })
  it("sin animales marcados no registra sanidad ni toca el stock", async () => {
    mocks.session.mockResolvedValue({ id, estado: "activa", establecimientoId: "est1", fecha: new Date(), productoSanidadId: "producto", dosisSanidad: 2, items: [{ animalId: "a1", accionSanidad: false, pesoKg: 200 }] })
    const response = await finalize(request())
    expect(mocks.sanidad).not.toHaveBeenCalled()
    expect(mocks.descontar).not.toHaveBeenCalled()
    expect((await response.json()).data).toMatchObject({ totalPesados: 1, totalSanidad: 0 })
  })
  it("descuenta del stock lo aplicado sin trabar el cierre si falta", async () => {
    mocks.session.mockResolvedValue({ id, estado: "activa", establecimientoId: "est1", fecha: new Date(), productoSanidadId: "producto", dosisSanidad: 5, items: [
      { animalId: "a1", accionSanidad: true }, { animalId: "a2", accionSanidad: true },
    ] })
    activos("a1", "a2")
    mocks.producto.mockResolvedValue({ unidad: "ml", activo: true, nombre: "Ivermectina", organizacionId: "org1" })
    mocks.descontar.mockResolvedValue({ descontado: 6, faltante: 4, unidad: "ml", ubicacion: null, lotes: [{ loteProductoId: null, cantidad: 6 }] })
    const response = await finalize(request())
    expect(response.status).toBe(200)
    expect(mocks.descontar).toHaveBeenCalledWith(tx, expect.objectContaining({ productoId: "producto", cantidad: 10, origenTipo: "manga", origenId: id }), expect.objectContaining({ estricto: false, establecimientoId: "est1" }))
    expect((await response.json()).data).toMatchObject({ stock: { descontado: 6, faltante: 4 }, avisoStock: expect.stringContaining("Faltó stock") })
    // Con faltante no se calcula el costo (quedaría subvaluado)
    expect(mocks.sanidad.mock.calls[0][0].data[0].costo).toBeNull()
  })
  it("un producto del catálogo general no descuenta stock y avisa", async () => {
    mocks.session.mockResolvedValue({ id, estado: "activa", establecimientoId: "est1", fecha: new Date(), productoSanidadId: "producto", dosisSanidad: 5, items: [{ animalId: "a1", accionSanidad: true }] })
    activos("a1")
    mocks.producto.mockResolvedValue({ unidad: "ml", activo: true, nombre: "Global", organizacionId: null })
    const response = await finalize(request())
    expect(mocks.descontar).not.toHaveBeenCalled()
    expect((await response.json()).data.avisoStock).toMatch(/No se descontó/)
  })
  it("un segundo cierre no genera eventos", async () => {
    mocks.lock.mockResolvedValue({ count: 0 })
    expect((await finalize(request())).status).toBe(409)
    expect(mocks.pesada).not.toHaveBeenCalled()
  })
  it("PATCH no permite saltear la generación de eventos", async () => {
    expect((await PATCH(request({ estado: "finalizada" }))).status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it("PATCH no reabre una sesión finalizada", async () => {
    mocks.lock.mockResolvedValue({ count: 0 })
    expect((await PATCH(request({ estado: "activa" }))).status).toBe(409)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it("importa CSV y actualiza el contador en una sola transacción", async () => {
    mocks.lastItem.mockResolvedValue({ orden: 5 })
    mocks.createMany.mockResolvedValue({ count: 2 })
    mocks.animals.mockResolvedValue([{ id: "animal-known", caravanaRfid: "123" }])
    const response = await importCSV(request({ sessionId: id, items: [{ eidLeido: "123" }, { eidLeido: "456" }] }))
    expect(await response.json()).toEqual({ imported: 2 })
    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(mocks.createMany.mock.calls[0][0].data.map((item: { orden: number }) => item.orden)).toEqual([6, 7])
    expect(mocks.createMany.mock.calls[0][0].data.map((item: { animalId: string | null }) => item.animalId)).toEqual(["animal-known", null])
    expect(mocks.animals).toHaveBeenCalledWith({
      where: { establecimientoId: "est1", caravanaRfid: { in: ["123", "456"] } },
      select: { id: true, caravanaRfid: true },
    })
    expect(mocks.update).toHaveBeenCalledWith({ where: { id }, data: { totalAnimales: { increment: 2 } } })
  })
  it("rechaza fechas CSV inválidas", async () => {
    expect((await importCSV(request({ sessionId: id, items: [{ eidLeido: "123", timestampLectura: "invalid" }] }))).status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
