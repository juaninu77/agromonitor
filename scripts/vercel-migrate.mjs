/**
 * Aplica las migraciones pendientes durante el build de Vercel.
 *
 * Cada ambiente de Vercel (Production / Preview / Development) tiene sus
 * propias variables, así que cada uno migra SU base (rama de Neon):
 *   - Production  → rama principal de Neon
 *   - Preview     → rama de preview (o la rama por deploy que crea la
 *                   integración Neon ↔ Vercel)
 *
 * - `prisma migrate deploy` solo aplica migraciones que todavía no están
 *   registradas en `_prisma_migrations`; nunca borra ni resetea datos.
 * - `prisma/constraints.sql` es idempotente y solo agrega validaciones.
 * - Si algo falla, el build falla y Vercel mantiene online el deploy anterior.
 *
 * Nunca imprime connection strings: solo el host, para poder auditar a qué
 * rama se aplicó cada migración desde los logs de build.
 */
import { execSync } from "node:child_process"

const env = { ...process.env }
const ambiente = env.VERCEL_ENV ?? env.APP_ENV ?? "local"

const salir = (mensaje) => {
  console.error(`❌ [migrate] ${mensaje}`)
  process.exit(1)
}

const hostDe = (url) => {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

/** Neon: el endpoint es el mismo con o sin `-pooler` */
const endpoint = (host) => host.replace(/-pooler(?=\.)/, "")

if (!env.DATABASE_URL) salir("DATABASE_URL no está configurada; no se pueden aplicar migraciones.")

// Las migraciones necesitan conexión directa (sin pooler). La integración
// Neon ↔ Vercel la expone como DATABASE_URL_UNPOOLED.
if (!env.DIRECT_URL) {
  const alternativa = env.DATABASE_URL_UNPOOLED ?? env.POSTGRES_URL_NON_POOLING
  if (!alternativa) salir("Falta DIRECT_URL (o DATABASE_URL_UNPOOLED) para correr migraciones.")
  env.DIRECT_URL = alternativa
  console.warn("⚠️  [migrate] DIRECT_URL no está configurada; se usa DATABASE_URL_UNPOOLED.")
}

const hostApp = hostDe(env.DATABASE_URL)
const hostDirecto = hostDe(env.DIRECT_URL)
if (!hostApp || !hostDirecto) salir("DATABASE_URL o DIRECT_URL no son URLs válidas.")
if (endpoint(hostApp) !== endpoint(hostDirecto)) {
  salir("DATABASE_URL y DIRECT_URL apuntan a endpoints distintos: revisá las variables del ambiente.")
}

// Guardas para no migrar producción desde un ambiente que no corresponde.
const hostProduccion = env.PRODUCTION_DATABASE_HOST?.trim().toLowerCase()
if (ambiente !== "production" && hostProduccion && endpoint(hostApp) === endpoint(hostProduccion)) {
  salir(`El ambiente "${ambiente}" apunta a la base de PRODUCCIÓN (${hostApp}). No se migra.`)
}
const hostPreview = env.PREVIEW_DATABASE_HOST?.trim().toLowerCase()
if (ambiente === "preview" && hostPreview && endpoint(hostApp) !== endpoint(hostPreview)) {
  salir(`El preview apunta a ${hostApp}, pero PREVIEW_DATABASE_HOST declara ${hostPreview}. No se migra.`)
}

if (env.SKIP_DB_MIGRATE === "1") {
  console.log(`⏭️  [migrate] SKIP_DB_MIGRATE=1: no se aplican migraciones en "${ambiente}".`)
  process.exit(0)
}

const run = (cmd) => execSync(cmd, { stdio: "inherit", env })

console.log(`🗄️  [migrate] Ambiente: ${ambiente} · base: ${hostApp}`)
console.log("🗄️  [migrate] Aplicando migraciones pendientes...")
run("prisma migrate deploy")

console.log("🗄️  [migrate] Aplicando constraints (idempotente)...")
run("prisma db execute --file prisma/constraints.sql --schema prisma/schema.prisma")

console.log("✅ [migrate] Base de datos al día")
