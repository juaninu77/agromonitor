export type DeploymentEnvironment = "development" | "test" | "preview" | "production"
type Variables = Record<string, string | undefined>

export function getDeploymentEnvironment(env: Variables): DeploymentEnvironment {
  if (env.VERCEL_ENV === "preview") return "preview"
  if (env.VERCEL_ENV === "production") return "production"
  if (env.APP_ENV === "preview") return "preview"
  if (env.NODE_ENV === "test") return "test"
  return env.NODE_ENV === "production" ? "production" : "development"
}

export interface EnvironmentIssue {
  level: "error" | "warning"
  variable: string
  message: string
}
const endpoint = (hostname: string) => hostname.replace(/-pooler(?=\.)/, "")

/** Reports problems without returning credentials or connection URLs. */
export function inspectDeploymentEnvironment(env: Variables): EnvironmentIssue[] {
  const issues: EnvironmentIssue[] = []
  const add = (variable: string, message: string, level: EnvironmentIssue["level"] = "error") =>
    issues.push({ variable, message, level })
  const connections = new Map<string, URL>()
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    if (!env[key]) { add(key, "No configurada"); continue }
    try {
      const url = new URL(env[key])
      if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length <= 1) {
        add(key, "Debe ser una conexión PostgreSQL con host y base de datos")
        continue
      }
      connections.set(key, url)
      if (url.hostname.endsWith(".neon.tech")) {
        if (!["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? "")) {
          add(key, "La conexión Neon debe conservar sslmode=require o una verificación más estricta")
        }
        if (key === "DIRECT_URL" && url.hostname.includes("-pooler.")) {
          add(key, "Usá el endpoint directo de Neon, sin -pooler en el host")
        }
      }
    } catch { add(key, "URL de conexión inválida") }
  }
  const database = connections.get("DATABASE_URL")
  const direct = connections.get("DIRECT_URL")
  if (database && direct && (endpoint(database.hostname) !== endpoint(direct.hostname) || database.pathname !== direct.pathname)) {
    add("DIRECT_URL", "La aplicación y las migraciones apuntan a endpoints o bases distintos")
  }
  if (!(env.AUTH_SECRET || env.NEXTAUTH_SECRET)) add("AUTH_SECRET", "No configurado (también se admite NEXTAUTH_SECRET)")
  if (getDeploymentEnvironment(env) === "preview") {
    const expected = env.PREVIEW_DATABASE_HOST?.trim().toLowerCase()
    if (!expected) add("PREVIEW_DATABASE_HOST", "Falta el host de la rama de pruebas confirmado en Neon")
    else if (!/^[a-z0-9.-]+$/.test(expected)) add("PREVIEW_DATABASE_HOST", "Debe contener solo el host, sin usuario, contraseña ni ruta")
    else if (database && endpoint(database.hostname) !== endpoint(expected)) add("DATABASE_URL", "La conexión no coincide con el host de pruebas declarado")
    add("preview", "La coincidencia del host no demuestra aislamiento: confirmar en Neon que la rama no sea producción", "warning")
  }
  return issues
}
