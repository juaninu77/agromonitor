// Prueba real y transaccional: solo en una rama Neon de ensayo verificada.
// Todas las escrituras se revierten al finalizar, incluso si una aserción falla.
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { Prisma, PrismaClient } from "@prisma/client"

async function main() {
  const expected = process.env.NEON_TEST_DATABASE_HOST
  const actual = new URL(process.env.DATABASE_URL ?? "").hostname.replace("-pooler.", ".")
  assert(expected && actual === expected, "Declarar y verificar NEON_TEST_DATABASE_HOST antes de ejecutar")
  assert(actual !== "ep-fragrant-firefly-ahth70r1.c-3.us-east-1.aws.neon.tech", "Prohibido ejecutar pruebas con escrituras sobre main")
  const db = new PrismaClient({ log: [] })
  const rollback = new Error("ROLLBACK_TEST_FIXTURES")
  let checks = 0
  try {
    // Leer cada modelo obliga a Prisma a consultar sus columnas escalares reales.
    for (const model of Prisma.dmmf.datamodel.models) {
      const key = model.name[0].toLowerCase() + model.name.slice(1)
      await (db as any)[key].findMany({ take: 1 })
      checks++
    }
    await db.$transaction(async (tx) => {
      const orgA = await tx.organizacion.create({ data: { nombre: "Prueba ERP A", slug: `test-a-${randomUUID()}` } })
      const orgB = await tx.organizacion.create({ data: { nombre: "Prueba ERP B", slug: `test-b-${randomUUID()}` } })
      const fieldA = await tx.establecimiento.create({ data: { nombre: "Campo A", organizacionId: orgA.id } })
      const fieldB = await tx.establecimiento.create({ data: { nombre: "Campo B", organizacionId: orgB.id } })
      const speciesA = await tx.especie.create({ data: { nombre: "bovino", organizacionId: orgA.id } })
      const speciesB = await tx.especie.create({ data: { nombre: "bovino", organizacionId: orgB.id } })
      const animalA = await tx.animal.create({ data: { sexo: "F", especieId: speciesA.id, establecimientoId: fieldA.id } })
      await tx.animal.create({ data: { sexo: "M", especieId: speciesB.id, establecimientoId: fieldB.id } })
      const visible = await tx.animal.findMany({ where: { establecimientoId: { in: [fieldA.id] } } })
      assert.equal(visible.length, 1)
      assert.equal(visible[0].id, animalA.id)
      checks++
      await tx.evtPesada.create({ data: { animalId: animalA.id, fecha: new Date(), pesoKg: 420 } })
      assert.equal(await tx.evtPesada.count({ where: { animalId: animalA.id } }), 1)
      checks++
      const lot = await tx.lote.create({ data: { nombre: "Prueba", tipo: "recria", especieId: speciesA.id, establecimientoId: fieldA.id } })
      const timestamp = new Date("2026-09-16T14:37:12.000Z")
      await tx.animalLoteHist.create({ data: { animalId: animalA.id, loteId: lot.id, desde: timestamp } })
      assert.equal((await tx.animalLoteHist.findFirstOrThrow({ where: { animalId: animalA.id } })).desde.toISOString(), timestamp.toISOString())
      checks++
      const expectConstraint = async (operation: () => Promise<unknown>) => {
        await tx.$executeRawUnsafe("SAVEPOINT expected_failure")
        let rejected = false
        try { await operation() } catch (error) { rejected = /constraint/i.test(error instanceof Error ? error.message : "") }
        await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT expected_failure")
        assert(rejected, "El motor debería rechazar la operación inválida")
        checks++
      }
      await expectConstraint(() => tx.evtPesada.create({ data: { animalId: animalA.id, loteId: lot.id, fecha: new Date() } }))
      await expectConstraint(() => tx.evtPesada.create({ data: { fecha: new Date() } }))
      await expectConstraint(() => tx.animalLoteHist.create({ data: { animalId: animalA.id, loteId: lot.id } }))
      await expectConstraint(() => tx.animal.create({ data: { sexo: "invalido", especieId: speciesA.id } }))
      const product = await tx.producto.create({ data: { nombre: "Prueba", tipo: "vacuna", organizacionId: orgA.id } })
      const batch = await tx.loteProducto.create({ data: { productoId: product.id, nroLote: "TEST", costo: new Prisma.Decimal("123.45") } })
      assert.equal(batch.costo?.toFixed(2), "123.45")
      checks++
      await expectConstraint(() => tx.loteProducto.create({ data: { productoId: product.id, nroLote: "TEST", costo: -1 } }))
      throw rollback
    }, { timeout: 60000, maxWait: 15000 }).catch((error) => { if (error !== rollback) throw error })
    assert.equal(await db.organizacion.count({ where: { slug: { startsWith: "test-a-" }, nombre: "Prueba ERP A" } }), 0)
    console.log(`${checks} comprobaciones reales aprobadas; fixtures revertidos.`)
  } finally { await db.$disconnect() }
}
main().catch(() => { console.error("Falló la prueba de integración; no se muestran datos ni credenciales."); process.exitCode = 1 })
