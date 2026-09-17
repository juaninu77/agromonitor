import { describe, expect, it } from "vitest"
import { authConfig } from "@/auth.config"
import { NextRequest } from "next/server"

describe("autenticación en middleware Edge", () => {
  it("rechaza tokens corruptos sin intentar reparar usuarios desde el middleware", async () => {
    expect(await authConfig.callbacks.jwt({ token: { id: "invalid", email: "test@example.invalid" } } as any)).toBeNull()
  })
  it("conserva la sesión válida", async () => {
    const token = { id: "00112233-4455-4677-8899-aabbccddeeff" }
    expect(await authConfig.callbacks.jwt({ token } as any)).toEqual(token)
  })
  it("devuelve 401 JSON para una API sin sesión", async () => {
    const response = authConfig.callbacks.authorized({ auth: null, request: new NextRequest("http://localhost/api/ganado/bovinos") } as any) as Response
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "No autenticado" })
  })
})
