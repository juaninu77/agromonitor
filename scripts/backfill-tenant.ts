// Primero revisar el plan: pnpm db:backfill-tenant
// Aplicar solo sobre una base reconciliada, con backup y autorización:
// pnpm db:backfill-tenant --apply
import { prisma } from "../lib/prisma"
import { supplierCandidate, uniqueCandidate } from "../lib/db/backfill-candidates"

const apply = process.argv.includes("--apply")

async function backfillAnimales() {
  const animals = await prisma.animal.findMany({
    where: { establecimientoId: null },
    select: {
      id: true,
      ubicacionHist: { where: { hasta: null }, select: { sector: { select: { establecimientoId: true } } } },
      loteHist: { where: { hasta: null }, select: { lote: { select: { establecimientoId: true } } } },
    },
  })
  let planned = 0
  let changed = 0
  for (const animal of animals) {
    const destination = uniqueCandidate([
      ...animal.ubicacionHist.map((h) => h.sector.establecimientoId),
      ...animal.loteHist.map((h) => h.lote.establecimientoId),
    ])
    if (!destination) continue
    planned++
    if (apply) changed += (await prisma.animal.updateMany({
      where: { id: animal.id, establecimientoId: null },
      data: { establecimientoId: destination },
    })).count
  }
  console.log(`Animales: ${planned} asignaciones propuestas, ${animals.length - planned} sin resolver, ${changed} aplicadas`)
}

async function backfillPorOrganizacionUnica() {
  const organizations = await prisma.organizacion.findMany({ select: { id: true } })
  const counts = {
    productos: await prisma.producto.count({ where: { organizacionId: null } }),
    dietas: await prisma.dieta.count({ where: { organizacionId: null } }),
    especies: await prisma.especie.count({ where: { organizacionId: null } }),
    razas: await prisma.raza.count({ where: { organizacionId: null } }),
    categorias: await prisma.categoria.count({ where: { organizacionId: null } }),
  }
  console.log("Registros pendientes por organización:", counts)
  if (organizations.length !== 1) {
    console.log(`Hay ${organizations.length} organizaciones: se requiere resolver pertenencia y catálogos compartidos. No se asignan automáticamente.`)
    return
  }
  if (!apply) return
  const args = { where: { organizacionId: null }, data: { organizacionId: organizations[0].id } }
  await prisma.$transaction([
    prisma.producto.updateMany(args), prisma.dieta.updateMany(args),
    prisma.especie.updateMany(args), prisma.raza.updateMany(args), prisma.categoria.updateMany(args),
  ])
}

async function backfillDocumentosTransito() {
  const documents = await prisma.documentoTransito.findMany({
    where: { establecimientoId: null },
    select: { id: true, renspaOrigen: true, renspaDestino: true },
  })
  const fields = await prisma.establecimiento.findMany({ select: { id: true, renspa: true } })
  let planned = 0
  let changed = 0
  for (const document of documents) {
    // Si ambos extremos son campos distintos del sistema, el documento requiere
    // una decisión explícita de pertenencia; no elegimos el primero.
    const destination = uniqueCandidate(fields.filter((field) => field.renspa &&
      [document.renspaOrigen, document.renspaDestino].includes(field.renspa)).map((field) => field.id))
    if (!destination) continue
    planned++
    if (apply) changed += (await prisma.documentoTransito.updateMany({
      where: { id: document.id, establecimientoId: null }, data: { establecimientoId: destination },
    })).count
  }
  console.log(`Documentos: ${planned} asignaciones propuestas, ${documents.length - planned} sin resolver, ${changed} aplicadas`)
}

async function backfillProveedoresLoteProducto() {
  const lots = await prisma.loteProducto.findMany({
    where: { proveedorId: null, proveedor: { not: null } },
    select: { id: true, proveedor: true, producto: { select: { organizacionId: true } } },
  })
  const suppliers = await prisma.proveedor.findMany({ select: { id: true, nombre: true, organizacionId: true } })
  let planned = 0
  let changed = 0
  for (const lot of lots) {
    const supplierId = supplierCandidate(lot.proveedor ?? "", lot.producto.organizacionId, suppliers)
    if (!supplierId) continue
    planned++
    if (apply) changed += (await prisma.loteProducto.updateMany({
      where: { id: lot.id, proveedorId: null }, data: { proveedorId: supplierId },
    })).count
  }
  console.log(`Lotes de producto: ${planned} asignaciones propuestas, ${lots.length - planned} sin resolver, ${changed} aplicadas`)
}

async function main() {
  console.log(apply ? "Modo APLICAR: completa relaciones vacías; ejecutar en ventana sin escrituras concurrentes." : "Modo PLAN: solo lectura. No se modifica ninguna fila.")
  await backfillAnimales()
  await backfillPorOrganizacionUnica()
  await backfillDocumentosTransito()
  await backfillProveedoresLoteProducto()
}
main().catch(() => {
  console.error("No se pudo completar el backfill. Verificar conexión, permisos y coincidencia del esquema; no se muestran credenciales.")
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
