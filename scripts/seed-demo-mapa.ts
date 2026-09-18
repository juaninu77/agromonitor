import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { polygonFrom } from "../lib/mapa/geometry"
const host = new URL(process.env.DATABASE_URL!).hostname.replace("-pooler.", ".")
assert.equal(host, process.env.ERP_TEST_DATABASE_HOST)
assert(!host.includes("ep-fragrant-firefly"))
assert.equal(process.env.ERP_TEST_WRITES, "confirmed-test-branch")
const db = new PrismaClient()
async function main() {
  const field = await db.establecimiento.findFirstOrThrow({ where: { nombre: "La Alameda · DEMO", organizacion: { slug: "demo-campo-integral" } } })
  const sectors = await db.sector.findMany({ where: { establecimientoId: field.id, activo: true }, orderBy: { nombre: "asc" } })
  let mapped = 0
  for (const [index, sector] of sectors.entries()) {
    if (sector.geometria) continue
    const lon = -69.041 + index * 0.01, lat = -45.555
    await db.sector.update({ where: { id: sector.id }, data: { geometria: polygonFrom([[lon, lat], [lon + 0.008, lat], [lon + 0.008, lat + 0.006], [lon, lat + 0.006]])!, descripcion: `${sector.descripcion ?? ""}\nTrazado ficticio cerca de Sarmiento para probar el mapa; no representa límites reales.`, version: { increment: 1 } } })
    mapped++
  }
  await db.sector.upsert({ where: { establecimientoId_nombre: { establecimientoId: field.id, nombre: "Galpón de suministros · DEMO" } }, update: {}, create: { establecimientoId: field.id, nombre: "Galpón de suministros · DEMO", tipo: "galpon", geometria: { type: "Point", coordinates: [-69.026, -45.557] }, descripcion: "Ubicación ficticia de herramientas y suministros para probar el mapa. El stock se administra en Inventario." } })
  await db.sector.upsert({ where: { establecimientoId_nombre: { establecimientoId: field.id, nombre: "Tanque de agua · DEMO" } }, update: {}, create: { establecimientoId: field.id, nombre: "Tanque de agua · DEMO", tipo: "aguada", tieneAgua: true, geometria: { type: "Point", coordinates: [-69.024, -45.549] }, descripcion: "Instalación ficticia de ejemplo." } })
  console.log(`Mapa DEMO preparado: ${mapped} áreas ubicadas y referencias de galpón y aguada. Sólo datos ficticios.`)
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Error de seed"); process.exitCode = 1 }).finally(() => db.$disconnect())
