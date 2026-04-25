/**
 * Script para limpiar registros con UUIDs corruptos
 * Ejecutar con: npx tsx scripts/fix-uuid-corruption.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
})

async function main() {
  console.log('🔍 Verificando registros con UUIDs corruptos...\n')

  try {
    // Intentar obtener todas las membresías sin filtrar por usuario
    const allMembresias = await prisma.$queryRaw`
      SELECT id, usuario_id, organizacion_id, rol, es_activo
      FROM membresias
      LIMIT 100
    `

    console.log('📋 Membresías encontradas:')
    console.log(allMembresias)
    console.log('\n')

    // Verificar usuarios
    const allUsuarios = await prisma.$queryRaw`
      SELECT id, email, nombre, apellido
      FROM usuarios
      LIMIT 100
    `

    console.log('👤 Usuarios encontrados:')
    console.log(allUsuarios)
    console.log('\n')

    // Encontrar membresías con usuario_id inválido
    const corruptMembresias = await prisma.$queryRaw`
      SELECT m.id, m.usuario_id, m.organizacion_id
      FROM membresias m
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE u.id IS NULL
    `

    if (Array.isArray(corruptMembresias) && corruptMembresias.length > 0) {
      console.log(`⚠️  Encontradas ${corruptMembresias.length} membresías con usuario_id inválido:`)
      console.log(corruptMembresias)
      console.log('\n')

      console.log('🗑️  Eliminando membresías corruptas...')

      for (const membresia of corruptMembresias as any[]) {
        await prisma.$executeRaw`
          DELETE FROM membresias WHERE id = ${membresia.id}
        `
        console.log(`   ✓ Eliminada membresía ${membresia.id}`)
      }

      console.log('\n✅ Limpieza completada!')
    } else {
      console.log('✅ No se encontraron membresías corruptas')
    }

    // Verificar organizaciones huérfanas
    const orphanOrgs = await prisma.$queryRaw`
      SELECT o.id, o.nombre
      FROM organizaciones o
      LEFT JOIN membresias m ON o.id = m.organizacion_id
      WHERE m.id IS NULL
    `

    if (Array.isArray(orphanOrgs) && orphanOrgs.length > 0) {
      console.log(`\n⚠️  Encontradas ${orphanOrgs.length} organizaciones sin membresías:`)
      console.log(orphanOrgs)
    }

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  }
}

main()
  .catch((error) => {
    console.error('Error fatal:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
