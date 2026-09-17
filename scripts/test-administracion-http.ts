// Explicitly guarded, creates fictitious records only on a local preview/test branch.
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { PrismaClient } from "@prisma/client"
const base = process.env.ERP_TEST_URL ?? "http://127.0.0.1:3101"
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname))
assert.equal(process.env.ERP_TEST_WRITES, "confirmed-test-branch")
const dbHost = new URL(process.env.DATABASE_URL!).hostname.replace("-pooler.", ".")
assert(process.env.ERP_TEST_DATABASE_HOST && dbHost === process.env.ERP_TEST_DATABASE_HOST)
assert(!dbHost.includes("ep-fragrant-firefly"), "Never test writes on main")
const prisma = new PrismaClient()
let checks = 0
const ok = (condition: unknown, message: string) => { assert(condition, message); checks++ }
class Client {
  cookies = new Map<string, string>()
  async request(path: string, method = "GET", body?: BodyInit, headers: Record<string, string> = {}) {
    const response = await fetch(base + path, { method, redirect: "manual", body,
      headers: { Cookie: [...this.cookies].map(([k,v]) => `${k}=${v}`).join("; "), ...headers } })
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0], i = pair.indexOf("="); this.cookies.set(pair.slice(0,i), pair.slice(i+1)) }
    return response
  }
  async json(path: string, expected: number, data?: unknown, method = "POST") {
    const response = await this.request(path, data === undefined ? "GET" : method, data === undefined ? undefined : JSON.stringify(data), { "Content-Type": "application/json" })
    const body = await response.json()
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(body)}`); checks++
    return body
  }
}
async function account() {
  const client = new Client(), email = `admin-test-${randomUUID()}@example.invalid`, password = `Test-${randomUUID()}`
  await client.json("/api/auth/register", 201, { nombre: "Ensayo administración", apellido: "Datos ficticios", email, password })
  const { csrfToken } = await client.json("/api/auth/csrf", 200)
  const login = await client.request("/api/auth/callback/credentials", "POST", new URLSearchParams({ email, password, csrfToken, callbackUrl: base }), { "Content-Type": "application/x-www-form-urlencoded" })
  ok([200,302].includes(login.status), "Login")
  const session = await client.json("/api/auth/session", 200)
  ok(await prisma.usuario.findUnique({ where: { id: session.user.id } }), "The preview must use the same test database")
  const orgs = await client.json("/api/organizaciones", 200)
  const fields = await client.json(`/api/organizaciones/${orgs[0].id}/establecimientos`, 200)
  return { client, email, password, userId: session.user.id as string, orgId: orgs[0].id as string, campo: fields[0].id as string }
}
async function main() {
  const a = await account(), b = await account()
  const endpoint = (m: string) => `/api/administracion/${m}`
  const list = (m: string, campo = a.campo) => `${endpoint(m)}?establecimientoId=${campo}`
  const common = { establecimientoId: a.campo, titulo: "Tractor de ensayo", referencia: "TEST-001", fecha: "2026-09-17", notas: "Datos ficticios" }
  const asset = { ...common, tipo: "maquinaria", estado: "activo", importe: "125000.50", moneda: "USD" }
  await new Client().json(list("patrimonio"), 401)
  await b.client.json(list("patrimonio"), 403)
  const created = (await a.client.json(endpoint("patrimonio"), 201, asset)).data
  ok(created.importe === "125000.5" || created.importe === "125000.50", "Exact decimal persisted")
  await a.client.json(endpoint("patrimonio"), 400, { ...asset, importe: "0.001" })
  await b.client.json(endpoint("patrimonio"), 403, asset)
  await a.client.json(`${endpoint("patrimonio")}/${created.id}`, 200, { ...asset, titulo: "Tractor actualizado", version: 1 }, "PATCH")
  await a.client.json(`${endpoint("patrimonio")}/${created.id}`, 409, { ...asset, version: 1 }, "PATCH")
  await b.client.json(`${endpoint("patrimonio")}/${created.id}`, 409, { ...asset, establecimientoId: b.campo, version: 2 }, "PATCH")
  const invoice = { ...common, titulo: "Factura de combustible", referencia: "A-0001-123", tipo: "factura", estado: "pendiente", importe: "123456.78", moneda: "ARS", sentido: "egreso", contraparte: "Proveedor de ensayo", vencimiento: "2026-10-17" }
  const bill = (await a.client.json(endpoint("comprobantes"), 201, invoice)).data
  await a.client.json(endpoint("comprobantes"), 409, invoice)
  await a.client.json(endpoint("comprobantes"), 400, { ...invoice, fecha: "2026-02-30" })
  await a.client.json(`${endpoint("comprobantes")}/${bill.id}`, 200, { ...invoice, estado: "pagado", version: 1 }, "PATCH")
  const procedure = { ...common, titulo: "Renovación RENSPA", tipo: "renspa", estado: "presentado", vencimiento: "2026-10-01" }
  const tramite = (await a.client.json(endpoint("tramites"), 201, procedure)).data
  await a.client.json(endpoint("tramites"), 400, { ...procedure, vencimiento: "2026-09-16" })
  const document = { ...common, titulo: "Manual tractor", tipo: "otro", estado: "activo", activoId: created.id }
  const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF")
  async function upload(client: Client, metadata: object, expected: number, bytes = pdf, mime = "application/pdf", headers: Record<string,string> = {}) {
    const form = new FormData(); form.set("metadata", JSON.stringify(metadata)); form.set("archivo", new Blob([new Uint8Array(bytes).buffer], { type: mime }), "ensayo.pdf")
    const response = await client.request(endpoint("documentos"), "POST", form, headers)
    const body = await response.json(); assert.equal(response.status, expected, JSON.stringify(body)); checks++; return body.data
  }
  const doc = await upload(a.client, document, 201, pdf, "application/pdf", { Origin: base })
  const downloaded = await a.client.request(`/api/documentos/${doc.id}/archivo`)
  ok(downloaded.status === 200 && downloaded.headers.get("cache-control")?.includes("no-store"), "Private download headers")
  ok(Buffer.from(await downloaded.arrayBuffer()).equals(pdf), "Download bytes match uploaded file")
  ok(downloaded.headers.get("content-disposition")?.startsWith("attachment"), "Download attachment")
  ok((await b.client.request(`/api/documentos/${doc.id}/archivo`)).status === 404, "Cross tenant file hidden")
  ok((await new Client().request(`/api/documentos/${doc.id}/archivo`)).status === 401, "Anonymous file denied")
  await upload(b.client, { ...document, establecimientoId: b.campo }, 400)
  await upload(a.client, document, 400, new TextEncoder().encode("<script>bad</script>"))
  await upload(a.client, document, 413, new Uint8Array(3*1024*1024))
  await upload(a.client, document, 403, pdf, "application/pdf", { Origin: "https://untrusted.example" })
  await upload(a.client, { ...document, tramiteId: tramite.id }, 400)
  await upload(a.client, { ...document, activoId: null, comprobanteId: bill.id, tipo: "factura", titulo: "Adjunto factura" }, 201)
  await upload(a.client, { ...document, activoId: null, tramiteId: tramite.id, tipo: "senasa", titulo: "Constancia RENSPA" }, 201)
  const field2 = await a.client.json(`/api/organizaciones/${a.orgId}/establecimientos`, 201, { nombre: "Otro campo de ensayo" })
  await upload(a.client, { ...document, establecimientoId: field2.id }, 400)
  const species = await a.client.json("/api/especies",201,{ nombre: "bovino", organizacionId:a.orgId })
  const breed = await a.client.json("/api/razas",201,{ nombre:"Angus", especieId:species.data.id, organizacionId:a.orgId })
  const category = await a.client.json("/api/categorias",201,{ nombre:"vaca", sexo:"F", especieId:species.data.id, organizacionId:a.orgId })
  const animal = await a.client.json("/api/ganado/bovinos",201,{ establecimientoId:a.campo, especieId:species.data.id, razaId:breed.data.id, categoriaId:category.data.id, sexo:"F", caravanaVisual:`ADM-${randomUUID()}` })
  await upload(a.client,{ ...document, activoId:null, animalId:animal.data.id, tipo:"animal", titulo:"Ficha del animal" },201)
  await upload(b.client,{ ...document, activoId:null, animalId:animal.data.id, establecimientoId:b.campo },400)
  const docs = await a.client.json(list("documentos"),200)
  ok(docs.total === 4 && docs.data.every((d: Record<string,unknown>) => !d.contenido && !d.datos), "List excludes binary content and failed uploads")
  ok(docs.data.some((d: { activo?: { titulo: string } }) => d.activo?.titulo === "Tractor actualizado"), "Linked titles")
  await a.client.json(`${endpoint("documentos")}/${doc.id}`,200,{ ...document, estado:"archivado", version:1 },"PATCH")
  const searched = await a.client.json(list("patrimonio") + "&q=actualizado",200)
  ok(searched.total === 1, "Search")
  const page2 = await a.client.json(list("patrimonio") + "&page=2",200)
  ok(page2.data.length === 0 && page2.total === 1, "Pagination")
  const audit = await prisma.auditLog.count({ where:{ organizacionId:a.orgId, tabla:{ in:["patrimonio","comprobantes","tramites","documentos"] } } })
  ok(audit === 10, `Audit count ${audit}`)
  // A high role in another organization must not grant access in this one.
  await prisma.membresia.update({where:{ usuarioId_organizacionId:{ usuarioId:a.userId, organizacionId:a.orgId } },data:{rol:"operario"}})
  await prisma.membresia.create({data:{usuarioId:a.userId,organizacionId:b.orgId,rol:"propietario"}})
  for (const m of ["patrimonio","comprobantes","tramites","documentos"]) await a.client.json(list(m),403)
  await a.client.json(endpoint("patrimonio"),403,asset)
  ok((await a.client.request(`/api/documentos/${doc.id}/archivo`)).status === 404,"Role restricts file read")
  await prisma.membresia.update({where:{usuarioId_organizacionId:{usuarioId:a.userId,organizacionId:a.orgId}},data:{rol:"propietario"}})
  await prisma.organizacion.update({where:{id:a.orgId},data:{esActivo:false}})
  await a.client.json(list("documentos"),403)
  await prisma.organizacion.update({where:{id:a.orgId},data:{esActivo:true}})
  await prisma.usuario.update({where:{id:a.userId},data:{esActivo:false}})
  await a.client.json(list("documentos"),403)
  await prisma.usuario.update({where:{id:a.userId},data:{esActivo:true}})
  // Referential constraint must reject even a write bypassing the API.
  await assert.rejects(prisma.documentoArchivo.create({data:{establecimientoId:b.campo,titulo:"invalid",tipo:"otro",nombreArchivo:"x.pdf",mime:"application/pdf",bytes:10,sha256:"x",activoId:created.id}}), /Foreign key constraint/); checks++
  for (const path of ["/administracion","/administracion?modulo=comprobantes"]) ok((await a.client.request(path)).status === 200,`Page ${path}`)
  writeFileSync(join(tmpdir(),"agromonitor-admin-demo.json"),JSON.stringify({ email:a.email,password:a.password,campo:a.campo,orgId:a.orgId }))
  console.log(`${checks} comprobaciones HTTP/Neon de administración aprobadas. Datos ficticios solo en rama de ensayo.`)
}
main().catch(error=>{console.error(error instanceof Error ? error.message : error);process.exitCode=1}).finally(()=>prisma.$disconnect())
