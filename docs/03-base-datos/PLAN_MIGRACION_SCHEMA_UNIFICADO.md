# 🚀 PLAN DE MIGRACIÓN: Schema Unificado Completo
**AgroMonitor ERP - Implementación Progresiva**
*Fecha: Noviembre 2024*

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Estrategia de Migración](#estrategia-de-migración)
3. [Fases de Implementación](#fases-de-implementación)
4. [Detalles por Fase](#detalles-por-fase)
5. [Scripts de Migración](#scripts-de-migración)
6. [Testing y Validación](#testing-y-validación)
7. [Rollback y Contingencias](#rollback-y-contingencias)
8. [Checklist de Implementación](#checklist-de-implementación)

---

## 🎯 RESUMEN EJECUTIVO

### Situación Actual
- **Schema Básico**: 11 tablas operativas
- **Schema Expandido**: 38 tablas (ganado + alimentación + reproducción)
- **Schema Unificado**: ~180 tablas (cobertura completa de UI)

### Objetivos
- ✅ Implementar base de datos completa para toda la UI
- ✅ Mantener compatibilidad con datos existentes
- ✅ Implementación progresiva sin interrupciones
- ✅ Testing exhaustivo en cada fase

### Timeline Estimado
- **TOTAL**: 6-8 semanas
- **Fase 1 (Crítico)**: 2-3 semanas
- **Fase 2 (Importante)**: 2-3 semanas
- **Fase 3 (Deseable)**: 2 semanas

---

## 🛠️ ESTRATEGIA DE MIGRACIÓN

### Principios Fundamentales

1. **Implementación Progresiva**
   - Desplegar por módulos completos (no parciales)
   - Validar cada fase antes de continuar
   - Mantener sistema operativo en todo momento

2. **Compatibilidad hacia Atrás**
   - Preservar datos existentes
   - Mantener schema básico funcionando en paralelo
   - Migración de datos automática cuando sea posible

3. **Testing Exhaustivo**
   - Tests unitarios por tabla
   - Tests de integración por módulo
   - Tests end-to-end completos

4. **Documentación Continua**
   - Documentar cada cambio
   - Actualizar diagramas ER
   - Mantener changelog detallado

### Orden de Prioridades

**FASE 1: MÓDULOS CRÍTICOS** (2-3 semanas)
- Finanzas (fundamental para ROI y análisis)
- Cultivos (segunda necesidad más importante)

**FASE 2: MÓDULOS IMPORTANTES** (2-3 semanas)
- IoT (monitoreo y automatización)
- Tareas (organización operativa)
- Inventario Expandido (control de stock)

**FASE 3: MÓDULOS DESEABLES** (2 semanas)
- Mapa/Georreferenciación (visualización)
- Mercado (inteligencia de precios)
- Dashboard Configuración (personalización)

---

## 📅 FASES DE IMPLEMENTACIÓN

### FASE 0: PREPARACIÓN (1 semana)

#### Objetivos
- Configurar entorno de staging
- Backup completo de BD producción
- Configurar CI/CD para migraciones
- Preparar scripts de migración

#### Tareas
- [ ] Crear copia completa de BD producción
- [ ] Configurar entorno de staging idéntico
- [ ] Instalar herramientas de migración
- [ ] Configurar logs y monitoreo
- [ ] Preparar scripts de rollback
- [ ] Documentar estado actual del schema

#### Entregables
- ✅ Entorno staging operativo
- ✅ Backup verificado y restaurable
- ✅ Scripts de migración versionados
- ✅ Documentación de estado inicial

---

### FASE 1: MÓDULOS CRÍTICOS (2-3 semanas)

#### 1.1 MÓDULO DE FINANZAS (1 semana)

**Tablas a Crear** (25 tablas):
```sql
Core:
- CuentaContable
- CategoriaFinanciera
- Ejercicio

Transacciones:
- Ingreso (reemplaza parte de MovimientoGanado)
- Gasto (reemplaza parte de CompraAlimento)
- Transferencia
- AsientoContable
- DetalleAsiento

Presupuesto:
- Presupuesto
- PresupuestoCategoria
- EjecucionPresupuesto

Reportes:
- EstadoResultados
- FlujoCaja
- BalanceGeneral

Alertas:
- AlertaFinanciera
- UmbralFinanciero
```

**Migraciones de Datos**:
```javascript
// Migrar compras de alimento a gastos
MovimientoGanado[tipo='compra'] → Ingreso
MovimientoGanado[tipo='venta'] → Ingreso
CompraAlimento → Gasto
RegistroSanitario[costo] → Gasto
```

**Script de Migración**:
```prisma
// 001_create_finanzas_module.sql
-- 1. Crear estructura de cuentas contables
CREATE TABLE "CuentaContable" (...)

-- 2. Crear categorías financieras predefinidas
INSERT INTO "CategoriaFinanciera" (nombre, tipo)
VALUES 
  ('Venta de Ganado', 'ingreso'),
  ('Venta de Cultivos', 'ingreso'),
  ('Compra de Alimentos', 'gasto'),
  ('Gastos Veterinarios', 'gasto'),
  ... más categorías

-- 3. Migrar datos existentes
INSERT INTO "Ingreso" (fecha, concepto, monto, categoriaId, ...)
SELECT 
  fecha,
  CONCAT('Venta de ganado - ', tipo),
  precioVentaTotal,
  (SELECT id FROM "CategoriaFinanciera" WHERE nombre='Venta de Ganado'),
  ...
FROM "MovimientoGanado"
WHERE tipo = 'venta' AND precioVentaTotal IS NOT NULL;

-- 4. Crear índices
CREATE INDEX "Ingreso_fecha_idx" ON "Ingreso"("fecha");
...
```

**Testing**:
- [ ] Verificar creación de todas las tablas
- [ ] Validar migración de datos (comparar totales)
- [ ] Test de queries de reportes
- [ ] Test de inserción de nuevos registros
- [ ] Test de relaciones entre tablas

**Rollback**:
```sql
-- rollback_001_finanzas.sql
DROP TABLE IF EXISTS "Ingreso" CASCADE;
DROP TABLE IF EXISTS "Gasto" CASCADE;
... todas las tablas en orden inverso
```

#### 1.2 MÓDULO DE CULTIVOS (1-2 semanas)

**Tablas a Crear** (30 tablas):
```sql
Core:
- Cultivo
- Lote
- Siembra
- EstadoFenologico

Nutrición:
- PlanFertilizacion
- AplicacionFertilizante
- AnalisisFoliar

Sanidad:
- RegistroPlaga
- RegistroEnfermedad
- AplicacionFitosanitario
- UmbralEconomico

Riego:
- SistemaRiego
- ProgramacionRiego
- RegistroRiego
- LecturaHumedadSuelo

Suelo:
- AnalisisSuelo (expandir existente)
- PropiedadesFisicasSuelo
- HistorialSuelo

Rendimiento:
- ProyeccionRendimiento
- RegistroCosecha
- FactorLimitante
```

**Script de Migración**:
```prisma
// 002_create_cultivos_module.sql
-- 1. Crear catálogo de cultivos predefinidos
INSERT INTO "Cultivo" (nombre, especie, cicloVegetativo)
VALUES 
  ('Maíz Híbrido DK-390', 'maiz', 120),
  ('Soja RR Intacta', 'soja', 115),
  ('Trigo Baguette 31', 'trigo', 150),
  ('Girasol Alto Oleico', 'girasol', 110);

-- 2. Crear lotes ejemplo (si no existen)
INSERT INTO "Lote" (nombre, cultivoId, campoId, area, estado)
SELECT 
  'Lote ' || c.nombre,
  ...

-- 3. Crear umbrales económicos predefinidos
INSERT INTO "UmbralEconomico" (cultivo, plaga, umbral, unidadMedida)
VALUES
  ('maiz', 'Cogollero', 3, 'larvas_por_planta'),
  ...
```

**Testing**:
- [ ] Verificar relaciones Lote ↔ Campo
- [ ] Test de registro de fenología
- [ ] Test de aplicaciones (fertilización, fitosanitarios)
- [ ] Test de cálculos de rendimiento
- [ ] Validar alertas de umbrales

**Validación de Negocio**:
- [ ] Consultar con agrónomo sobre umbrales predefinidos
- [ ] Validar unidades de medida
- [ ] Verificar cálculos de proyección de rendimiento

---

### FASE 2: MÓDULOS IMPORTANTES (2-3 semanas)

#### 2.1 MÓDULO IoT (1 semana)

**Tablas a Crear** (15 tablas):
```sql
Dispositivos:
- TipoDispositivo
- DispositivoIoT
- ConfiguracionDispositivo

Lecturas:
- LecturaDispositivo
- HistorialLecturas

Alertas:
- AlertaDispositivo
- UmbralAlerta
- ConfiguracionAlerta

Mantenimiento:
- MantenimientoDispositivo
- EventoDispositivo

Ubicación:
- UbicacionDispositivo
```

**Script de Migración**:
```prisma
// 003_create_iot_module.sql
-- 1. Crear tipos de dispositivos predefinidos
INSERT INTO "TipoDispositivo" (nombre, categoria, tiposLectura)
VALUES
  ('Sensor de Humedad', 'Agricultura', '["humedad", "temperatura"]'),
  ('Collar GPS', 'Ganadería', '["ubicacion", "temperatura", "actividad"]'),
  ('Estación Meteorológica', 'Ambiente', '["temperatura", "humedad", "precipitacion", "viento"]'),
  ('Báscula IoT', 'Ganadería', '["peso"]'),
  ('Medidor de Flujo', 'Riego', '["flujo", "volumen", "presion"]');

-- 2. Configurar umbrales de alerta predeterminados
INSERT INTO "UmbralAlerta" (parametro, valorMinimo, valorMaximo, severidad, mensaje)
VALUES
  ('bateria', NULL, 30, 'warning', 'Batería baja'),
  ('bateria', NULL, 10, 'critical', 'Batería crítica'),
  ('señal', NULL, 40, 'warning', 'Señal débil'),
  ...
```

**Testing**:
- [ ] Test de registro de lecturas
- [ ] Validar generación de alertas automáticas
- [ ] Test de tracking GPS (UbicacionDispositivo)
- [ ] Verificar cálculo de estadísticas
- [ ] Test de configuración por dispositivo

#### 2.2 MÓDULO DE TAREAS (1 semana)

**Tablas a Crear** (12 tablas):
```sql
Tareas:
- Tarea
- EstadoTarea
- PrioridadTarea
- CategoriaTarea

Asignación:
- AsignacionTarea (vinculado a Usuario existente)
- EquipoTrabajo

Seguimiento:
- RegistroProgreso
- ComentarioTarea
- AdjuntoTarea
- TiempoTrabajado

Recurrencia:
- TareaRecurrente
- PatronRecurrencia
```

**Script de Migración**:
```prisma
// 004_create_tareas_module.sql
-- 1. Migrar PlantillaActividad a categorías de tareas
INSERT INTO "CategoriaTarea" (nombre, descripcion, icono, color)
SELECT 
  nombre,
  descripcion,
  '📋',
  CASE tipoActividad
    WHEN 'sanidad' THEN '#ef4444'
    WHEN 'agricultura' THEN '#22c55e'
    WHEN 'mantenimiento' THEN '#f59e0b'
    ELSE '#6b7280'
  END
FROM "PlantillaActividad"
WHERE esRecurrente = false;

-- 2. Crear estados predefinidos
INSERT INTO "EstadoTarea" (codigo, nombre, color, orden)
VALUES
  ('pending', 'Pendiente', '#gray-400', 1),
  ('in-progress', 'En Progreso', '#yellow-500', 2),
  ('completed', 'Completada', '#green-600', 3),
  ('overdue', 'Vencida', '#red-600', 4);

-- 3. Crear prioridades
INSERT INTO "PrioridadTarea" (codigo, nombre, nivel, color)
VALUES
  ('urgent', 'Urgente', 4, '#red-600'),
  ('high', 'Alta', 3, '#orange-600'),
  ('medium', 'Media', 2, '#yellow-600'),
  ('low', 'Baja', 1, '#blue-600');
```

**Testing**:
- [ ] Test de creación de tareas
- [ ] Validar asignaciones a usuarios
- [ ] Test de cambios de estado
- [ ] Verificar cálculo de horas trabajadas
- [ ] Test de tareas recurrentes (generación automática)

#### 2.3 INVENTARIO EXPANDIDO (3-4 días)

**Tablas a Crear** (10 tablas):
```sql
- ProductoInventario (generaliza StockAlimento)
- CategoriaInventario
- Almacen
- UbicacionAlmacen
- MovimientoInventario
- AlertaStock
- ValorInventario
```

**Script de Migración**:
```prisma
// 005_expand_inventario_module.sql
-- 1. Crear categorías desde tipos de alimento
INSERT INTO "CategoriaInventario" (nombre, tipo)
SELECT DISTINCT
  tipo,
  'alimento'
FROM "StockAlimento";

-- 2. Migrar StockAlimento a ProductoInventario
INSERT INTO "ProductoInventario" (
  nombre, categoriaInventarioId, unidadMedida,
  stockActual, stockMinimo, stockMaximo, costoUnitario, ...
)
SELECT
  nombre,
  (SELECT id FROM "CategoriaInventario" WHERE nombre = sa.tipo),
  sa.unidad,
  sa.cantidad,
  sa.cantidad * 0.2, -- Estimar stock mínimo
  sa.cantidad * 2,   -- Estimar stock máximo
  sa.costoUnitario,
  ...
FROM "StockAlimento" sa;

-- 3. Crear almacenes predefinidos
INSERT INTO "Almacen" (nombre, tipo, ubicacion)
VALUES
  ('Galpón Principal', 'galpón', 'Campo principal'),
  ('Silo 1', 'silo', 'Sector norte'),
  ('Depósito Veterinaria', 'galpón', 'Cerca de corrales');
```

**Testing**:
- [ ] Verificar migración completa de StockAlimento
- [ ] Validar cálculo de alertas automáticas
- [ ] Test de movimientos (entradas/salidas)
- [ ] Verificar trazabilidad de inventario
- [ ] Test de reportes de valoración

---

### FASE 3: MÓDULOS DESEABLES (2 semanas)

#### 3.1 MAPA Y GEORREFERENCIACIÓN (5-6 días)

**Tablas a Crear** (13 tablas):
```sql
Georreferenciación:
- Zona
- CoordenadasPoligono
- Marcador
- CapaMapa

Activos:
- Vehiculo
- UbicacionVehiculo
- MantenimientoVehiculo
- Infraestructura
- UbicacionInfraestructura

Clima:
- EstacionMeteorologica
- LecturaClimatica
- PronosticoClimatico
```

**Script de Migración**:
```prisma
// 006_create_mapa_module.sql
-- 1. Crear zonas desde campos existentes
INSERT INTO "Zona" (nombre, tipo, area, coordenadas, centroLat, centroLng, estado)
SELECT
  nombre,
  'potrero',
  hectareas,
  potreros, -- Ya es JSON
  ubicacionLat,
  ubicacionLng,
  'activo'
FROM "Campo"
WHERE potreros IS NOT NULL;

-- 2. Crear capas predefinidas
INSERT INTO "CapaMapa" (nombre, tipo, icono, color, esVisible, orden)
VALUES
  ('Potreros', 'potreros', 'square', '#22c55e', true, 1),
  ('Cultivos', 'cultivos', 'crop', '#f59e0b', true, 2),
  ('Vehículos', 'vehiculos', 'truck', '#3b82f6', true, 3),
  ('Sensores IoT', 'sensores', 'wifi', '#8b5cf6', true, 4),
  ('Infraestructura', 'infraestructura', 'building', '#6b7280', true, 5);
```

**Testing**:
- [ ] Validar coordenadas GeoJSON
- [ ] Test de tracking de vehículos
- [ ] Verificar capas del mapa
- [ ] Test de marcadores
- [ ] Validar datos climáticos

#### 3.2 MERCADO (3-4 días)

**Tablas a Crear** (11 tablas):
```sql
- ProductoMercado
- CategoriaMercado
- FuentePrecio
- PrecioHistorico
- CotizacionDiaria
- TendenciaPrecio
- IndiceMercado
- VolumenTransaccion
- ProyeccionPrecio
- AlertaPrecio
```

**Script de Migración**:
```prisma
// 007_create_mercado_module.sql
-- 1. Crear catálogo de productos de mercado
INSERT INTO "ProductoMercado" (nombre, categoriaMercadoId, unidad, tipo)
VALUES
  -- Insumos
  ('Urea 46%', (SELECT id FROM "CategoriaMercado" WHERE nombre='Fertilizantes'), 'tonelada', 'insumo'),
  ('Glifosato', (SELECT id FROM "CategoriaMercado" WHERE nombre='Agroquímicos'), 'litro', 'insumo'),
  
  -- Productos
  ('Maíz', (SELECT id FROM "CategoriaMercado" WHERE nombre='Granos'), 'tonelada', 'producto'),
  ('Soja', (SELECT id FROM "CategoriaMercado" WHERE nombre='Granos'), 'tonelada', 'producto'),
  
  -- Ganado
  ('Novillo Pesado', (SELECT id FROM "CategoriaMercado" WHERE nombre='Bovinos'), 'kg', 'ganado'),
  ('Ternero Destete', (SELECT id FROM "CategoriaMercado" WHERE nombre='Bovinos'), 'kg', 'ganado');

-- 2. Crear fuentes de precios
INSERT INTO "FuentePrecio" (nombre, tipo, pais, ciudad)
VALUES
  ('Rosario', 'bolsa', 'Argentina', 'Rosario'),
  ('CBOT', 'bolsa', 'USA', 'Chicago'),
  ('Liniers', 'mercado', 'Argentina', 'Buenos Aires'),
  ('Mercado Local', 'referencia', 'Argentina', NULL);
```

**Testing**:
- [ ] Test de registro de precios históricos
- [ ] Validar cálculo de tendencias
- [ ] Test de alertas de precio
- [ ] Verificar proyecciones
- [ ] Test de API de precios (si existe)

#### 3.3 DASHBOARD Y WIDGETS (2-3 días)

**Tablas a Crear** (2 tablas):
```sql
- DashboardWidget
- MetricaHistorial
```

**Script de Migración**:
```prisma
// 008_create_dashboard_module.sql
-- 1. Crear widgets predefinidos
INSERT INTO "DashboardWidget" (nombre, tipo, posicion, configuracion)
VALUES
  (
    'KPI Total Animales',
    'kpi',
    '{"x": 0, "y": 0, "width": 3, "height": 2}',
    '{"metrica": "total_animales", "icono": "cow", "color": "blue"}'
  ),
  (
    'Gráfico Ingresos Mensuales',
    'chart',
    '{"x": 3, "y": 0, "width": 6, "height": 4}',
    '{"tipo": "line", "metrica": "ingresos_mensuales", "periodo": "mes"}'
  ),
  ...
```

**Testing**:
- [ ] Test de widgets configurables
- [ ] Validar registro de métricas
- [ ] Test de queries de dashboard
- [ ] Verificar performance de widgets

---

## 🧪 TESTING Y VALIDACIÓN

### 1. Tests Unitarios por Tabla

Para cada tabla nueva:
```typescript
describe('Tabla: Ingreso', () => {
  test('Crear ingreso', async () => {
    const ingreso = await prisma.ingreso.create({
      data: {
        fecha: new Date(),
        concepto: 'Venta de Ganado Test',
        monto: 100000,
        categoriaId: 'cat-1',
        estado: 'pagado'
      }
    });
    expect(ingreso).toBeDefined();
    expect(ingreso.monto).toBe(100000);
  });

  test('Relación con CategoriaFinanciera', async () => {
    const ingreso = await prisma.ingreso.findUnique({
      where: { id: 'ingreso-1' },
      include: { categoria: true }
    });
    expect(ingreso.categoria).toBeDefined();
  });

  test('Índices funcionando', async () => {
    const start = Date.now();
    await prisma.ingreso.findMany({
      where: { fecha: { gte: new Date('2024-01-01') } }
    });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100); // ms
  });
});
```

### 2. Tests de Integración por Módulo

```typescript
describe('Módulo: Finanzas Completo', () => {
  test('Flujo completo: Ingreso → Asiento → Estado de Resultados', async () => {
    // 1. Crear ingreso
    const ingreso = await crearIngreso(...);
    
    // 2. Verificar asiento contable automático
    const asiento = await prisma.asientoContable.findFirst({
      where: { /* relacionado con ingreso */ }
    });
    expect(asiento).toBeDefined();
    
    // 3. Generar estado de resultados
    const estadoResultados = await generarEstadoResultados(...);
    expect(estadoResultados.totalIngresos).toBeGreaterThan(0);
  });
});
```

### 3. Tests End-to-End

```typescript
describe('E2E: Ciclo Completo de Ganado', () => {
  test('Desde compra hasta venta', async () => {
    // 1. Registrar compra
    const movimiento = await prisma.movimientoGanado.create({
      data: { tipo: 'compra', ... }
    });
    
    // 2. Verificar gasto financiero
    const gasto = await prisma.gasto.findFirst({
      where: { /* relacionado */ }
    });
    expect(gasto).toBeDefined();
    
    // 3. Registrar peso y crecimiento
    const registroPeso = await prisma.registroPeso.create({...});
    
    // 4. Calcular ROI
    const roi = await calcularROI(...);
    expect(roi).toBeGreaterThan(0);
    
    // 5. Registrar venta
    const venta = await prisma.movimientoGanado.create({
      data: { tipo: 'venta', ... }
    });
    
    // 6. Verificar ingreso financiero
    const ingreso = await prisma.ingreso.findFirst({...});
    expect(ingreso).toBeDefined();
  });
});
```

### 4. Tests de Performance

```typescript
describe('Performance: Queries Complejas', () => {
  test('Dashboard principal carga en < 500ms', async () => {
    const start = Date.now();
    
    const [animales, finanzas, tareas, alertas] = await Promise.all([
      getResumenAnimales(),
      getResumenFinanciero(),
      getTareasPendientes(),
      getAlertasActivas()
    ]);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('Reporte financiero anual < 2 segundos', async () => {
    const start = Date.now();
    const reporte = await generarReporteFinancieroAnual(2024);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000);
  });
});
```

---

## 🔄 ROLLBACK Y CONTINGENCIAS

### Estrategia de Rollback

#### 1. Rollback Inmediato (Durante Testing)
```bash
# Si detectas problemas durante testing en staging:

# Opción A: Rollback de Prisma
npx prisma migrate rollback

# Opción B: Restaurar backup
pg_restore -d agromonitor_staging backup_fase_X_before.dump

# Opción C: Script manual
psql -d agromonitor_staging -f rollback_00X_module.sql
```

#### 2. Rollback en Producción (Emergencia)
```bash
# SOLO en caso de emergencia crítica

# 1. Poner aplicación en modo mantenimiento
echo "MAINTENANCE_MODE=true" >> .env

# 2. Desconectar usuarios
# (verificar que no hay transacciones activas)

# 3. Restaurar backup pre-migración
pg_restore -d agromonitor_prod backup_prod_YYYYMMDD_HHMMSS.dump

# 4. Revertir versión de aplicación
git checkout <commit_anterior>
pnpm install
pnpm build
pnpm start

# 5. Validar funcionamiento
# (ejecutar suite de smoke tests)

# 6. Quitar modo mantenimiento
echo "MAINTENANCE_MODE=false" >> .env
```

### Scripts de Rollback por Fase

#### Rollback Fase 1 - Finanzas
```sql
-- rollback_001_finanzas.sql
BEGIN;

-- Desconectar relaciones
ALTER TABLE "Ingreso" DROP CONSTRAINT IF EXISTS "Ingreso_categoriaId_fkey";
ALTER TABLE "Gasto" DROP CONSTRAINT IF EXISTS "Gasto_categoriaId_fkey";

-- Eliminar tablas en orden inverso
DROP TABLE IF EXISTS "UmbralFinanciero" CASCADE;
DROP TABLE IF EXISTS "AlertaFinanciera" CASCADE;
DROP TABLE IF EXISTS "BalanceGeneral" CASCADE;
DROP TABLE IF EXISTS "FlujoCaja" CASCADE;
DROP TABLE IF EXISTS "EstadoResultados" CASCADE;
DROP TABLE IF EXISTS "EjecucionPresupuesto" CASCADE;
DROP TABLE IF EXISTS "PresupuestoCategoria" CASCADE;
DROP TABLE IF EXISTS "Presupuesto" CASCADE;
DROP TABLE IF EXISTS "DetalleAsiento" CASCADE;
DROP TABLE IF EXISTS "AsientoContable" CASCADE;
DROP TABLE IF EXISTS "Transferencia" CASCADE;
DROP TABLE IF EXISTS "Gasto" CASCADE;
DROP TABLE IF EXISTS "Ingreso" CASCADE;
DROP TABLE IF EXISTS "Ejercicio" CASCADE;
DROP TABLE IF EXISTS "CategoriaFinanciera" CASCADE;
DROP TABLE IF EXISTS "CuentaContable" CASCADE;

COMMIT;
```

### Puntos de Verificación (Checkpoints)

Antes de cada fase, ejecutar:
```bash
#!/bin/bash
# checkpoint_verification.sh

echo "🔍 CHECKPOINT VERIFICATION - Fase $1"

# 1. Backup actual
echo "📦 Creating backup..."
pg_dump -Fc agromonitor_staging > backup_checkpoint_fase_$1_$(date +%Y%m%d_%H%M%S).dump

# 2. Verificar integridad de datos
echo "🔍 Checking data integrity..."
npm run test:integrity

# 3. Verificar performance
echo "⚡ Performance check..."
npm run test:performance

# 4. Validar relaciones
echo "🔗 Validating relationships..."
npm run test:relationships

# 5. Smoke tests
echo "💨 Running smoke tests..."
npm run test:smoke

echo "✅ Checkpoint verification complete!"
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Pre-implementación
- [ ] Backup completo de BD producción
- [ ] Entorno staging configurado
- [ ] Scripts de migración revisados
- [ ] Tests escritos y validados
- [ ] Scripts de rollback preparados
- [ ] Documentación actualizada
- [ ] Equipo informado y capacitado

### Por Cada Fase

#### Antes de la Migración
- [ ] Backup de la fase anterior
- [ ] Revisión de scripts SQL
- [ ] Dry-run en copia de BD
- [ ] Validación de tiempos de ejecución
- [ ] Notificar a usuarios (si aplica)

#### Durante la Migración
- [ ] Ejecutar en horario de baja actividad
- [ ] Monitorear logs en tiempo real
- [ ] Verificar sin errores
- [ ] Validar creación de tablas
- [ ] Verificar índices creados
- [ ] Validar constraints y foreign keys

#### Después de la Migración
- [ ] Ejecutar suite de tests
- [ ] Validar datos migrados
- [ ] Verificar performance de queries
- [ ] Probar funcionalidades de UI
- [ ] Revisar logs de aplicación
- [ ] Documentar issues encontrados
- [ ] Actualizar versión de schema

### Post-implementación Total
- [ ] Todas las fases completadas
- [ ] Suite completa de tests passing
- [ ] Performance dentro de umbrales
- [ ] Documentación completa
- [ ] Capacitación de usuarios
- [ ] Plan de monitoreo activo
- [ ] Métricas de éxito definidas

---

## 📊 MÉTRICAS DE ÉXITO

### Técnicas
- ✅ **Coverage de Tests**: > 80%
- ✅ **Performance Queries**: < 500ms (queries complejas), < 100ms (queries simples)
- ✅ **Downtime durante Migración**: < 1 hora por fase
- ✅ **Errores Post-Migración**: 0 errores críticos
- ✅ **Integridad de Datos**: 100% de datos preservados

### Funcionales
- ✅ **Cobertura de UI**: 100% de componentes con BD
- ✅ **Reportes Generables**: Todos los reportes de UI funcionando
- ✅ **Alertas Operativas**: Sistema de alertas funcionando
- ✅ **Integración Módulos**: Todos los módulos interconectados

### Negocio
- ✅ **Adopción Usuario**: > 80% en primera semana
- ✅ **Satisfacción**: > 4/5 en encuesta post-implementación
- ✅ **Reducción Tiempo Tareas**: > 30%
- ✅ **Mejora en Toma Decisiones**: Métricas financieras disponibles

---

## 📞 CONTACTOS Y SOPORTE

### Equipo de Implementación
- **Tech Lead**: [Nombre]
- **Database Administrator**: [Nombre]
- **QA Lead**: [Nombre]
- **DevOps**: [Nombre]

### Escalación
1. **Nivel 1** (Issues menores): Tech Lead
2. **Nivel 2** (Problemas de performance): Database Admin
3. **Nivel 3** (Rollback necesario): Tech Lead + Database Admin + DevOps
4. **Nivel 4** (Crisis): Todos + Management

---

## 📚 RECURSOS ADICIONALES

### Documentación
- [Análisis Completo UI vs BD](./ANALISIS_UI_VS_BD_COMPLETO.md)
- [Schema Unificado Completo](../prisma/schema-unificado.prisma)
- [Guía de Deployment Vercel + Neon](./GUIA_VERCEL_NEON_PASO_A_PASO.md)

### Scripts y Herramientas
- [Scripts de Migración](../prisma/migrations/)
- [Scripts de Rollback](../scripts/rollback/)
- [Suite de Tests](../tests/)

---

**Documento generado**: Noviembre 2024  
**Versión**: 1.0  
**Última actualización**: $(date)  
**Responsable**: Equipo de Desarrollo AgroMonitor

