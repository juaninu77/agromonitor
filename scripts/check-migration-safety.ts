#!/usr/bin/env tsx
/**
 * Script de validación de seguridad para migraciones de Prisma
 * Verifica que las migraciones no contengan comandos destructivos peligrosos
 * 
 * Uso: tsx scripts/check-migration-safety.ts [archivo-migracion.sql]
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// Patrones peligrosos que requieren confirmación explícita
const DANGEROUS_PATTERNS = [
  {
    pattern: /DROP\s+(DATABASE|SCHEMA)\s+/i,
    name: 'DROP DATABASE/SCHEMA',
    severity: 'CRITICAL',
    description: 'Elimina completamente una base de datos o esquema'
  },
  {
    pattern: /DROP\s+TABLE\s+/i,
    name: 'DROP TABLE',
    severity: 'HIGH',
    description: 'Elimina una tabla y todos sus datos permanentemente'
  },
  {
    pattern: /TRUNCATE\s+TABLE\s+/i,
    name: 'TRUNCATE TABLE',
    severity: 'HIGH',
    description: 'Elimina todos los datos de una tabla'
  },
  {
    pattern: /ALTER\s+TABLE\s+\w+\s+DROP\s+COLUMN/i,
    name: 'DROP COLUMN',
    severity: 'MEDIUM',
    description: 'Elimina una columna de una tabla'
  },
  {
    pattern: /DELETE\s+FROM\s+\w+\s*(?!WHERE)/i,
    name: 'DELETE sin WHERE',
    severity: 'HIGH',
    description: 'DELETE sin cláusula WHERE elimina todos los registros'
  },
]

// Patrones que son seguros pero deben ser revisados
const WARNING_PATTERNS = [
  {
    pattern: /UPDATE\s+\w+\s+SET.*(?!WHERE)/i,
    name: 'UPDATE sin WHERE',
    severity: 'MEDIUM',
    description: 'UPDATE sin WHERE puede modificar todos los registros'
  },
  {
    pattern: /ALTER\s+TABLE\s+\w+\s+ALTER\s+COLUMN/i,
    name: 'ALTER COLUMN',
    severity: 'LOW',
    description: 'Modificar columnas puede causar pérdida de datos si se cambia el tipo'
  },
]

interface SafetyCheckResult {
  isSafe: boolean
  dangerous: Array<{ name: string; severity: string; description: string; line?: number }>
  warnings: Array<{ name: string; severity: string; description: string; line?: number }>
}

function checkMigrationSafety(filePath: string): SafetyCheckResult {
  if (!existsSync(filePath)) {
    console.error(`❌ Error: El archivo no existe: ${filePath}`)
    process.exit(1)
  }

  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  const dangerous: Array<{ name: string; severity: string; description: string; line?: number }> = []
  const warnings: Array<{ name: string; severity: string; description: string; line?: number }> = []

  // Verificar patrones peligrosos
  for (const { pattern, name, severity, description } of DANGEROUS_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) {
      // Encontrar número de línea
      const lineNumber = lines.findIndex(line => pattern.test(line)) + 1
      dangerous.push({ name, severity, description, line: lineNumber || undefined })
    }
  }

  // Verificar patrones de advertencia
  for (const { pattern, name, severity, description } of WARNING_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) {
      const lineNumber = lines.findIndex(line => pattern.test(line)) + 1
      warnings.push({ name, severity, description, line: lineNumber || undefined })
    }
  }

  return {
    isSafe: dangerous.length === 0,
    dangerous,
    warnings
  }
}

function printResults(result: SafetyCheckResult, filePath: string) {
  console.log('\n' + '='.repeat(80))
  console.log(`📋 Análisis de Seguridad: ${filePath}`)
  console.log('='.repeat(80) + '\n')

  if (result.dangerous.length > 0) {
    console.log('🚨 COMANDOS PELIGROSOS DETECTADOS:\n')
    result.dangerous.forEach(({ name, severity, description, line }) => {
      const severityColor = severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : '🟡'
      console.log(`  ${severityColor} ${name} [${severity}]`)
      console.log(`     ${description}`)
      if (line) console.log(`     Línea: ${line}`)
      console.log('')
    })
    console.log('❌ Esta migración NO es segura para ejecutar automáticamente.')
    console.log('⚠️  Revisa cuidadosamente antes de ejecutar.\n')
    return false
  }

  if (result.warnings.length > 0) {
    console.log('⚠️  ADVERTENCIAS (Revisar antes de ejecutar):\n')
    result.warnings.forEach(({ name, severity, description, line }) => {
      console.log(`  🟡 ${name} [${severity}]`)
      console.log(`     ${description}`)
      if (line) console.log(`     Línea: ${line}`)
      console.log('')
    })
  }

  if (result.dangerous.length === 0 && result.warnings.length === 0) {
    console.log('✅ La migración parece segura.')
    console.log('   No se detectaron comandos destructivos peligrosos.\n')
  } else if (result.dangerous.length === 0) {
    console.log('✅ La migración es relativamente segura.')
    console.log('   Revisa las advertencias antes de ejecutar.\n')
  }

  return result.dangerous.length === 0
}

// Ejecutar validación
const migrationFile = process.argv[2]

if (!migrationFile) {
  console.error('❌ Error: Debes especificar un archivo de migración')
  console.error('Uso: tsx scripts/check-migration-safety.ts <archivo-migracion.sql>')
  process.exit(1)
}

const filePath = join(process.cwd(), migrationFile)
const result = checkMigrationSafety(filePath)
const isSafe = printResults(result, migrationFile)

// Salir con código de error si hay comandos peligrosos
if (!isSafe) {
  process.exit(1)
}

