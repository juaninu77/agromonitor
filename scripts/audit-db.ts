// Auditoría estática de la base de datos: verifica que las mejoras de esquema,
// integridad y proceso estén presentes. Solo lee archivos (no toca la BD).
// Uso: pnpm db:audit  (o: tsx scripts/audit-db.ts)

import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(__dirname, "..")
const read = (p: string) => readFileSync(join(ROOT, p), "utf8")

interface Check {
  nombre: string
  ok: boolean
  detalle?: string
}
const checks: Check[] = []
const add = (nombre: string, ok: boolean, detalle?: string) =>
  checks.push({ nombre, ok, detalle })

const schema = read("prisma/schema.prisma")
const constraints = existsSync(join(ROOT, "prisma/constraints.sql"))
  ? read("prisma/constraints.sql")
  : ""

// --- 1. Dinero como Decimal, nunca Float ---
const moneyLines = schema
  .split("\n")
  .filter((l) => /(\bprecioKg|\bprecioTotal|\bcosto)\b/.test(l) && /(Float|Decimal)/.test(l))
const moneyFloats = moneyLines.filter((l) => l.includes("Float"))
add(
  "Dinero en Decimal (no Float)",
  moneyLines.length >= 4 && moneyFloats.length === 0,
  moneyFloats.length ? `Aún en Float: ${moneyFloats.map((l) => l.trim()).join(" | ")}` : `${moneyLines.length} campos Decimal`
)

// --- 2. AuditLog con columna de tenant ---
add(
  "AuditLog tiene organizacionId + índice",
  /model AuditLog[\s\S]*?organizacionId[\s\S]*?@@index\(\[organizacionId\]\)/.test(schema),
  undefined
)

// --- 3. logAudit acepta organizacionId ---
add(
  "logAudit propaga organizacionId",
  /organizacionId/.test(read("lib/api/audit-log.ts"))
)

// --- 4. Migraciones versionadas ---
const migDir = "prisma/migrations"
const tieneMigraciones =
  existsSync(join(ROOT, migDir)) &&
  existsSync(join(ROOT, migDir, "migration_lock.toml")) &&
  readdirSync(join(ROOT, migDir)).some((d) =>
    existsSync(join(ROOT, migDir, d, "migration.sql"))
  )
add("Baseline de migraciones presente", tieneMigraciones)

// --- 5. Migraciones NO ignoradas por git ---
const gitignore = read(".gitignore")
add(
  "Migraciones versionables en git",
  !/^\/prisma\/migrations\s*$/m.test(gitignore) &&
    /!\/prisma\/migrations/.test(gitignore)
)

// --- 6. CHECK constraints de enums ---
const enumChecks = [
  "animales_estado_vital_chk",
  "sectores_tipo_chk",
  "evt_baja_motivo_chk",
  "tareas_estado_chk",
  "movimientos_stock_tipo_chk",
]
const faltanEnum = enumChecks.filter((c) => !constraints.includes(c))
add("CHECK de dominios (enums)", faltanEnum.length === 0, faltanEnum.length ? `Faltan: ${faltanEnum.join(", ")}` : undefined)

// --- 7. CHECK de dinero no negativo ---
add(
  "CHECK de dinero no negativo",
  /precio_kg IS NULL OR precio_kg >= 0/.test(constraints) &&
    /costo IS NULL OR costo >= 0/.test(constraints)
)

// --- 8. CHECK XOR animal/lote + intervalos abiertos (regla del repo) ---
add(
  "CHECK XOR animal/lote e intervalos únicos",
  /num_nonnulls\(animal_id, lote_id\) = 1/.test(constraints) &&
    /ubicacion_hist_un_abierto_por_animal/.test(constraints)
)

// --- 9. Runbook de endurecimiento documentado ---
add(
  "Runbook de migraciones/endurecimiento",
  existsSync(join(ROOT, "docs/05-deploy/MIGRACIONES_Y_ENDURECIMIENTO.md"))
)

// --- 10. Script db:constraints y db:backfill-tenant en package.json ---
const pkg = read("package.json")
add(
  "Scripts db:constraints, db:backfill-tenant, db:audit",
  /"db:constraints"/.test(pkg) &&
    /"db:backfill-tenant"/.test(pkg) &&
    /"db:audit"/.test(pkg)
)

// --- 11. Catálogos por organización ---
const especieOrg = /model Especie[\s\S]*?organizacionId[\s\S]*?@@unique\(\[organizacionId, nombre\]\)/.test(schema)
const razaOrg = /model Raza[\s\S]*?organizacionId String\?/.test(schema)
const categoriaOrg = /model Categoria[\s\S]*?organizacionId String\?/.test(schema)
add("Catálogos (especie/raza/categoría) por organización", especieOrg && razaOrg && categoriaOrg)

// --- 12. validate-especie scopea por organización ---
add(
  "validate-especie acepta organizacionIds",
  /organizacionIds\?/.test(read("lib/ganado/validate-especie.ts"))
)

// --- 13. Cobertura de auditoría en mutaciones sensibles ---
const rutasConAudit = [
  "app/api/ganado/bovinos/[id]/route.ts",
  "app/api/ventas/bajas/route.ts",
  "app/api/manga/[id]/route.ts",
  "app/api/documentos-transito/route.ts",
]
const sinAudit = rutasConAudit.filter((r) => !/logAudit\(/.test(read(r)))
add("Auditoría en mutaciones sensibles", sinAudit.length === 0, sinAudit.length ? `Faltan: ${sinAudit.join(", ")}` : undefined)

// --- 14. Historiales sin mezcla Date/DateTime ---
const bloqueLoteHist = schema.match(/model AnimalLoteHist \{[\s\S]*?\n\}/)?.[0] ?? ""
add(
  "AnimalLoteHist usa DateTime (no @db.Date)",
  /desde  DateTime  @default\(now\(\)\)/.test(bloqueLoteHist) &&
    !/@db\.Date/.test(bloqueLoteHist)
)

// ---- Reporte ----
const pass = checks.filter((c) => c.ok).length
const total = checks.length
console.log("\n=== Auditoría de base de datos ===\n")
for (const c of checks) {
  console.log(`${c.ok ? "✅" : "❌"} ${c.nombre}${c.detalle ? `  — ${c.detalle}` : ""}`)
}
console.log(`\n${pass}/${total} objetivos cumplidos.\n`)

if (pass !== total) {
  process.exit(1)
}
