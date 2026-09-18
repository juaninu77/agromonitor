// Completa el catálogo DEMO sin reemplazar animales ni categorías existentes.
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"

const host = new URL(process.env.DATABASE_URL ?? "").hostname.replace("-pooler.", ".")
assert(host === process.env.ERP_TEST_DATABASE_HOST && !host.includes("ep-fragrant-firefly"))
assert.equal(process.env.ERP_TEST_WRITES, "confirmed-test-branch")
const db = new PrismaClient()
async function main() {
  const org = await db.organizacion.findUniqueOrThrow({ where: { slug: "demo-campo-integral" } })
  for (const [nombre, categorias] of Object.entries({
    bovino: [["toro", "M"], ["novillo", "M"], ["ternero", "M"], ["vaquillona", "F"]],
    ovino: [["carnero", "M"], ["cordero", "M"], ["cordera", "F"], ["borrega", "F"]],
  })) {
    const especie = await db.especie.findFirstOrThrow({ where: { organizacionId: org.id, nombre } })
    await db.categoria.createMany({ data: categorias.map(([nombre, sexo]) => ({ nombre, sexo, especieId: especie.id, organizacionId: org.id })), skipDuplicates: true })
  }
  console.log("Catálogos DEMO completados para machos y hembras, bovinos y ovinos.")
}
main().catch(() => { console.error("No se pudo completar el catálogo DEMO"); process.exitCode = 1 }).finally(() => db.$disconnect())
