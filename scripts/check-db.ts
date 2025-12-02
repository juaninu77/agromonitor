import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📊 Verificando datos en la base de datos...\n')
  
  const counts = {
    usuarios: await prisma.usuario.count(),
    organizaciones: await prisma.organizacion.count(),
    establecimientos: await prisma.establecimiento.count(),
    sectores: await prisma.sector.count(),
    lotes: await prisma.lote.count(),
    animales: await prisma.animal.count(),
    especies: await prisma.especie.count(),
    razas: await prisma.raza.count(),
    categorias: await prisma.categoria.count(),
    pesadas: await prisma.evtPesada.count(),
    sanidad: await prisma.evtSanidad.count(),
    servicios: await prisma.evtServicio.count(),
    tactos: await prisma.evtTacto.count(),
  }
  
  console.log('Conteo de registros:')
  for (const [tabla, count] of Object.entries(counts)) {
    console.log(`  ${tabla}: ${count}`)
  }
  
  // Verificar usuario demo
  const user = await prisma.usuario.findFirst({ where: { email: 'demo@agromonitor.com' } })
  console.log('\n✅ Usuario demo existe:', user ? 'Sí' : 'No')
  if (user) {
    console.log('   Email:', user.email)
    console.log('   Nombre:', user.nombre, user.apellido)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())


