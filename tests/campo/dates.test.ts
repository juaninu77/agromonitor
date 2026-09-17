import { describe, it, expect } from "vitest"
import { formatDate } from "@/lib/utils/formatters"

describe("Fechas de calendario del campo",()=>{
  it("mantiene el día de una pesada serializada desde PostgreSQL DATE",()=>expect(formatDate("2026-09-14T00:00:00.000Z")).toBe("14/9/2026"))
  it("mantiene una fecha sin hora",()=>expect(formatDate("2024-02-29")).toBe("29/2/2024"))
  it("mantiene el día en formato largo",()=>expect(formatDate("2026-01-01T00:00:00.000Z","long")).toBe("1 de enero de 2026"))
})
