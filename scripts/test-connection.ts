import { PrismaClient } from '@prisma/client'

async function testConnection() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔌 Probando conexión a la base de datos...')
    
    // Intentar ejecutar un query simple
    const result = await prisma.$queryRaw`SELECT current_database() as db, current_schema() as schema`
    console.log('✅ Conexión exitosa!')
    console.log('DB info:', JSON.stringify(result))
    
    // Listar tablas existentes
    const tables: any[] = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
    console.log('\n📋 Tablas existentes en public:')
    tables.forEach((t: any) => console.log('  -', t.table_name))
    
    if (tables.length === 0) {
      console.log('  (ninguna tabla encontrada)')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()

