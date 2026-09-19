import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { PrismaClient } from "@prisma/client"
const base = process.env.ERP_TEST_URL ?? "http://127.0.0.1:3101"
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname))
const host = new URL(process.env.DATABASE_URL!).hostname.replace("-pooler.", ".")
assert.equal(host, process.env.ERP_TEST_DATABASE_HOST)
assert(!host.includes("ep-fragrant-firefly"))
assert.equal(process.env.ERP_TEST_WRITES, "confirmed-test-branch")
const db = new PrismaClient(); let checks = 0
function ok(condition: unknown, message: string) { assert(condition, message); checks++ }
class Client {
  cookies = new Map<string, string>()
  async request(path: string, method = "GET", body?: unknown, form = false) {
    const response = await fetch(base + path, { method, redirect: "manual", headers: {
      Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      ...(body === undefined || body instanceof FormData ? {} : { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" }),
    }, body: body === undefined ? undefined : body instanceof FormData ? body : form ? new URLSearchParams(body as Record<string, string>) : JSON.stringify(body) })
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0], i = pair.indexOf("="); this.cookies.set(pair.slice(0, i), pair.slice(i + 1)) }
    return response
  }
  async json(path: string, expected: number, method = "GET", body?: unknown) {
    const response = await this.request(path, method, body), data = await response.json()
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`); checks++; return data
  }
}
async function login(email: string) {
  const c = new Client(), { csrfToken } = await c.json("/api/auth/csrf", 200)
  await c.request("/api/auth/callback/credentials", "POST", { email, password: "CampoDemo-2026!", csrfToken, callbackUrl: base }, true)
  ok((await c.json("/api/auth/session", 200)).user?.email === email, "Login de ensayo")
  return c
}
async function main() {
  const admin = await login("demo.campo@example.invalid"), worker = await login("operario.campo@example.invalid")
  const org = await db.organizacion.findUniqueOrThrow({ where: { slug: "demo-campo-integral" } })
  const stamp = randomUUID().slice(0, 8)
  const field = await admin.json(`/api/organizaciones/${org.id}/establecimientos`, 201, "POST", { nombre: `Ensayo mapa ${stamp}` })
  const polygon = { type: "Polygon", coordinates: [[[-69.04, -45.56], [-69.03, -45.56], [-69.03, -45.55], [-69.04, -45.55], [-69.04, -45.56]]] }
  const body = { establecimientoId: field.id, nombre: "Potrero con mapa", tipo: "potrero", superficieHa: 100, geometria: polygon }
  await new Client().json(`/api/mapa?establecimientoId=${field.id}`, 401)
  const initial = await admin.json(`/api/mapa?establecimientoId=${field.id}`, 200)
  ok(initial.data.length === 0 && initial.puedeEditar, "Campo vacío y permiso de edición")
  const created = (await admin.json("/api/sectores", 201, "POST", body)).data
  ok(created.version === 1 && created.geometria.type === "Polygon", "Contorno guardado")
  const all = (await admin.json(`/api/mapa?establecimientoId=${field.id}`, 200)).data
  ok(all.length === 1 && all[0].areaMapaHa > 80 && all[0].superficieHa === 100, "Superficie medida y declarada independientes")
  await admin.json("/api/sectores", 409, "POST", body)
  await worker.json("/api/sectores", 403, "POST", { ...body, nombre: "Sin permiso" })
  const changed = (await admin.json(`/api/sectores/${created.id}`, 200, "PATCH", { version: 1, nombre: "Potrero corregido" })).data
  ok(changed.version === 2 && JSON.stringify(changed.geometria) === JSON.stringify(polygon), "Editar mantiene el dibujo y el mismo sector")
  await admin.json(`/api/sectores/${created.id}`, 409, "PATCH", { version: 1, nombre: "Edición vieja" })
  await worker.json(`/api/sectores/${created.id}`, 403, "PATCH", { version: 2, nombre: "Sin permiso" })
  const other = await db.establecimiento.findFirstOrThrow({ where: { organizacionId: { not: org.id } } })
  await admin.json(`/api/mapa?establecimientoId=${other.id}`, 403)
  await admin.json("/api/sectores", 403, "POST", { ...body, establecimientoId: other.id })
  const otherSector = await db.sector.findFirst({ where: { establecimientoId: other.id } })
  if (otherSector) await admin.json(`/api/sectores/${otherSector.id}`, 404, "PATCH", { version: 1, nombre: "Ajeno" })
  await admin.json("/api/mapa?establecimientoId=invalido", 400)
  await admin.json("/api/sectores", 400, "POST", { ...body, nombre: "Cruce", geometria: { type: "Polygon", coordinates: [[[-69, -45], [-68, -44], [-69, -44], [-68, -45], [-69, -45]]] } })
  await admin.json("/api/sectores", 400, "POST", { ...body, nombre: "Abierto", geometria: { type: "Polygon", coordinates: [[[-69, -45], [-68, -45], [-68, -44]]] } })
  await admin.json("/api/sectores", 413, "POST", { ...body, descripcion: "a".repeat(65000) })
  const shed = (await admin.json("/api/sectores", 201, "POST", { establecimientoId: field.id, nombre: "Galpón de insumos", tipo: "galpon", descripcion: "Herramientas y fardos ficticios", geometria: { type: "Point", coordinates: [-69.035, -45.552] } })).data
  const after = (await admin.json(`/api/mapa?establecimientoId=${field.id}`, 200)).data
  ok(after.length === 2 && after.find((s: any) => s.id === shed.id).areaMapaHa === null, "Punto sin hectáreas y edición sin duplicados")
  const crop = await db.forraje.findFirstOrThrow({ where: { nombre: { contains: "alfalfa", mode: "insensitive" } } })
  await db.sectorForraje.create({ data: { sectorId: created.id, forrajeId: crop.id, desde: new Date("2026-09-01"), superficieHa: 25 } })
  const cow = await db.animal.findFirstOrThrow({ where: { establecimiento: { organizacionId: org.id }, especie: { nombre: "bovino" } } })
  const animal = await db.animal.create({ data: { establecimientoId: field.id, especieId: cow.especieId, razaId: cow.razaId, categoriaId: cow.categoriaId, sexo: cow.sexo, caravanaVisual: `MAP-${stamp}` } })
  await db.ubicacionHist.create({ data: { animalId: animal.id, sectorId: created.id, desde: new Date() } })
  const connected = (await admin.json(`/api/mapa?establecimientoId=${field.id}`, 200)).data.find((s: any) => s.id === created.id)
  ok(connected.bovinos === 1 && connected.ovinos === 0 && connected.forrajes[0].forraje.nombre === crop.nombre, "Ganado realmente ubicado y cultivo enlazados al sector")
  ok(!(await worker.json(`/api/mapa?establecimientoId=${field.id}`, 200)).puedeEditar, "Operario consulta sin permiso de edición")
  await admin.json(`/api/sectores/${created.id}`, 200, "PATCH", { version: 2, geometria: null })
  const unlocated = (await admin.json(`/api/mapa?establecimientoId=${field.id}`, 200)).data.find((s: any) => s.id === created.id)
  ok(unlocated.geometria === null && unlocated.bovinos === 1 && unlocated.forrajes.length === 1, "Quitar dibujo conserva sector, ganado y cultivo")

  const detail = `/api/sectores/${created.id}/ficha`
  const ficha = await admin.json(detail, 200)
  ok(ficha.animales.length === 1 && ficha.cultivos.length === 1, "Ficha integra animales y campañas")
  const list = (await admin.json(`/api/sectores?establecimientoId=${field.id}`, 200)).data
  ok(list.find((s: any) => s.id === created.id).bovinos === unlocated.bovinos, "Mapa y listado comparten ocupación")
  const task = { clave: randomUUID(), tipo: "tarea", estado: "pendiente", detalle: "Revisar flotante de aguada" }
  const taskRow = (await admin.json(detail, 201, "POST", task)).data
  await admin.json(detail, 200, "POST", task)
  ok(await db.sectorRegistro.count({ where: { clave: task.clave } }) === 1, "Reintento no duplica la tarea")
  await worker.json(detail, 403, "POST", { ...task, clave: randomUUID() })
  await admin.json(detail, 400, "POST", { ...task, clave: randomUUID(), estado: "disponible" })
  await admin.json(detail, 200, "PATCH", { id: taskRow.id, version: 1 })
  await admin.json(detail, 409, "PATCH", { id: taskRow.id, version: 1 })
  const water = { clave: randomUUID(), tipo: "revision_agua", estado: "sin_agua", detalle: "Prueba de revisión sin agua" }
  await admin.json(detail, 201, "POST", water)
  const state = (await admin.json(`/api/mapa?establecimientoId=${field.id}`, 200)).data.find((s: any) => s.id === created.id)
  ok(state.agua.estado === "sin_agua" && state.pendientes === 0, "Agua revisada y tareas completadas reflejadas")
  const measurement = { fecha: "2026-09-19", alturaPastoCm: 0, coberturaPct: 0 }
  await worker.json(`/api/sectores/${created.id}/mediciones`, 403, "POST", measurement)
  await admin.json(`/api/sectores/${shed.id}/mediciones`, 400, "POST", measurement)
  const measured = (await admin.json(`/api/sectores/${created.id}/mediciones`, 201, "POST", measurement)).data
  ok(measured.alturaPastoCm === 0 && measured.coberturaPct === 0, "Una medición de cero conserva el cero")
  const target = (await admin.json("/api/sectores", 201, "POST", { establecimientoId: field.id, nombre: "Potrero destino", tipo: "potrero", superficieHa: 50 })).data
  const movement = { animalIds: [animal.id], origenSectorId: created.id, destinoSectorId: target.id }
  await worker.json("/api/mapa/movimientos", 403, "POST", movement)
  await admin.json("/api/mapa/movimientos", 400, "POST", { ...movement, destinoSectorId: shed.id })
  await admin.json("/api/mapa/movimientos", 201, "POST", movement)
  await admin.json("/api/mapa/movimientos", 409, "POST", movement)
  const location = await db.ubicacionHist.findMany({ where: { animalId: animal.id }, orderBy: { desde: "asc" } })
  ok(location.length === 2 && location[0].hasta !== null && location[1].sectorId === target.id && location[1].hasta === null, "Movimiento conserva historial y una única ubicación actual")
  const movedMap = (await admin.json(`/api/mapa?establecimientoId=${field.id}`, 200)).data
  ok(movedMap.find((s: any) => s.id === created.id).bovinos === 0 && movedMap.find((s: any) => s.id === target.id).bovinos === 1, "Movimiento actualiza ambos potreros")
  const group = await db.lote.create({ data: { nombre: "Grupo de ensayo", tipo: "mixto", establecimientoId: field.id, especieId: animal.especieId } })
  await db.animalLoteHist.create({ data: { animalId: animal.id, loteId: group.id } })
  await admin.json("/api/pastoreo", 201, "POST", { loteId: group.id, sectorId: created.id })
  ok(await db.ubicacionHist.count({ where: { animalId: animal.id, sectorId: created.id, hasta: null } }) === 1, "Ingresar grupo también mueve la hacienda")
  ok(await db.evtPastoreo.count({ where: { loteId: group.id, sectorId: created.id, egreso: null } }) === 1, "Grupo registra un pastoreo activo")
  const product = await db.producto.create({ data: { nombre: "Insumo de ensayo", tipo: "otro", organizacionId: org.id } })
  const stockUrl = `/api/sectores/${shed.id}/stock`
  const stockIn = { clave: randomUUID(), productoId: product.id, tipo: "entrada", cantidad: 10, motivo: "Stock ficticio inicial" }
  await admin.json(stockUrl, 201, "POST", stockIn)
  await admin.json(stockUrl, 201, "POST", stockIn)
  await worker.json(stockUrl, 403, "POST", { ...stockIn, clave: randomUUID() })
  await admin.json(stockUrl, 409, "POST", { ...stockIn, clave: randomUUID(), tipo: "salida", cantidad: 11 })
  await admin.json(stockUrl, 201, "POST", { ...stockIn, clave: randomUUID(), tipo: "salida", cantidad: 3 })
  const stockDetails = await admin.json(`/api/sectores/${shed.id}/ficha`, 200)
  ok(stockDetails.existencias[0].cantidad === 7, "Stock por galpón sin duplicar reintentos ni permitir negativos")
  const concurrent = await Promise.all([1, 2].map(() => admin.request(stockUrl, "POST", { ...stockIn, clave: randomUUID(), tipo: "salida", cantidad: 5 })))
  ok(concurrent.map(r => r.status).sort().join(",") === "201,409", "Dos salidas concurrentes no sobregiran el stock")
  const road = (await admin.json("/api/sectores", 201, "POST", { establecimientoId: field.id, nombre: "Camino de ensayo", tipo: "camino", geometria: { type: "LineString", coordinates: [[-69.03,-45.55],[-69.02,-45.54]] } })).data
  ok(road.geometria.type === "LineString", "Camino lineal guardado")
  await admin.json("/api/sectores", 400, "POST", { establecimientoId: field.id, nombre: "Camino vacío", tipo: "camino", geometria: { type: "LineString", coordinates: [[-69.03,-45.55]] } })
  await admin.json("/api/campo/cultivos", 400, "POST", { establecimientoId: field.id, sectorId: shed.id, forrajeId: crop.id, desde: "2026-09-19", superficieHa: 1 })
  await admin.json("/api/campo/cultivos", 400, "POST", { establecimientoId: field.id, sectorId: created.id, forrajeId: crop.id, desde: "2026-09-19", superficieHa: 90 })
  const reserve = (await admin.json("/api/campo/reservas", 201, "POST", { establecimientoId: field.id, depositoId: shed.id, nombre: "Fardos de ensayo", forrajeId: crop.id, unidad: "fardos", ubicacion: "Galpón de insumos", minimo: "2" })).data
  ok(reserve.depositoId === shed.id, "Reserva vinculada por ID al galpón")
  const reserves = await admin.json(`/api/campo/reservas?establecimientoId=${field.id}&sectorId=${shed.id}`, 200)
  ok(reserves.total === 1, "Reservas filtradas por galpón")
  if (otherSector) await admin.json(`/api/sectores/${otherSector.id}/ficha`, 404)
  const photo = new FormData()
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=", "base64")
  photo.set("metadata", JSON.stringify({ establecimientoId: field.id, sectorId: created.id, titulo: "Foto de ensayo del potrero", tipo: "otro", estado: "activo" }))
  photo.set("archivo", new Blob([new Uint8Array(png)], { type: "image/png" }), "potrero-ensayo.png")
  const attached = await admin.json("/api/administracion/documentos", 201, "POST", photo)
  const document = attached.data ?? attached
  const downloaded = await admin.request(`/api/documentos/${document.id}/archivo`)
  ok(downloaded.status === 200 && Buffer.from(await downloaded.arrayBuffer()).equals(png), "Foto enlazada conserva el archivo y puede descargarse")
  const withPhoto = await admin.json(detail, 200)
  ok(withPhoto.documentos.some((d: any) => d.id === document.id), "Foto aparece en la ficha correcta")
  const workerPhoto = await worker.json(detail, 200)
  ok(workerPhoto.documentos.length === 0, "Operario no recibe documentos del archivo administrativo")
  console.log(`${checks} comprobaciones HTTP/PostgreSQL aprobadas para Potreros y operación integrada.`)
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Error de prueba"); process.exitCode = 1 }).finally(() => db.$disconnect())
