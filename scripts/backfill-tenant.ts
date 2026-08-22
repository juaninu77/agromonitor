// ============================================
// Backfill de scoping multi-tenant.
// Ejecutar con: pnpm db:backfill-tenant (o con dotenv -e .env.<ambiente>)
//
// Solo completa columnas NUEVAS que estén en NULL — nunca pisa valores
// existentes ni borra nada (cumple .cursor/rules/seguridad-db.md).
// Correr DESPUÉS de `pnpm db:push` con el schema actualizado.
// ============================================

import { prisma } from "../lib/prisma"

async function backfillAnimales() {
  const sinEstablecimiento = await prisma.animal.findMany({
    where: { establecimientoId: null },
    select: {
      id: true,
      ubicacionHist: {
        orderBy: { desde: "desc" },
        take: 1,
        select: { sector: { select: { establecimientoId: true } } },
      },
      loteHist: {
        orderBy: { desde: "desc" },
        take: 1,
        select: { lote: { select: { establecimientoId: true } } },
      },
    },
  })

  const establecimientos = await prisma.establecimiento.findMany({
    select: { id: true },
  })
  const unicoEstablecimiento =
    establecimientos.length === 1 ? establecimientos[0].id : null

  let asignados = 0
  let sinResolver = 0

  for (const animal of sinEstablecimiento) {
    const desdeUbicacion = animal.ubicacionHist[0]?.sector.establecimientoId
    const desdeLote = animal.loteHist[0]?.lote.establecimientoId
    const destino = desdeUbicacion ?? desdeLote ?? unicoEstablecimiento

    if (destino) {
      await prisma.animal.update({
        where: { id: animal.id },
        data: { establecimientoId: destino },
      })
      asignados++
    } else {
      sinResolver++
    }
  }

  console.log(`Animales: ${asignados} asignados, ${sinResolver} sin resolver (requieren asignación manual)`)
}

async function backfillPorOrganizacionUnica() {
  const organizaciones = await prisma.organizacion.findMany({ select: { id: true } })
  if (organizaciones.length !== 1) {
    const productos = await prisma.producto.count({ where: { organizacionId: null } })
    const dietas = await prisma.dieta.count({ where: { organizacionId: null } })
    console.log(
      `Hay ${organizaciones.length} organizaciones: no se puede asignar automáticamente ` +
        `organizacionId a ${productos} productos y ${dietas} dietas — asignar manualmente.`
    )
    return
  }

  const orgId = organizaciones[0].id
  const productos = await prisma.producto.updateMany({
    where: { organizacionId: null },
    data: { organizacionId: orgId },
  })
  const dietas = await prisma.dieta.updateMany({
    where: { organizacionId: null },
    data: { organizacionId: orgId },
  })
  console.log(`Productos: ${productos.count} asignados a la organización única`)
  console.log(`Dietas: ${dietas.count} asignadas a la organización única`)
}

async function backfillDocumentosTransito() {
  const pendientes = await prisma.documentoTransito.findMany({
    where: { establecimientoId: null },
    select: { id: true, renspaOrigen: true },
  })

  const establecimientos = await prisma.establecimiento.findMany({
    select: { id: true, renspa: true },
  })
  const porRenspa = new Map(
    establecimientos.filter((e) => e.renspa).map((e) => [e.renspa as string, e.id])
  )
  const unico = establecimientos.length === 1 ? establecimientos[0].id : null

  let asignados = 0
  let sinResolver = 0
  for (const doc of pendientes) {
    const destino = porRenspa.get(doc.renspaOrigen) ?? unico
    if (destino) {
      await prisma.documentoTransito.update({
        where: { id: doc.id },
        data: { establecimientoId: destino },
      })
      asignados++
    } else {
      sinResolver++
    }
  }
  console.log(`Documentos de tránsito: ${asignados} asignados, ${sinResolver} sin resolver`)
}

async function backfillProveedoresLoteProducto() {
  const pendientes = await prisma.loteProducto.findMany({
    where: { proveedorId: null, proveedor: { not: null } },
    select: { id: true, proveedor: true },
  })
  if (pendientes.length === 0) {
    console.log("Lotes de producto: nada que asignar")
    return
  }

  const proveedores = await prisma.proveedor.findMany({
    select: { id: true, nombre: true },
  })
  const porNombre = new Map(
    proveedores.map((p) => [p.nombre.trim().toLowerCase(), p.id])
  )

  let asignados = 0
  for (const lote of pendientes) {
    const proveedorId = porNombre.get((lote.proveedor as string).trim().toLowerCase())
    if (proveedorId) {
      await prisma.loteProducto.update({
        where: { id: lote.id },
        data: { proveedorId },
      })
      asignados++
    }
  }
  console.log(`Lotes de producto: ${asignados}/${pendientes.length} vinculados a Proveedor por nombre`)
}

async function main() {
  console.log("=== Backfill de tenant (solo completa NULLs, no modifica datos existentes) ===")
  await backfillAnimales()
  await backfillPorOrganizacionUnica()
  await backfillDocumentosTransito()
  await backfillProveedoresLoteProducto()
  console.log("=== Backfill terminado ===")
}

main()
  .catch((error) => {
    console.error("Error en backfill:", error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
