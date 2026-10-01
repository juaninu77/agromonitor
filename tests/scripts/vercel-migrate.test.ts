import { describe, expect, it } from "vitest"
import { spawnSync } from "node:child_process"
import path from "node:path"

const script = path.resolve(__dirname, "../../scripts/vercel-migrate.mjs")
const run = (env: Record<string, string>) =>
  spawnSync(process.execPath, [script], { env: { PATH: process.env.PATH, NODE_ENV: "test", ...env }, encoding: "utf8" })

const pooled = "postgresql://u:sensitive@ep-abc-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
const direct = "postgresql://u:sensitive@ep-abc.us-east-2.aws.neon.tech/neondb?sslmode=require"

describe("scripts/vercel-migrate.mjs (guardas previas a migrar)", () => {
  it("falla sin DATABASE_URL", () => {
    const r = run({})
    expect(r.status).toBe(1)
    expect(r.stderr).toContain("DATABASE_URL")
  })
  it("no migra producción desde preview", () => {
    const r = run({ VERCEL_ENV: "preview", DATABASE_URL: pooled, DIRECT_URL: direct, PRODUCTION_DATABASE_HOST: "ep-abc.us-east-2.aws.neon.tech" })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain("PRODUCCIÓN")
    expect(r.stderr).not.toContain("sensitive")
  })
  it("exige que el preview coincida con PREVIEW_DATABASE_HOST", () => {
    const r = run({ VERCEL_ENV: "preview", DATABASE_URL: pooled, DIRECT_URL: direct, PREVIEW_DATABASE_HOST: "ep-otra.us-east-2.aws.neon.tech" })
    expect(r.status).toBe(1)
  })
  it("rechaza endpoints distintos entre app y migraciones", () => {
    const r = run({ DATABASE_URL: pooled, DIRECT_URL: direct.replace("ep-abc", "ep-zzz") })
    expect(r.status).toBe(1)
  })
  it("acepta DATABASE_URL_UNPOOLED y respeta SKIP_DB_MIGRATE", () => {
    const r = run({ VERCEL_ENV: "preview", DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: direct, SKIP_DB_MIGRATE: "1" })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain("SKIP_DB_MIGRATE")
    expect(r.stdout).not.toContain("sensitive")
  })
})
