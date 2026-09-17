import { describe, expect, it } from "vitest"
import { supplierCandidate, uniqueCandidate } from "@/lib/db/backfill-candidates"

describe("asignación conservadora de registros históricos", () => {
  it("no inventa un campo sin evidencias", () => expect(uniqueCandidate([null, undefined])).toBeNull())
  it("acepta evidencias coincidentes", () => expect(uniqueCandidate(["campo-a", "campo-a"])).toBe("campo-a"))
  it("deja pendientes las evidencias contradictorias", () => expect(uniqueCandidate(["campo-a", "campo-b"])).toBeNull())
  const suppliers = [
    { id: "a", nombre: "Proveedor", organizacionId: "org-a" },
    { id: "b", nombre: "Proveedor", organizacionId: "org-b" },
  ]
  it("no vincula proveedores de otra organización", () => expect(supplierCandidate(" proveedor ", "org-a", suppliers)).toBe("a"))
  it("no asigna un proveedor sin organización del producto", () => expect(supplierCandidate("Proveedor", null, suppliers)).toBeNull())
  it("no elige arbitrariamente entre proveedores homónimos", () => expect(supplierCandidate("Proveedor", "org-a", [...suppliers, { ...suppliers[0], id: "c" }])).toBeNull())
})
