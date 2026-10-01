import { describe, expect, it } from "vitest"
import {
  callbackUrlSeguro,
  loginSchema,
  mensajeErrorLogin,
  registerApiSchema,
  registerFormSchema,
} from "@/lib/validations/auth-schema"

const registroValido = {
  nombre: "Juan",
  apellido: "Pérez",
  email: "  Juan.Perez@Gmail.com ",
  telefono: "",
  password: "vacas2026",
}

describe("auth-schema", () => {
  it("normaliza el email a minúsculas y sin espacios", () => {
    const parsed = loginSchema.parse({ email: " Juan@Gmail.COM ", password: "x" })
    expect(parsed.email).toBe("juan@gmail.com")
  })

  it("exige letra, número y 8 caracteres en el registro", () => {
    expect(registerApiSchema.safeParse({ ...registroValido, password: "corta1" }).success).toBe(false)
    expect(registerApiSchema.safeParse({ ...registroValido, password: "soloLetras" }).success).toBe(false)
    expect(registerApiSchema.safeParse({ ...registroValido, password: "12345678" }).success).toBe(false)
    const ok = registerApiSchema.parse(registroValido)
    expect(ok.email).toBe("juan.perez@gmail.com")
    expect(ok.telefono).toBeUndefined()
  })

  it("marca la confirmación cuando no coincide", () => {
    const result = registerFormSchema.safeParse({ ...registroValido, confirmPassword: "otra1234" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"])
  })

  it("solo acepta callbackUrl internas", () => {
    expect(callbackUrlSeguro("/ganado?tab=1")).toBe("/ganado?tab=1")
    expect(callbackUrlSeguro("https://evil.com")).toBe("/")
    expect(callbackUrlSeguro("//evil.com")).toBe("/")
    expect(callbackUrlSeguro("/\\evil.com")).toBe("/")
    expect(callbackUrlSeguro("/login")).toBe("/")
    expect(callbackUrlSeguro(null)).toBe("/")
  })

  it("distingue credenciales inválidas de fallas del servidor", () => {
    expect(mensajeErrorLogin("CredentialsSignin", "credenciales_invalidas")).toMatch(/incorrectos/)
    expect(mensajeErrorLogin("CredentialsSignin", "servicio_no_disponible")).toMatch(/servidor/)
    expect(mensajeErrorLogin("Configuration")).toMatch(/servidor/)
    expect(mensajeErrorLogin("CredentialsSignin", "cuenta_inactiva")).toMatch(/desactivada/)
  })
})
