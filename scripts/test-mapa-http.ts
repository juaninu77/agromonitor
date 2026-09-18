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
      ...(body === undefined ? {} : { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" }),
    }, body: body === undefined ? undefined : form ? new URLSearchParams(body as Record<string, string>) : JSON.stringify(body) })
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
  console.log(`${checks} comprobaciones HTTP/PostgreSQL aprobadas para mapa, sectores, aislamiento, permisos, concurrencia y geometría.`)
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Error de prueba"); process.exitCode = 1 }).finally(() => db.$disconnect())
