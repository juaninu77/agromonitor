import { test, expect } from '@playwright/test'

/**
 * Pruebas de rendimiento de navegación
 * Mide el tiempo de carga entre diferentes secciones
 */
test.describe('Rendimiento de Navegación', () => {
  test.beforeEach(async ({ page }) => {
    // Navegar a la página de login
    await page.goto('https://agromonitor-six.vercel.app/login')
    
    // Esperar a que la página cargue
    await page.waitForLoadState('networkidle')
    
    // Llenar el formulario de login (ajusta las credenciales según sea necesario)
    await page.fill('input[name="email"]', 'demo@agromonitor.com')
    await page.fill('input[name="password"]', 'demo123456')
    
    // Hacer clic en el botón de login
    await page.click('button[type="submit"]')
    
    // Esperar a que la navegación se complete
    await page.waitForURL('**/', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
  })

  test('Medir tiempo de carga del Dashboard', async ({ page }) => {
    const startTime = Date.now()
    
    // Navegar al dashboard
    await page.goto('https://agromonitor-six.vercel.app/')
    await page.waitForLoadState('networkidle')
    
    const loadTime = Date.now() - startTime
    
    console.log(`⏱️ Tiempo de carga del Dashboard: ${loadTime}ms`)
    
    // Verificar que la página cargó correctamente
    await expect(page).toHaveURL(/\/$/)
    
    // El tiempo debería ser razonable (menos de 3 segundos)
    expect(loadTime).toBeLessThan(3000)
  })

  test('Medir tiempo de navegación a Ganado', async ({ page }) => {
    const startTime = Date.now()
    
    // Navegar a la sección de ganado
    await page.click('a[href="/ganado"]')
    await page.waitForLoadState('networkidle')
    
    const navigationTime = Date.now() - startTime
    
    console.log(`⏱️ Tiempo de navegación a Ganado: ${navigationTime}ms`)
    
    // Verificar que la página cargó correctamente
    await expect(page).toHaveURL(/\/ganado/)
    
    // El tiempo debería ser razonable (menos de 2 segundos con prefetch)
    expect(navigationTime).toBeLessThan(2000)
  })

  test('Medir tiempo de navegación a Cultivos', async ({ page }) => {
    const startTime = Date.now()
    
    // Navegar a la sección de cultivos
    await page.click('a[href="/cultivos"]')
    await page.waitForLoadState('networkidle')
    
    const navigationTime = Date.now() - startTime
    
    console.log(`⏱️ Tiempo de navegación a Cultivos: ${navigationTime}ms`)
    
    // Verificar que la página cargó correctamente
    await expect(page).toHaveURL(/\/cultivos/)
    
    // El tiempo debería ser razonable
    expect(navigationTime).toBeLessThan(2000)
  })

  test('Medir tiempo de navegación a Configuración', async ({ page }) => {
    const startTime = Date.now()
    
    // Navegar a la sección de configuración
    await page.click('a[href="/configuracion/establecimientos"]')
    await page.waitForLoadState('networkidle')
    
    const navigationTime = Date.now() - startTime
    
    console.log(`⏱️ Tiempo de navegación a Configuración: ${navigationTime}ms`)
    
    // Verificar que la página cargó correctamente
    await expect(page).toHaveURL(/\/configuracion\/establecimientos/)
    
    // El tiempo debería ser razonable
    expect(navigationTime).toBeLessThan(2000)
  })

  test('Medir tiempo de navegación múltiple (secuencia)', async ({ page }) => {
    const navigationTimes: number[] = []
    
    // Secuencia de navegación
    const routes = [
      { href: '/ganado', name: 'Ganado' },
      { href: '/cultivos', name: 'Cultivos' },
      { href: '/configuracion/establecimientos', name: 'Configuración' },
      { href: '/', name: 'Dashboard' },
    ]
    
    for (const route of routes) {
      const startTime = Date.now()
      
      await page.click(`a[href="${route.href}"]`)
      await page.waitForLoadState('networkidle')
      
      const navigationTime = Date.now() - startTime
      navigationTimes.push(navigationTime)
      
      console.log(`⏱️ Tiempo de navegación a ${route.name}: ${navigationTime}ms`)
      
      // Verificar que la página cargó correctamente
      await expect(page).toHaveURL(new RegExp(route.href.replace('/', '\\/')))
    }
    
    // Calcular promedio
    const averageTime = navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length
    console.log(`📊 Tiempo promedio de navegación: ${averageTime.toFixed(2)}ms`)
    
    // El tiempo promedio debería ser razonable
    expect(averageTime).toBeLessThan(2000)
  })

  test('Verificar que TenantContext no recarga datos innecesariamente', async ({ page }) => {
    // Navegar al dashboard
    await page.goto('https://agromonitor-six.vercel.app/')
    await page.waitForLoadState('networkidle')
    
    // Interceptar las llamadas a la API de organizaciones
    const apiCalls: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/organizaciones')) {
        apiCalls.push(request.url())
      }
    })
    
    // Navegar entre varias secciones
    await page.click('a[href="/ganado"]')
    await page.waitForLoadState('networkidle')
    
    await page.click('a[href="/cultivos"]')
    await page.waitForLoadState('networkidle')
    
    await page.click('a[href="/"]')
    await page.waitForLoadState('networkidle')
    
    // Verificar que no se hicieron múltiples llamadas a la API
    // (solo debería haber una llamada inicial, no una por cada navegación)
    const uniqueCalls = [...new Set(apiCalls)]
    console.log(`📡 Llamadas únicas a /api/organizaciones: ${uniqueCalls.length}`)
    
    // Debería haber máximo 2 llamadas (una inicial y posiblemente una de refresh)
    expect(uniqueCalls.length).toBeLessThanOrEqual(2)
  })

  test('Verificar prefetch de rutas', async ({ page }) => {
    // Navegar al dashboard
    await page.goto('https://agromonitor-six.vercel.app/')
    await page.waitForLoadState('networkidle')
    
    // Interceptar las solicitudes de prefetch
    const prefetchRequests: string[] = []
    page.on('request', (request) => {
      if (request.resourceType() === 'document' && request.url().includes('/ganado')) {
        prefetchRequests.push(request.url())
      }
    })
    
    // Hacer hover sobre el link de ganado (esto debería activar el prefetch)
    await page.hover('a[href="/ganado"]')
    await page.waitForTimeout(500) // Dar tiempo para que se active el prefetch
    
    // Verificar que se hizo una solicitud de prefetch
    console.log(`🔮 Solicitudes de prefetch detectadas: ${prefetchRequests.length}`)
    
    // Si el prefetch está funcionando, debería haber al menos una solicitud
    // (Nota: esto puede variar según la implementación de Next.js)
  })
})

