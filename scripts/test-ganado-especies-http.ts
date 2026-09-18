// End-to-end HTTP + PostgreSQL. Only a local preview on an explicitly confirmed test branch.
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { PrismaClient } from "@prisma/client"
const base = process.env.ERP_TEST_URL ?? "http://127.0.0.1:3101"
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname))
const host = new URL(process.env.DATABASE_URL!).hostname.replace(
  "-pooler.",
  ".",
)
assert(
  host === process.env.ERP_TEST_DATABASE_HOST &&
    !host.includes("ep-fragrant-firefly"),
)
assert.equal(process.env.ERP_TEST_WRITES, "confirmed-test-branch")
const db = new PrismaClient()
let checks = 0
const ok = (value: unknown, message: string) => {
  assert(value, message)
  checks++
}
class Client {
  cookies = new Map<string, string>()
  async request(path: string, body?: unknown, form = false) {
    const r = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      redirect: "manual",
      headers: {
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(body === undefined
          ? {}
          : {
              "Content-Type": form
                ? "application/x-www-form-urlencoded"
                : "application/json",
            }),
      },
      body:
        body === undefined
          ? undefined
          : form
            ? new URLSearchParams(body as Record<string, string>)
            : JSON.stringify(body),
    })
    for (const cookie of r.headers.getSetCookie()) {
      const pair = cookie.split(";")[0],
        i = pair.indexOf("=")
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1))
    }
    return r
  }
  async json(path: string, status: number, body?: unknown) {
    const r = await this.request(path, body),
      data = await r.json()
    assert.equal(r.status, status, `${path}: ${JSON.stringify(data)}`)
    checks++
    return data
  }
}
async function login(email: string) {
  const c = new Client(),
    { csrfToken } = await c.json("/api/auth/csrf", 200)
  const r = await c.request(
    "/api/auth/callback/credentials",
    { email, password: "CampoDemo-2026!", csrfToken, callbackUrl: base },
    true,
  )
  ok([200, 302].includes(r.status), "Login")
  const session = await c.json("/api/auth/session", 200)
  ok(session.user?.email === email, "Authenticated demo account")
  return c
}
async function main() {
  const a = await login("demo.campo@example.invalid")
  const org = await db.organizacion.findUniqueOrThrow({
    where: { slug: "demo-campo-integral" },
  })
  const orgs = await a.json("/api/organizaciones", 200)
  ok(
    orgs.some((o: { id: string }) => o.id === org.id),
    "Preview connected to the confirmed demo copy",
  )
  const stamp = randomUUID().slice(0, 8)
  const field = await a.json(
    `/api/organizaciones/${org.id}/establecimientos`,
    201,
    { nombre: `Ensayo especies ${stamp}`, hectareas: 10 },
  )
  const sheep = await db.especie.findFirstOrThrow({
    where: { organizacionId: org.id, nombre: "ovino" },
  })
  const cow = await db.especie.findFirstOrThrow({
    where: { organizacionId: org.id, nombre: "bovino" },
  })
  const breed = await db.raza.findFirstOrThrow({
    where: { especieId: sheep.id },
  })
  const cat = await db.categoria.findFirstOrThrow({
    where: { especieId: sheep.id, sexo: "F" },
  })
  const cowBreed = await db.raza.findFirstOrThrow({
    where: { especieId: cow.id },
  })
  const cowCat = await db.categoria.findFirstOrThrow({
    where: { especieId: cow.id },
  })
  const lot = await db.lote.create({
    data: {
      nombre: "Majada ensayo",
      tipo: "cria",
      especieId: sheep.id,
      establecimientoId: field.id,
    },
  })
  const cowLot = await db.lote.create({
    data: {
      nombre: "Rodeo ensayo",
      tipo: "cria",
      especieId: cow.id,
      establecimientoId: field.id,
    },
  })
  const payload = {
    establecimientoId: field.id,
    especieId: sheep.id,
    razaId: breed.id,
    categoriaId: cat.id,
    sexo: "F",
  }
  // Fixtures beyond the first 25 results, intentionally separate from La Alameda.
  await db.animal.createMany({
    data: Array.from({ length: 30 }, (_, i) => ({
      ...payload,
      sexo: "F" as const,
      caravanaVisual: `OV-${stamp}-${String(i).padStart(2, "0")}`,
      caravanaRfid: `RFID-${stamp}-${i}`,
    })),
  })
  await db.animal.create({
    data: {
      establecimientoId: field.id,
      especieId: cow.id,
      razaId: cowBreed.id,
      categoriaId: cowCat.id,
      sexo: "M",
      caravanaVisual: `BO-${stamp}`,
    },
  })
  await db.animal.create({
    data: {
      ...payload,
      sexo: "F",
      estadoVital: "vendido",
      caravanaVisual: `VENTA-${stamp}`,
    },
  })
  const list = (extra = "") =>
    `/api/ganado/bovinos?establecimientoId=${field.id}&${extra}`
  await new Client().json(list("especie=ovino"), 401)
  const ov = await a.json(list("especie=ovino&estadoVital=activo"), 200)
  ok(
    ov.data.length === 25 &&
      ov.pagination.total === 30 &&
      ov.stats.total === 30,
    "Ovine results and totals include all pages",
  )
  ok(
    ov.data.every(
      (x: any) => x.especie.id === sheep.id && x.establecimientoId === field.id,
    ),
    "No bovines or other fields in ovine results",
  )
  const page2 = await a.json(
    list("especie=ovino&estadoVital=activo&page=2"),
    200,
  )
  ok(
    page2.data.length === 5 &&
      !page2.data.some((x: any) => ov.data.some((y: any) => y.id === x.id)),
    "Pagination without duplicate animals",
  )
  const found = await a.json(
    list(`especie=ovino&busqueda=RFID-${stamp}-29`),
    200,
  )
  ok(
    found.data.length === 1 && found.data[0].id === page2.data.at(-1).id,
    "RFID search finds an animal beyond page one",
  )
  const bov = await a.json(list("especie=bovino"), 200)
  ok(
    bov.stats.total === 1 && bov.data[0].especie.id === cow.id,
    "Bovine tab has its own total",
  )
  const sold = await a.json(list("especie=ovino&estadoVital=vendido"), 200)
  ok(
    sold.stats.total === 1 && sold.data[0].estadoVital === "vendido",
    "Sold sheep remain searchable",
  )
  const all = await a.json(
    list("especie=todos&estadoVital=todos&limit=100"),
    200,
  )
  ok(all.data.length === 32, "All species and all states remain available")
  const wrongCategory = await a.json(
    list(`especie=ovino&categoriaId=${cowCat.id}`),
    200,
  )
  ok(
    wrongCategory.stats.total === 0,
    "A bovine category cannot leak into sheep results",
  )
  for (const query of [
    "especie=invalid",
    "page=-1",
    "limit=0",
    "orderDirection=bad",
  ])
    await a.json(list(query), 400)
  const foreignField = await db.establecimiento.findFirstOrThrow({
    where: { organizacionId: { not: org.id } },
  })
  await a.json(
    `/api/ganado/bovinos?establecimientoId=${foreignField.id}&especie=ovino`,
    403,
  )
  const emptyField = await db.establecimiento.findFirstOrThrow({
    where: { organizacionId: org.id, nombre: { startsWith: "El Molino" } },
  })
  const empty = await a.json(
    `/api/ganado/bovinos?establecimientoId=${emptyField.id}&especie=todos`,
    200,
  )
  ok(empty.stats.total === 0, "Empty field does not inherit demo animals")
  const animal = (
    await a.json("/api/ganado/bovinos", 201, {
      ...payload,
      caravanaVisual: `ALTA-OV-${stamp}`,
      pesoInicial: 42,
      loteId: lot.id,
    })
  ).data
  await a.json("/api/ganado/bovinos", 400, {
    ...payload,
    razaId: cowBreed.id,
    caravanaVisual: `INVALID-${stamp}`,
  })
  await a.json("/api/ganado/bovinos", 400, {
    ...payload,
    loteId: cowLot.id,
    caravanaVisual: `INVALID-LOT-${stamp}`,
  })
  const patch = async (body: unknown, status: number) => {
    const r = await fetch(base + `/api/ganado/bovinos/${animal.id}`, {
      method: "PATCH",
      headers: {
        Cookie: [...a.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    ok(r.status === status, `Patch returned ${status}`)
  }
  await patch({ loteId: cowLot.id }, 400)
  await patch(
    { especieId: cow.id, razaId: cowBreed.id, categoriaId: cowCat.id },
    400,
  )
  await patch({ notas: "Ficha ovina verificada" }, 200)
  await a.json("/api/ganado/pesos", 200, {
    bovinoId: animal.id,
    peso: 45,
    fecha: "2026-09-18",
  })
  const sanitaria = {
    bovinoId: animal.id,
    tipoEvento: "tratamiento",
    descripcion: "Tratamiento ficticio de ensayo",
    fecha: "2026-09-18",
    producto: `Producto ensayo ${stamp}`,
    dosis: "2",
  }
  await a.json("/api/ganado/eventos-sanitarios", 200, sanitaria)
  const event = await db.evtSanidad.findFirstOrThrow({
    where: { animalId: animal.id },
    include: { producto: true },
  })
  ok(
    event.producto.organizacionId === org.id &&
      event.producto.nombre === sanitaria.producto,
    "Sanitary event preserves the exact product and organization",
  )
  const foreignProduct = await db.producto.findFirst({
    where: { organizacionId: { not: org.id } },
  })
  if (foreignProduct)
    await a.json("/api/ganado/eventos-sanitarios", 400, {
      ...sanitaria,
      producto: foreignProduct.id,
    })
  await a.json("/api/ganado/movimiento-lote", 400, {
    animalIds: [animal.id],
    loteDestinoId: cowLot.id,
  })
  await a.json("/api/ganado/movimiento-lote", 200, {
    animalIds: [found.data[0].id],
    loteDestinoId: lot.id,
  })
  const lotAnimals = await a.json(list(`especie=ovino&loteId=${lot.id}`), 200)
  ok(
    lotAnimals.data.length === 2 &&
      lotAnimals.data.every((x: any) => x.lote === "Majada ensayo"),
    "Ovine lot includes both registered and moved animals",
  )
  const detail = (
    await a.json(`/api/ganado/bovinos/${animal.id}?fullHistory=true`, 200)
  ).data
  ok(
    detail.especie.id === sheep.id &&
      detail.notas === "Ficha ovina verificada" &&
      detail.eventosPesada.length === 2 &&
      detail.eventosSanidad.length === 1,
    "Full ovine history and edits preserved",
  )
  await a.json(`/api/ganado/${animal.id}/preparacion`, 200)
  const report = await a.json(
    list("especie=ovino&estadoVital=activo&limit=1"),
    200,
  )
  ok(
    report.stats.total === 31 &&
      report.stats.conPeso === 1 &&
      report.stats.pesoPromedio === 45,
    "Ovine report uses latest weight across every page",
  )
  console.log(
    `${checks} comprobaciones aprobadas: especies, campos, altas, catálogo, RFID, paginación, reportes, pesadas, sanidad, fichas y lotes.`,
  )
}
main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Falló ensayo Ganado",
    )
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
