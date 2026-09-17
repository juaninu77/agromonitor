// HTTP smoke tests contra un servidor LOCAL conectado a la rama de ensayo.
// Crea datos ficticios persistentes únicamente en esa rama.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
const base = process.env.ERP_TEST_URL ?? 'http://localhost:3100'
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname), 'Solo servidor local de pruebas')
assert.equal(process.env.ERP_TEST_WRITES, 'confirmed-test-branch', 'Confirmar rama de ensayo')
let checks = 0
class Client {
  cookies = new Map<string,string>()
  async request(path: string, body?: unknown, form = false) {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
      headers: { Cookie: [...this.cookies].map(([k,v])=>`${k}=${v}`).join('; '),
        ...(body !== undefined ? { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' } : {}) },
      body: body === undefined ? undefined : form ? new URLSearchParams(body as Record<string,string>).toString() : JSON.stringify(body),
    })
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0]; const separator = pair.indexOf('=')
      this.cookies.set(pair.slice(0,separator),pair.slice(separator+1))
    }
    const content = await response.text()
    let data: any
    try { data = JSON.parse(content) } catch { data = null }
    return { status: response.status, data, content }
  }
  async expect(path: string, status: number, body?: unknown) {
    const result = await this.request(path,body)
    assert.equal(result.status,status,`${path}: HTTP ${result.status}, esperado ${status}`); checks++
    return result.data
  }
}
async function account() {
  const client = new Client(), suffix=randomUUID(), password=`Test-${randomUUID()}`
  const email=`erp-test-${suffix}@example.invalid`
  await client.expect('/api/auth/register',201,{nombre:'Prueba',apellido:`ERP-${suffix}`,email,password})
  const { csrfToken } = await client.expect('/api/auth/csrf',200)
  const login=await client.request('/api/auth/callback/credentials',{email,password,csrfToken,callbackUrl:base},true)
  assert([200,302].includes(login.status),'Login rechazado'); checks++
  const session=await client.expect('/api/auth/session',200)
  assert(session.user?.id,'No se creó sesión'); checks++
  const orgs=await client.expect('/api/organizaciones',200)
  assert.equal(orgs.length,1); checks++
  const fields=await client.expect(`/api/organizaciones/${orgs[0].id}/establecimientos`,200)
  const list=Array.isArray(fields) ? fields : fields.data
  assert(list?.length>0,'Falta campo inicial'); checks++
  return {client,orgId:orgs[0].id,fieldId:list[0].id}
}
async function main() {
  await new Client().expect('/api/ganado/bovinos',401)
  const a=await account(), b=await account()
  const species=await a.client.expect('/api/especies',201,{nombre:'bovino',organizacionId:a.orgId})
  const breed=await a.client.expect('/api/razas',201,{nombre:'Angus',especieId:species.data.id,organizacionId:a.orgId})
  const category=await a.client.expect('/api/categorias',201,{nombre:'vaca',sexo:'F',especieId:species.data.id,organizacionId:a.orgId})
  const animal=await a.client.expect('/api/ganado/bovinos',201,{establecimientoId:a.fieldId,especieId:species.data.id,razaId:breed.data.id,categoriaId:category.data.id,sexo:'F',caravanaVisual:`TEST-${randomUUID()}`,pesoInicial:350})
  const field2=await a.client.expect(`/api/organizaciones/${a.orgId}/establecimientos`,201,{nombre:'Campo secundario de prueba',hectareas:25})
  const sector2=await a.client.expect('/api/sectores',201,{nombre:'Potrero',tipo:'potrero',establecimientoId:field2.id})
  const payload={establecimientoId:a.fieldId,especieId:species.data.id,razaId:breed.data.id,categoriaId:category.data.id,sexo:'F'}
  await a.client.expect('/api/ganado/bovinos',404,{...payload,sectorId:sector2.data.id})
  const brokenTag=`TEST-ROLLBACK-${randomUUID()}`
  await a.client.expect('/api/ganado/bovinos',500,{...payload,caravanaVisual:brokenTag,pesoInicial:350,ccInicial:'invalid'})
  const rolledBack=await a.client.expect(`/api/ganado/bovinos?busqueda=${brokenTag}`,200)
  assert.equal(rolledBack.data.length,0,'El alta parcial dejó un animal huérfano'); checks++
  await a.client.expect('/api/ganado/pesos',200,{bovinoId:animal.data.id,peso:365,fecha:'2026-09-16'})
  const weights=await a.client.expect(`/api/ganado/pesos?bovinoId=${animal.data.id}`,200)
  assert.equal(weights.data.length,2); checks++
  await b.client.expect(`/api/ganado/bovinos?establecimientoId=${a.fieldId}`,403)
  await b.client.expect('/api/ganado/pesos',404,{bovinoId:animal.data.id,peso:400,fecha:'2026-09-16'})
  const hidden=await b.client.expect(`/api/ganado/pesos?bovinoId=${animal.data.id}`,200)
  assert.equal(hidden.data.length,0); checks++
  for(const path of ['/api/especies','/api/razas','/api/categorias','/api/dashboard/stats','/api/productos','/api/inventario',`/api/manga?establecimientoId=${a.fieldId}`,'/api/tareas']) await a.client.expect(path,200)
  for(const path of ['/','/ganado','/manga','/sanidad','/inventario','/configuracion/catalogo']) {
    const page=await a.client.request(path)
    assert.equal(page.status,200,`Página ${path}: HTTP ${page.status}`); checks++
  }
  console.log(`${checks} comprobaciones HTTP aprobadas: registro, login, catálogos, alta, pesadas, aislamiento y páginas.`)
}
main().catch((error)=>{console.error(error instanceof Error ? error.message : 'Falló smoke HTTP');process.exitCode=1})
