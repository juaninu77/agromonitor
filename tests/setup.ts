/**
 * Setup de Tests - AgroMonitor
 * 
 * Este archivo se ejecuta antes de cada suite de tests.
 * Configura el ambiente de pruebas y mockea servicios externos.
 */

import { beforeAll, afterAll, afterEach } from 'vitest'

// NODE_ENV lo fija `cross-env` en los scripts de test; aquí solo secrets auxiliares.
process.env.NEXTAUTH_SECRET = 'test-secret-for-testing-only'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

// Antes de todos los tests
beforeAll(async () => {
  console.log('🧪 Iniciando suite de tests...')
  
  // Aquí puedes:
  // - Conectar a la base de datos de test
  // - Limpiar datos previos
  // - Configurar mocks globales
})

// Después de cada test
afterEach(async () => {
  // Limpiar mocks
  // vi.clearAllMocks()
})

// Después de todos los tests
afterAll(async () => {
  console.log('✅ Suite de tests completada')
  
  // Aquí puedes:
  // - Desconectar de la base de datos
  // - Limpiar recursos
})

// Mock de fetch global (opcional)
// global.fetch = vi.fn()

// Extender expect con matchers personalizados (opcional)
// expect.extend({
//   toBeValidCUIG(received: string) {
//     // Validar formato CUIG argentino
//     const pass = /^\d{11}$/.test(received)
//     return {
//       pass,
//       message: () => `expected ${received} to be a valid CUIG`,
//     }
//   },
// })

