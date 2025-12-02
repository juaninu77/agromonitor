# 📊 Resumen Ejecutivo: Comparación Sistema vs Datos Reales

## 🎯 Objetivo

Comparar la estructura actual de AgroMonitor con los datos reales del archivo **Administracion 24_25.xlsx** para identificar qué falta y cómo adaptar el sistema sin perder funcionalidad existente.

---

## 📈 Datos Analizados

- **16 hojas** de Excel con datos operativos
- **~1,000+ registros** de ganado (bovinos y ovinos)
- **Múltiples módulos**: Stock, Sanitario, Alimentación, Producción, Movimientos

---

## ✅ Lo que SÍ Cubre tu Sistema Actual

| Categoría | Estado | Detalles |
|-----------|--------|----------|
| **Animales Básicos** | ✅ Cubierto | Identificación, especie, género, peso, estado |
| **Ubicaciones** | ✅ Cubierto | Campos y lotes con coordenadas |
| **Registro Sanitario Individual** | ✅ Cubierto | Tratamientos por animal |
| **Reproducción Individual** | ✅ Cubierto | Eventos reproductivos por animal |
| **Tareas Básicas** | ✅ Cubierto | Gestión de tareas operativas |
| **Transacciones Financieras** | ✅ Cubierto | Compras y ventas básicas |
| **Grupos de Animales** | ✅ Cubierto | Agrupación y membresías |

---

## ❌ Lo que FALTA en tu Sistema

### 🔴 CRÍTICO (No existe)

1. **Inventario de Alimentos**
   - Stock físico de fardos, mezcla, maíz, balanceado
   - Registro de compras de alimentos
   - Cálculo de raciones y consumo

2. **Control de Engorde**
   - Registro de ingresos a engorde
   - Seguimiento de consumo de alimentos
   - Producción (lana, carne) y cálculos económicos

3. **Registro de Destete**
   - Tabla específica para destete
   - Peso al destete como métrica importante
   - Relación madre-cría en el destete

4. **Períodos de Encastre**
   - Ventanas de tiempo para reproducción
   - Registro grupal de encastes
   - Planificación de períodos futuros

5. **Movimientos Estructurados**
   - Compras/Ventas/Traslados con detalles
   - Proveedores y clientes estructurados
   - Precio unitario y cantidad explícitos

### 🟡 IMPORTANTE (Existe pero incompleto)

1. **Categorización de Animales**
   - Faltan categorías específicas: Vientres, Toros, Terneros, Novillos (bovinos)
   - Faltan: Ovejas, Borregas, Corderas, Corderos, Capones, Carneros (ovinos)

2. **Registro Sanitario Grupal**
   - Actualmente solo individual
   - Necesita tratamientos por campo/especie/categoría

3. **Historial de Evolución**
   - Cambios de categoría en el tiempo (Stock 2022 → 2023 → 2024)
   - Evolución de animales jóvenes

4. **Rodeos**
   - Existen grupos pero no el concepto de "Rodeo"
   - Stock por categoría dentro de rodeo
   - Movimientos entre rodeos

5. **Planes Estacionales**
   - Plan A (Octubre-Marzo) y Plan C (Abril-Septiembre)
   - Actividades recurrentes por mes

### 🟢 MEJORAS (Pueden optimizarse)

1. **CUIG como campo específico** (actualmente solo tag_number genérico)
2. **Color en ovinos** (muy importante, actualmente solo en metadata)
3. **Dientes/Nacimiento** como método alternativo de edad
4. **Sub-número** para subcategorías

---

## 🏗️ Propuesta de Refactorización

### Estrategia: **EXTENSIÓN SIN ROMPER**

✅ **Agregar nuevas tablas** sin modificar las existentes  
✅ **Agregar campos nuevos** con valores por defecto  
✅ **Usar JSONB** para datos temporales hasta migrar  
✅ **Crear vistas** para mantener compatibilidad  

---

## 📋 Nuevas Tablas Propuestas

### 1. ESQUEMA: livestock (EXTENDIDO)

| Tabla Nueva | Propósito | Datos del Excel |
|-------------|-----------|-----------------|
| `animal_categories` | Categorías por especie | Vientres, Toros, Ovejas, Borregas, etc. |
| `category_history` | Historial de cambios | Evolución temporal de categorías |
| `weaning_records` | Registro de destete | DESTETE BOVINO 2025 |
| `breeding_seasons` | Períodos de encaste | ENCASTE 2025 |
| `fattening_records` | Control de engorde | ENGORDE 2025 |
| `herds` | Rodeos | RODEO Alberto, RODEO Renuevo |

### 2. ESQUEMA: inventory (NUEVO)

| Tabla Nueva | Propósito | Datos del Excel |
|-------------|-----------|-----------------|
| `feed_types` | Tipos de alimentos | Fardos, Mezcla, Maíz, Balanceado |
| `feed_stock` | Stock de alimentos | Plan Alimentacion |
| `feed_purchases` | Compras de alimentos | Compras en Plan Alimentacion |
| `feed_consumption` | Consumo de alimentos | Raciones calculadas |

### 3. ESQUEMA: finance (EXTENDIDO)

| Tabla Nueva | Propósito | Datos del Excel |
|-------------|-----------|-----------------|
| `suppliers` | Proveedores | Proveedor/Cliente en Registro C-V |
| `customers` | Clientes | Proveedor/Cliente en Registro C-V |
| `transaction_animals` | Detalles de animales en transacciones | Detalles en Registro C-V |

### 4. ESQUEMA: tasks (EXTENDIDO)

| Tabla Nueva | Propósito | Datos del Excel |
|-------------|-----------|-----------------|
| `activity_templates` | Plantillas de actividades | DESTETE, SERVICIO, TACTO, etc. |
| `seasonal_plans` | Planes estacionales | Plan A, Plan C |

---

## 🔄 Modificaciones a Tablas Existentes

### `livestock.animals` (AGREGAR campos)

```sql
ALTER TABLE livestock.animals
    ADD COLUMN cuig VARCHAR(50),              -- CUIG oficial
    ADD COLUMN sub_number VARCHAR(50),        -- Sub-número
    ADD COLUMN color VARCHAR(50),             -- Color (ovinos)
    ADD COLUMN teeth_or_birth VARCHAR(50),    -- Dientes/Nacimiento
    ADD COLUMN category_id UUID,              -- Categoría específica
    ADD COLUMN current_category_since DATE;   -- Desde cuándo en esta categoría
```

### `livestock.health_records` (EXTENDER para grupales)

```sql
ALTER TABLE livestock.health_records
    ADD COLUMN is_group_treatment BOOLEAN DEFAULT false,
    ADD COLUMN location_id UUID,              -- Campo/Ubicación
    ADD COLUMN species_filter VARCHAR(50),     -- Filtro por especie
    ADD COLUMN animals_count INTEGER,         -- Cantidad tratada
    ADD COLUMN operator_name VARCHAR(100);    -- Operario
```

### `finance.transactions` (EXTENDER)

```sql
ALTER TABLE finance.transactions
    ADD COLUMN supplier_id UUID,              -- Proveedor
    ADD COLUMN customer_id UUID,             -- Cliente
    ADD COLUMN unit_price DECIMAL(10,2),     -- Precio unitario
    ADD COLUMN quantity DECIMAL(10,2),       -- Cantidad
    ADD COLUMN movement_type VARCHAR(50);     -- Tipo de movimiento
```

---

## 📊 Mapeo de Datos Excel → Nuevas Tablas

| Hoja Excel | Tabla Destino | Campos Principales |
|------------|--------------|-------------------|
| **Stock Bovinos** | `livestock.animals` + `animal_categories` | CUIG, Número, Categoría, Observaciones |
| **Stock Ovinos** | `livestock.animals` + `category_history` | IDV, Color, Categoría, Evolución |
| **Plan Alimentacion** | `inventory.feed_stock` + `feed_purchases` | Tipo, Cantidad, Compras, Costos |
| **ENGORDE** | `livestock.fattening_records` + relacionadas | Ingresos, Alimentos, Producción |
| **Registro C-V** | `finance.transactions` + `transaction_animals` | Compra/Venta/Movimiento, Detalles |
| **ENCASTE 2025** | `livestock.breeding_seasons` | Fechas inicio/fin, Duración |
| **DESTETE BOVINO** | `livestock.weaning_records` | CUIG, Peso, Fecha |
| **RODEO Alberto/Renuevo** | `livestock.herds` + `herd_stock` | Stock por categoría, Movimientos |
| **Plan A / Plan C** | `tasks.seasonal_plans` | Actividades por mes |
| **Registro Sanitario** | `livestock.health_records` (extendido) | Tratamientos grupales |

---

## ✅ Ventajas de Esta Propuesta

1. ✅ **No rompe código existente** - Todas las tablas actuales se mantienen
2. ✅ **Extensible** - Fácil agregar nuevas funcionalidades
3. ✅ **Compatible** - Campos JSONB permiten datos temporales
4. ✅ **Normalizado** - Estructura limpia y escalable
5. ✅ **Trazable** - Historial completo de cambios
6. ✅ **Flexible** - Soporta individual y grupal

---

## 🚨 Consideraciones

- **Campos opcionales**: Los nuevos campos son NULL por defecto
- **Migración gradual**: Se puede migrar datos progresivamente
- **Compatibilidad**: El código existente seguirá funcionando
- **Performance**: Nuevos índices optimizarán consultas
- **Validación**: Constraints mantendrán integridad

---

## 📝 Próximos Pasos

1. ✅ **Revisar esta propuesta** y ajustar según necesidades
2. ⏳ **Crear scripts SQL** para nuevas tablas y modificaciones
3. ⏳ **Desarrollar funciones de importación** desde Excel
4. ⏳ **Crear pruebas** para validar la migración
5. ⏳ **Documentar** los cambios en el código

---

## 📚 Documentos Relacionados

- **Análisis Completo**: `docs/ANALISIS_COMPARATIVO_SAMPLE_DATA.md`
- **Estructura Actual**: `docs/DATABASE_STRUCTURE.md`
- **Propuesta Anterior**: `PROPUESTA_ADAPTACION_DATOS.md`

---

*Este documento es una propuesta de diseño. No se han realizado cambios en la base de datos aún.*



