import { describe, expect, it } from "vitest"
import { getDeploymentEnvironment, inspectDeploymentEnvironment } from "@/lib/config/deployment"

const env = {
  DATABASE_URL: "postgresql://user:sensitive@ep-test-pooler.region.aws.neon.tech/neondb?sslmode=require",
  DIRECT_URL: "postgresql://user:sensitive@ep-test.region.aws.neon.tech/neondb?sslmode=require",
  AUTH_SECRET: "private-secret",
}
const errors = (values: Record<string, string | undefined>) => inspectDeploymentEnvironment(values).filter((issue) => issue.level === "error")
describe("configuración de preview", () => {
  it("distingue preview aunque Next compile en production", () => {
    expect(getDeploymentEnvironment({ NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe("preview")
  })
  it("acepta URLs directa y agrupada del mismo endpoint", () => { expect(errors(env)).toEqual([]) })
  it("no imprime secretos ni cadenas de conexión", () => {
    const output = JSON.stringify(inspectDeploymentEnvironment({ ...env, VERCEL_ENV: "preview" }))
    expect(output).not.toContain("sensitive")
    expect(output).not.toContain("private-secret")
    expect(output).not.toContain("postgresql://")
  })
  it("exige declarar el host de preview", () => {
    expect(errors({ ...env, VERCEL_ENV: "preview" })).toContainEqual(expect.objectContaining({ variable: "PREVIEW_DATABASE_HOST" }))
  })
  it("rechaza conexiones de preview hacia otro endpoint", () => {
    expect(errors({ ...env, VERCEL_ENV: "preview", PREVIEW_DATABASE_HOST: "ep-other.region.aws.neon.tech" })).toContainEqual(expect.objectContaining({ variable: "DATABASE_URL" }))
  })
  it("acepta el host esperado sin afirmar que auditó Neon", () => {
    const values = { ...env, VERCEL_ENV: "preview", PREVIEW_DATABASE_HOST: "ep-test.region.aws.neon.tech" }
    expect(errors(values)).toEqual([])
    expect(inspectDeploymentEnvironment(values)).toContainEqual(expect.objectContaining({ level: "warning" }))
  })
  it("rechaza conexiones hacia distintas bases", () => { expect(errors({ ...env, DIRECT_URL: env.DIRECT_URL.replace("/neondb?", "/other?") })).toHaveLength(1) })
  it("rechaza Neon sin TLS", () => { expect(errors({ ...env, DIRECT_URL: env.DIRECT_URL.split("?")[0] })).toHaveLength(1) })
  it("rechaza pooling en la conexión de migraciones", () => { expect(errors({ ...env, DIRECT_URL: env.DATABASE_URL })).toHaveLength(1) })
  it("acepta el nombre histórico del secreto", () => { expect(errors({ ...env, AUTH_SECRET: undefined, NEXTAUTH_SECRET: "legacy-secret" })).toEqual([]) })
  it("rechaza URLs mal formadas", () => { expect(errors({ ...env, DATABASE_URL: "invalid" })).toHaveLength(1) })
})
