import { describe, it, expect } from "vitest"
import { scopeCatalogo, scopeOrganizacion } from "@/lib/api/tenant"
import { esCatalogoVisible } from "@/lib/utils"

describe("scopeCatalogo", () => {
  it("incluye los catálogos globales (organizacionId null) además de los de la org", () => {
    expect(scopeCatalogo(["org-1"])).toEqual({
      OR: [{ organizacionId: { in: ["org-1"] } }, { organizacionId: null }],
    })
  })

  it("scopeOrganizacion sigue excluyendo los globales (datos operativos)", () => {
    expect(scopeOrganizacion(["org-1"])).toEqual({ organizacionId: { in: ["org-1"] } })
  })
})

describe("esCatalogoVisible", () => {
  it("acepta globales y los de la organización activa, rechaza los de otra", () => {
    expect(esCatalogoVisible({ organizacionId: null }, "org-1")).toBe(true)
    expect(esCatalogoVisible({}, "org-1")).toBe(true)
    expect(esCatalogoVisible({ organizacionId: "org-1" }, "org-1")).toBe(true)
    expect(esCatalogoVisible({ organizacionId: "org-2" }, "org-1")).toBe(false)
  })
})
