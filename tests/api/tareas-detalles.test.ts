import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const m = vi.hoisted(() => ({
  tarea: vi.fn(), borrar: vi.fn(), actualizar: vi.fn(), audit: vi.fn(), count: vi.fn(), lista: vi.fn(), porEstado: vi.fn(), sync: vi.fn(),
  dte: vi.fn(), ctx: {} as Record<string, unknown>,
}))
vi.mock("@/lib/api/with-auth", () => ({ withAuth: (handler: Function) => (request: unknown) => handler(request, m.ctx) }))
vi.mock("@/lib/api/audit-log", () => ({ logAudit: m.audit }))
vi.mock("@/lib/reproduccion/agenda", () => ({ sincronizarSiHaceFalta: m.sync }))
vi.mock("@/lib/sanidad/retiro", () => ({ avisoRetiroDte: async () => null }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tarea: { findFirst: m.tarea, delete: m.borrar, update: m.actualizar, count: m.count, findMany: m.lista, groupBy: m.porEstado },
    documentoTransito: { findUnique: m.dte, create: async ({ data }: { data: object }) => ({ id: "D1", ...data }) },
  },
}))
import { DELETE, PATCH } from "@/app/api/tareas/[id]/route"
import { GET } from "@/app/api/tareas/route"
import { POST as crearDte } from "@/app/api/ventas/documentos/route"

const EST = "00000000-0000-4000-8000-000000000001"
const req = (url = "http://localhost/x", init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(url, init)
const ctx = { params: Promise.resolve({}) }

beforeEach(() => {
  vi.resetAllMocks()
  m.ctx = { userId: "u1", params: { id: "T1" }, establecimientoIds: [EST], organizacionDeEstablecimiento: { [EST]: "o1" }, establecimientoIdsConRol: () => [EST] }
})

describe("cancelar tareas", () => {
  it("ninguna tarea se borra: las manuales y las del plan o la agenda se cancelan", async () => {
    m.tarea.mockResolvedValue({ id: "T1", titulo: "Arreglar alambrado", estado: "pendiente", establecimientoId: EST, calendarioSanitarioId: null, itemProtocoloId: null, claveReproduccion: null })
    expect(await (await DELETE(req(), ctx)).json()).toMatchObject({ success: true, cancelada: true })
    m.tarea.mockResolvedValue({ id: "T1", titulo: "Tacto torada", estado: "en_progreso", establecimientoId: EST, claveReproduccion: "tacto:torada:X" })
    expect(await (await DELETE(req(), ctx)).json()).toMatchObject({ success: true, cancelada: true })
    expect(m.actualizar).toHaveBeenCalledTimes(2)
    expect(m.actualizar).toHaveBeenCalledWith({ where: { id: "T1" }, data: { estado: "cancelada", fechaCompletada: null } })
    expect(m.borrar).not.toHaveBeenCalled()
    expect(m.audit.mock.calls[0][0]).toMatchObject({ accion: "UPDATE", detalle: { cancelada: true, estadoAnterior: "pendiente" } })
  })

  it("una completada no se cancela y una ya cancelada no cambia", async () => {
    m.tarea.mockResolvedValue({ id: "T1", titulo: "Vacunar", estado: "completada", establecimientoId: EST })
    expect((await DELETE(req(), ctx)).status).toBe(409)
    m.tarea.mockResolvedValue({ id: "T1", titulo: "Vacunar", estado: "cancelada", establecimientoId: EST })
    expect(await (await DELETE(req(), ctx)).json()).toMatchObject({ success: true, cancelada: true })
    expect(m.actualizar).not.toHaveBeenCalled()
  })

  it("cancelar por PATCH exige administrador o encargado del campo", async () => {
    m.tarea.mockResolvedValue({ id: "T1", titulo: "Vacunar", estado: "pendiente", establecimientoId: EST })
    m.ctx.establecimientoIdsConRol = () => []
    const patch = (estado: string) => PATCH(req("http://localhost/x", { method: "PATCH", body: JSON.stringify({ estado }) }), ctx)
    expect((await patch("cancelada")).status).toBe(403)
    m.actualizar.mockResolvedValue({ id: "T1", establecimientoId: EST })
    expect((await patch("en_progreso")).status).toBe(200)
    expect(m.actualizar).toHaveBeenCalledOnce()
  })
})

describe("listado de tareas", () => {
  it("devuelve los conteos por estado de todas las páginas, sin el filtro de estado", async () => {
    m.count.mockResolvedValue(30); m.lista.mockResolvedValue([])
    m.porEstado.mockResolvedValue([{ estado: "pendiente", _count: { _all: 20 } }, { estado: "completada", _count: { _all: 10 } }])
    const r = await GET(req(`http://localhost/api/tareas?estado=pendiente&tipo=general`), ctx)
    expect((await r.json()).conteos).toEqual({ pendiente: 20, completada: 10 })
    expect(m.porEstado.mock.calls[0][0].where).toMatchObject({ tipo: "general" })
    expect(m.porEstado.mock.calls[0][0].where.estado).toBeUndefined()
  })
})

describe("documento de tránsito", () => {
  const base = { numeroDta: "123", renspaOrigen: "A", renspaDestino: "B", especie: "bovino", establecimientoId: EST, fechaEmision: "2026-10-10" }
  it("exige el vencimiento con un mensaje claro y que no sea anterior a la emisión", async () => {
    const post = (b: object) => crearDte(req("http://localhost/api/ventas/documentos", { method: "POST", body: JSON.stringify(b) }), ctx)
    const sin = await post(base)
    expect(sin.status).toBe(400)
    expect((await sin.json()).error).toMatch(/vencimiento/)
    expect((await post({ ...base, fechaVencimiento: "2026-10-01" })).status).toBe(400)
    m.dte.mockResolvedValue(null)
    expect((await post({ ...base, fechaVencimiento: "2026-10-20" })).status).toBe(201)
  })
})
