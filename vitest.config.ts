import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Ambiente de testing
    environment: 'node',
    
    // Incluir archivos de test
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    
    // Excluir
    exclude: ['node_modules', '.next', 'dist'],
    
    // Globals (describe, it, expect sin importar)
    globals: true,
    
    // Setup files
    setupFiles: ['./tests/setup.ts'],
    
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
    
    // Timeout
    testTimeout: 10000,
    
    // Reintentos en CI
    retry: process.env.CI ? 2 : 0,
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})

