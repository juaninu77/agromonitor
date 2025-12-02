/**
 * Script para configurar y verificar el ambiente de producción
 * 
 * Uso: npx tsx scripts/setup-production.ts
 * 
 * Este script:
 * 1. Verifica que exista .env.production
 * 2. Valida las variables de entorno
 * 3. Ejecuta el seed si la base de datos está vacía
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(color: string, ...args: any[]) {
  console.log(color, ...args, colors.reset)
}

function success(...args: any[]) { log(colors.green, '✅', ...args) }
function error(...args: any[]) { log(colors.red, '❌', ...args) }
function warn(...args: any[]) { log(colors.yellow, '⚠️', ...args) }
function info(...args: any[]) { log(colors.blue, 'ℹ️', ...args) }
function step(...args: any[]) { log(colors.cyan, '→', ...args) }

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function ask(question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve))
}

async function main() {
  console.log('')
  console.log('═'.repeat(60))
  console.log('🚀 CONFIGURACIÓN DE PRODUCCIÓN - AgroMonitor')
  console.log('═'.repeat(60))
  console.log('')

  const envPath = path.join(process.cwd(), '.env.production')
  const envLocalPath = path.join(process.cwd(), '.env')

  // ============================================
  // Paso 1: Verificar archivo .env.production
  // ============================================
  step('Verificando archivo de configuración...')
  
  if (!fs.existsSync(envPath) && !fs.existsSync(envLocalPath)) {
    error('No se encontró archivo .env.production ni .env')
    console.log('')
    console.log('Por favor, crea un archivo .env.production con:')
    console.log('─'.repeat(40))
    console.log(`
DATABASE_URL="postgresql://...tu-url-de-neon-produccion..."
DIRECT_URL="postgresql://...tu-url-de-neon-produccion..."
NEXTAUTH_SECRET="un-secreto-de-al-menos-32-caracteres"
NEXTAUTH_URL="https://tu-app.vercel.app"
`)
    console.log('─'.repeat(40))
    rl.close()
    process.exit(1)
  }

  success('Archivo de configuración encontrado')

  // ============================================
  // Paso 2: Verificar variables requeridas
  // ============================================
  step('Verificando variables de entorno...')

  // Cargar variables del archivo
  const envFile = fs.existsSync(envPath) ? envPath : envLocalPath
  const envContent = fs.readFileSync(envFile, 'utf-8')
  
  const requiredVars = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL']
  const missingVars: string[] = []

  for (const varName of requiredVars) {
    const regex = new RegExp(`^${varName}=`, 'm')
    if (!regex.test(envContent)) {
      missingVars.push(varName)
    }
  }

  if (missingVars.length > 0) {
    error('Faltan variables de entorno:')
    missingVars.forEach(v => console.log(`   - ${v}`))
    rl.close()
    process.exit(1)
  }

  success('Todas las variables requeridas están configuradas')

  // ============================================
  // Paso 3: Mostrar resumen
  // ============================================
  console.log('')
  console.log('═'.repeat(60))
  console.log('📋 PASOS PARA DEPLOY A PRODUCCIÓN')
  console.log('═'.repeat(60))
  console.log('')
  
  console.log('1️⃣  CONFIGURAR NEON (Base de Datos)')
  console.log('   - Asegurate de tener el branch "main" en Neon')
  console.log('   - Copia la URL de conexión')
  console.log('')
  
  console.log('2️⃣  CARGAR DATOS DE DEMO')
  console.log('   Ejecuta este comando:')
  console.log('')
  console.log('   pnpm db:push:prod')
  console.log('   pnpm db:seed')
  console.log('')
  console.log('   O con dotenv-cli:')
  console.log('   npx dotenv -e .env.production -- npx prisma db push')
  console.log('   npx dotenv -e .env.production -- npx tsx prisma/seed.ts')
  console.log('')

  console.log('3️⃣  DEPLOY A VERCEL')
  console.log('   - Conecta tu repo a Vercel')
  console.log('   - Configura las variables de entorno en Vercel:')
  console.log('     • DATABASE_URL')
  console.log('     • DIRECT_URL')
  console.log('     • NEXTAUTH_SECRET')
  console.log('     • NEXTAUTH_URL (tu dominio de Vercel)')
  console.log('')

  console.log('4️⃣  CREDENCIALES DE DEMO')
  console.log('   Después de ejecutar el seed:')
  console.log('   📧 Email: demo@agromonitor.com')
  console.log('   🔑 Contraseña: demo123456')
  console.log('')

  console.log('═'.repeat(60))
  
  const continuar = await ask('\n¿Querés ejecutar el seed en producción ahora? (s/n): ')
  
  if (continuar.toLowerCase() === 's') {
    console.log('')
    info('Ejecutando: npx dotenv -e .env.production -- npx tsx prisma/seed.ts')
    console.log('')
    
    // Ejecutar el seed
    const { execSync } = require('child_process')
    try {
      execSync('npx dotenv -e .env.production -- npx prisma db push', { stdio: 'inherit' })
      execSync('npx dotenv -e .env.production -- npx tsx prisma/seed.ts', { stdio: 'inherit' })
      console.log('')
      success('¡Seed completado! Los datos de demo están cargados.')
    } catch (e) {
      error('Error ejecutando el seed. Verifica tu conexión a la base de datos.')
    }
  }

  rl.close()
}

main().catch(console.error)

