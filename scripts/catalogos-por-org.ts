// ============================================
// Duplicar catálogos (Especie / Raza / Categoria) por organización
// y re-apuntar animales y lotes a la copia de SU organización.
//
// Necesario SOLO cuando hay más de una organización y los catálogos venían
// siendo globales (compartidos). Tras la reforma multi-tenant, cada org debe
// tener su propio juego de catálogos.
//
// Uso:
//   pnpm db:catalogos-por-org            # DRY-RUN: solo informa, no escribe
//   pnpm db:catalogos-por-org --apply    # aplica los cambios (con backup previo)
//
// Es idempotente (podés correrlo varias veces) y NO borra nada: las filas
// originales quedan intactas. Respeta .cursor/rules/seguridad-db.md.
// ============================================

import { prisma } from "../lib/prisma"

const APPLY = process.argv.includes("--apply")

type EspecieRow = { id: string; nombre: string; descripcion: string | null; organizacionId: string | null }
type RazaRow = { id: string; nombre: string; descripcion: string | null; especieId: string; organizacionId: string | null }
type CategoriaRow = {
  id: string
  nombre: string
  descripcion: string | null
  sexo: string | null
  edadMinMeses: number | null
  edadMaxMeses: number | null
  especieId: string
  organizacionId: string | null
}

async function main() {
  console.log(`=== Catálogos por organización (${APPLY ? "APPLY" : "DRY-RUN"}) ===\n`)

  const organizaciones = await prisma.organizacion.findMany({
    select: { id: true, nombre: true, establecimientos: { select: { id: true } } },
  })

  if (organizaciones.length <= 1) {
    console.log(
      "Hay una sola organización (o ninguna): no hace falta duplicar catálogos. " +
        "Usá `pnpm db:backfill-tenant` para el caso de organización única."
    )
    return
  }

  // Catálogo "plantilla" = todas las filas existentes, deduplicadas por nombre.
  const especies = (await prisma.especie.findMany()) as EspecieRow[]
  const razas = (await prisma.raza.findMany()) as RazaRow[]
  const categorias = (await prisma.categoria.findMany()) as CategoriaRow[]

  const especieNombreDeId = new Map(especies.map((e) => [e.id, e.nombre]))

  // Plantilla de especies por nombre (primera ocurrencia).
  const tplEspecies = new Map<string, EspecieRow>()
  for (const e of especies) if (!tplEspecies.has(e.nombre)) tplEspecies.set(e.nombre, e)

  // Plantilla de razas por (especieNombre → nombreRaza).
  const tplRazas = new Map<string, Map<string, RazaRow>>()
  for (const r of razas) {
    const espNombre = especieNombreDeId.get(r.especieId)
    if (!espNombre) continue
    if (!tplRazas.has(espNombre)) tplRazas.set(espNombre, new Map())
    const m = tplRazas.get(espNombre)!
    if (!m.has(r.nombre)) m.set(r.nombre, r)
  }

  // Plantilla de categorías por (especieNombre → nombreCategoria).
  const tplCategorias = new Map<string, Map<string, CategoriaRow>>()
  for (const c of categorias) {
    const espNombre = especieNombreDeId.get(c.especieId)
    if (!espNombre) continue
    if (!tplCategorias.has(espNombre)) tplCategorias.set(espNombre, new Map())
    const m = tplCategorias.get(espNombre)!
    if (!m.has(c.nombre)) m.set(c.nombre, c)
  }

  // Mapa establecimiento → organización (para re-apuntar animales).
  const orgDeEstablecimiento = new Map<string, string>()
  for (const org of organizaciones) {
    for (const est of org.establecimientos) orgDeEstablecimiento.set(est.id, org.id)
  }

  let totalEspeciesCreadas = 0
  let totalRazasCreadas = 0
  let totalCategoriasCreadas = 0

  // Guarda, por organización, el id de cada especie/raza/categoria por nombre.
  const especieIdPorOrg = new Map<string, Map<string, string>>() // org → (nombre → especieId)
  const razaIdPorOrg = new Map<string, Map<string, string>>() // org → (`${espNombre}||${razaNombre}` → razaId)
  const categoriaIdPorOrg = new Map<string, Map<string, string>>() // org → (`${espNombre}||${catNombre}` → categoriaId)

  const ejecutar = async (tx: typeof prisma) => {
    for (const org of organizaciones) {
      const espMap = new Map<string, string>()
      const razaMap = new Map<string, string>()
      const catMap = new Map<string, string>()
      especieIdPorOrg.set(org.id, espMap)
      razaIdPorOrg.set(org.id, razaMap)
      categoriaIdPorOrg.set(org.id, catMap)

      // 1) Especies
      for (const [nombre, tpl] of tplEspecies) {
        const existente = especies.find((e) => e.organizacionId === org.id && e.nombre === nombre)
        if (existente) {
          espMap.set(nombre, existente.id)
          continue
        }
        if (APPLY) {
          const creada = await tx.especie.create({
            data: { nombre, descripcion: tpl.descripcion, organizacionId: org.id },
          })
          espMap.set(nombre, creada.id)
        } else {
          espMap.set(nombre, `(nueva:${org.id}:${nombre})`)
        }
        totalEspeciesCreadas++
      }

      // 2) Razas (bajo la especie de esta org)
      for (const [espNombre, razasDeEsp] of tplRazas) {
        const espId = espMap.get(espNombre)
        if (!espId) continue
        for (const [razaNombre, tpl] of razasDeEsp) {
          const key = `${espNombre}||${razaNombre}`
          const existente = razas.find(
            (r) => r.organizacionId === org.id && r.especieId === espId && r.nombre === razaNombre
          )
          if (existente) {
            razaMap.set(key, existente.id)
            continue
          }
          if (APPLY) {
            const creada = await tx.raza.create({
              data: { nombre: razaNombre, descripcion: tpl.descripcion, especieId: espId, organizacionId: org.id },
            })
            razaMap.set(key, creada.id)
          } else {
            razaMap.set(key, `(nueva)`)
          }
          totalRazasCreadas++
        }
      }

      // 3) Categorías (bajo la especie de esta org)
      for (const [espNombre, catsDeEsp] of tplCategorias) {
        const espId = espMap.get(espNombre)
        if (!espId) continue
        for (const [catNombre, tpl] of catsDeEsp) {
          const key = `${espNombre}||${catNombre}`
          const existente = categorias.find(
            (c) => c.organizacionId === org.id && c.especieId === espId && c.nombre === catNombre
          )
          if (existente) {
            catMap.set(key, existente.id)
            continue
          }
          if (APPLY) {
            const creada = await tx.categoria.create({
              data: {
                nombre: catNombre,
                descripcion: tpl.descripcion,
                sexo: tpl.sexo,
                edadMinMeses: tpl.edadMinMeses,
                edadMaxMeses: tpl.edadMaxMeses,
                especieId: espId,
                organizacionId: org.id,
              },
            })
            catMap.set(key, creada.id)
          } else {
            catMap.set(key, `(nueva)`)
          }
          totalCategoriasCreadas++
        }
      }
    }

    // 4) Re-apuntar ANIMALES a la copia de su organización
    let animalesReapuntados = 0
    let animalesSinResolver = 0
    const animales = await tx.animal.findMany({
      select: { id: true, establecimientoId: true, especieId: true, razaId: true, categoriaId: true },
    })
    for (const a of animales) {
      if (!a.establecimientoId) {
        animalesSinResolver++
        continue
      }
      const orgId = orgDeEstablecimiento.get(a.establecimientoId)
      if (!orgId) {
        animalesSinResolver++
        continue
      }
      const espMap = especieIdPorOrg.get(orgId)!
      const razaMap = razaIdPorOrg.get(orgId)!
      const catMap = categoriaIdPorOrg.get(orgId)!

      const espNombre = especieNombreDeId.get(a.especieId)
      const nuevoEspId = espNombre ? espMap.get(espNombre) : undefined
      const data: Record<string, string> = {}
      if (nuevoEspId && nuevoEspId !== a.especieId) data.especieId = nuevoEspId

      if (a.razaId) {
        const razaOrig = razas.find((r) => r.id === a.razaId)
        const espNombreRaza = razaOrig ? especieNombreDeId.get(razaOrig.especieId) : undefined
        const nuevoRazaId = razaOrig && espNombreRaza ? razaMap.get(`${espNombreRaza}||${razaOrig.nombre}`) : undefined
        if (nuevoRazaId && nuevoRazaId !== a.razaId) data.razaId = nuevoRazaId
      }
      if (a.categoriaId) {
        const catOrig = categorias.find((c) => c.id === a.categoriaId)
        const espNombreCat = catOrig ? especieNombreDeId.get(catOrig.especieId) : undefined
        const nuevoCatId = catOrig && espNombreCat ? catMap.get(`${espNombreCat}||${catOrig.nombre}`) : undefined
        if (nuevoCatId && nuevoCatId !== a.categoriaId) data.categoriaId = nuevoCatId
      }

      if (Object.keys(data).length > 0) {
        if (APPLY) await tx.animal.update({ where: { id: a.id }, data })
        animalesReapuntados++
      }
    }

    // 5) Re-apuntar LOTES (solo especieId)
    let lotesReapuntados = 0
    const lotes = await tx.lote.findMany({
      select: { id: true, establecimientoId: true, especieId: true },
    })
    for (const l of lotes) {
      const orgId = orgDeEstablecimiento.get(l.establecimientoId)
      if (!orgId) continue
      const espMap = especieIdPorOrg.get(orgId)!
      const espNombre = especieNombreDeId.get(l.especieId)
      const nuevoEspId = espNombre ? espMap.get(espNombre) : undefined
      if (nuevoEspId && nuevoEspId !== l.especieId) {
        if (APPLY) await tx.lote.update({ where: { id: l.id }, data: { especieId: nuevoEspId } })
        lotesReapuntados++
      }
    }

    console.log(`Organizaciones: ${organizaciones.length}`)
    console.log(`Especies a crear:    ${totalEspeciesCreadas}`)
    console.log(`Razas a crear:       ${totalRazasCreadas}`)
    console.log(`Categorías a crear:  ${totalCategoriasCreadas}`)
    console.log(`Animales a re-apuntar: ${animalesReapuntados}`)
    console.log(`Lotes a re-apuntar:    ${lotesReapuntados}`)
    if (animalesSinResolver > 0) {
      console.log(
        `⚠️  Animales sin organización resoluble (sin establecimiento): ${animalesSinResolver} ` +
          `— correr antes 'pnpm db:backfill-tenant'.`
      )
    }
  }

  if (APPLY) {
    await prisma.$transaction((tx) => ejecutar(tx as typeof prisma), { timeout: 120_000 })
    console.log("\n✅ Aplicado. Revisá los catálogos por organización antes de endurecer a NOT NULL.")
  } else {
    await ejecutar(prisma)
    console.log("\nDRY-RUN: no se escribió nada. Volvé a correr con --apply para aplicar (con backup previo).")
  }
}

main()
  .catch((error) => {
    console.error("Error en catalogos-por-org:", error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
