/**
 * Tests para la configuración de ambientes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getCurrentEnvironment,
  getEnvironmentConfig,
  isProduction,
  isDevelopment,
  isTest,
} from '@/config/environments'

describe('Configuración de Ambientes', () => {
  describe('getCurrentEnvironment', () => {
    it('debería retornar "test" cuando NODE_ENV es test', () => {
      expect(getCurrentEnvironment()).toBe('test')
    })
  })

  describe('getEnvironmentConfig', () => {
    it('debería retornar la configuración correcta para test', () => {
      const config = getEnvironmentConfig()
      
      expect(config.name).toBe('test')
      expect(config.displayName).toBe('Pruebas')
      expect(config.isProduction).toBe(false)
      expect(config.debug).toBe(true)
    })

    it('debería tener features de test configuradas', () => {
      const config = getEnvironmentConfig()
      
      expect(config.features.enableMocks).toBe(true)
      expect(config.features.enableDevTools).toBe(false)
      expect(config.features.enableAnalytics).toBe(false)
    })
  })

  describe('Helpers de ambiente', () => {
    it('isProduction debería ser false en test', () => {
      expect(isProduction()).toBe(false)
    })

    it('isDevelopment debería ser false en test', () => {
      expect(isDevelopment()).toBe(false)
    })

    it('isTest debería ser true en test', () => {
      expect(isTest()).toBe(true)
    })
  })
})

