import { loadEnvConfig } from "@next/env"
import { getDeploymentEnvironment, inspectDeploymentEnvironment } from "../lib/config/deployment"

// Same .env loading rules as Next.js. Never print connection strings.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test")
console.log(`AgroMonitor · entorno: ${getDeploymentEnvironment(process.env)}`)
const issues = inspectDeploymentEnvironment(process.env)
for (const issue of issues) {
  console.log(`${issue.level === "error" ? "ERROR" : "AVISO"} ${issue.variable}: ${issue.message}`)
}
if (issues.some((issue) => issue.level === "error")) process.exitCode = 1
else console.log("Configuración básica válida. Esto no comprueba conexión, permisos ni esquema en la base real.")
