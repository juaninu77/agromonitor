# 📊 Análisis Comparativo: Sistema Actual vs Datos Reales de Muestra

## Resumen Ejecutivo

Este documento compara la estructura actual de la base de datos de AgroMonitor con los datos reales del archivo **Administracion 24_25.xlsx**, identificando brechas, categorías faltantes y proponiendo una estrategia de refactorización que preserve toda la funcionalidad existente.

---

## 📋 Inventario de Datos del Excel

### Hojas Analizadas (16 hojas totales)

| # | Hoja | Registros | Propósito Principal |
|---|------|-----------|---------------------|
| 1 | **Plan Alimentacion** | 13 | Stock de alimentos, raciones y costos |
| 2 | **Stock Bovinos** | 176 | Inventario completo de ganado bovino |
| 3 | **ENGORDE** | 26 | Control económico de engorde ovino |
| 4 | **RODEO Alberto** | 134 | Organización por campo/lote (Alberto) |
| 5 | **RODEO Renuevo** | 133 | Organización por campo/lote (Renuevo) |
| 6 | **Plan C** | 19 | Plan de actividades (Abril-Septiembre) |
| 7 | **Plan A** | 18 | Plan de actividades (Octubre-Marzo) |
| 8 | **Stock Ovinos** | 262 | Inventario histórico de ganado ovino |
| 9 | **Copia de Stock Ovinos** | 190 | Backup del stock ovino |
| 10 | **Registro C-V** | 4 | Compras/Ventas/Movimientos |
| 11 | **ENCASTE 2025** | 25 | Registro de reproducción/encaste |
| 12 | **DESTETE BOVINO 2025** | 57 | Control de destete bovino |
| 13 | **Stock Recria2025** | 59 | Recría de animales jóvenes |
| 14 | **Listado de Tareas** | 18 | Tareas operativas pendientes |
| 15 | **Registro Sanitario** | 2 | Tratamientos veterinarios (formato 1) |
| 16 | **Registro Sanitario 2** | 8 | Tratamientos veterinarios (formato 2) |

---

## 🔍 Análisis Detallado por Categoría

### 1. GANADO BOVINO

#### Datos en Excel:
- **CUIG** (Código Único de Identificación Ganadera) - identificador oficial
- **Número** (IDV - Identificación de Vientre)
- **Sub-número** (subcategoría)
- **Dientes/Nacimiento** (edad estimada)
- **Observaciones** (estado, problemas, etc.)
- **Rodeo/Padre** (relación con otros animales)
- **Categorías**: Vientres, Toros, Terneros, Novillos, etc.
- **Movimientos**: Ventas, compras, traslados
- **Destete**: Registro de destete con pesos

#### Estructura Actual del Sistema:
```sql
livestock.animals (
    tag_number VARCHAR(50),      -- ✅ Cubre CUIG/Número
    name VARCHAR(100),            -- ✅ Nombre opcional
    species VARCHAR(50),          -- ✅ 'cattle'
    breed VARCHAR(100),           -- ✅ Raza
    gender VARCHAR(10),           -- ✅ 'male', 'female'
    birth_date DATE,             -- ⚠️ No hay "dientes/nacimiento" como alternativa
    current_weight DECIMAL(6,2),  -- ✅ Peso actual
    status VARCHAR(50),          -- ✅ 'active', 'sold', etc.
    location_id UUID,            -- ✅ Ubicación
    metadata JSONB              -- ✅ Puede almacenar datos adicionales
)
```

#### ✅ Lo que SÍ cubre el sistema:
- Identificación básica de animales
- Peso y estado
- Ubicación
- Metadatos flexibles (JSONB)

#### ❌ Lo que FALTA:
1. **CUIG como campo específico** (actualmente solo tag_number genérico)
2. **Sistema de categorización por edad/estado** (Vientres, Toros, Terneros, Novillos)
3. **Registro de dientes/nacimiento** como método alternativo de edad
4. **Sub-número** para subcategorías
5. **Registro de destete** con pesos específicos
6. **Relación padre-hijo** más explícita (sire_id/dam_id existen pero no se usa para "rodeo")
7. **Movimientos de stock** (compras/ventas/traslados) no está estructurado

---

### 2. GANADO OVINO

#### Datos en Excel:
- **IDV** (Identificación de Vientre) - número único
- **Color** (marcador visual: Rojo, Celeste, Negra, etc.)
- **Categoría** (Oveja, Borrega, Cordera, Corderos, Capones, Carneros)
- **Evolución temporal** (Stock 2022 → 2023 → 2024 → Pérdidas 2025)
- **Pérdidas** (Muerte, Perdida) con porcentajes
- **Peso** en diferentes etapas

#### Estructura Actual del Sistema:
```sql
livestock.animals (
    tag_number VARCHAR(50),      -- ✅ Cubre IDV
    species VARCHAR(50),          -- ✅ 'sheep'
    gender VARCHAR(10),           -- ✅ 'male', 'female'
    current_weight DECIMAL(6,2),  -- ✅ Peso actual
    metadata JSONB              -- ✅ Puede almacenar color, categoría
)
```

#### ✅ Lo que SÍ cubre:
- Identificación básica
- Especie y género
- Peso

#### ❌ Lo que FALTA:
1. **Color como campo específico** (muy importante en ovinos)
2. **Categorías específicas de ovinos** (Borrega, Cordera, Corderos, Capones, Carneros)
3. **Historial de evolución** (cómo cambia un animal de categoría en el tiempo)
4. **Registro de pérdidas** con motivo (Muerte, Perdida)
5. **Pesos históricos** por etapa

---

### 3. REGISTRO SANITARIO

#### Datos en Excel:
- **Campo** (ubicación)
- **Especie** (Oveja/Vaca)
- **Fecha** del tratamiento
- **Tratamiento** (Desparasitación, Clostridial, etc.)
- **Producto** (Ivermectina, Galgosantel, etc.)
- **Dosis** (10 ml por oveja, etc.)
- **Operario** (quien aplicó)
- **Observaciones**

#### Estructura Actual del Sistema:
```sql
livestock.health_records (
    animal_id UUID,              -- ⚠️ Requiere animal específico
    record_date DATE,            -- ✅ Fecha
    record_type VARCHAR(50),     -- ✅ 'vaccination', 'treatment', etc.
    treatment_name VARCHAR(255), -- ✅ Producto
    dosage VARCHAR(100),         -- ✅ Dosis
    veterinarian_id UUID,        -- ✅ Operario (pero solo veterinario)
    notes TEXT,                  -- ✅ Observaciones
    cost DECIMAL(10,2)           -- ✅ Costo
)
```

#### ✅ Lo que SÍ cubre:
- Registro por animal
- Fecha, tratamiento, dosis
- Observaciones y costo

#### ❌ Lo que FALTA:
1. **Tratamientos grupales** (el Excel muestra tratamientos por campo/especie, no por animal individual)
2. **Campo/Ubicación** como nivel de registro (no solo animal)
3. **Operario** genérico (no solo veterinario)
4. **Categorización de tratamientos** más específica (Desparasitación, Clostridial, etc.)

---

### 4. PLAN DE ALIMENTACIÓN

#### Datos en Excel:
- **Tipo de alimento** (Fardos, Mezcla, Maíz, Balanceado)
- **Cantidad** en stock
- **Kg unitario** y **Kg total**
- **Raciones** calculadas (raciones a 1.5 kg, raciones por mes)
- **Compras** con costos ($ equipo, $ por Kg)
- **Cálculos** de consumo diario

#### Estructura Actual del Sistema:
```sql
livestock.nutrition_plans (
    name VARCHAR(255),           -- ✅ Nombre del plan
    target_group VARCHAR(100),   -- ✅ Grupo objetivo
    daily_dry_matter DECIMAL(6,2), -- ✅ Materia seca diaria
    crude_protein DECIMAL(5,2),  -- ✅ Proteína
    ration_components JSONB,      -- ✅ Ingredientes (puede incluir tipos)
    cost_per_day DECIMAL(8,2)    -- ✅ Costo diario
)
```

#### ✅ Lo que SÍ cubre:
- Planes nutricionales
- Componentes de ración
- Costos

#### ❌ Lo que FALTA:
1. **Inventario de alimentos** (stock físico)
2. **Registro de compras** de alimentos
3. **Cálculo de raciones** basado en stock disponible
4. **Consumo histórico** de alimentos
5. **Tipos de alimentos** estructurados (Fardos, Mezcla, Maíz, Balanceado)

---

### 5. REGISTRO DE COMPRAS/VENTAS/MOVIMIENTOS

#### Datos en Excel:
- **Fecha**
- **Tipo** (Compra/Venta/Movimiento)
- **Especie** (Oveja/Vaca)
- **Categoría** (Toro, etc.)
- **Cantidad**
- **Proveedor/Cliente**
- **Precio Unitario**
- **Observaciones** (detalles del animal: RP 230 / 2D / 780 Kg / 40,5 CE)

#### Estructura Actual del Sistema:
```sql
finance.transactions (
    transaction_date DATE,        -- ✅ Fecha
    transaction_type VARCHAR(50), -- ✅ 'sale', 'purchase'
    total_amount DECIMAL(12,2),  -- ✅ Monto total
    related_entity_type VARCHAR(50), -- ✅ 'animal'
    related_entity_id UUID,      -- ✅ ID del animal
    description TEXT             -- ✅ Descripción
)
```

#### ✅ Lo que SÍ cubre:
- Transacciones financieras básicas
- Relación con entidades

#### ❌ Lo que FALTA:
1. **Movimientos** (no son compras ni ventas, son traslados)
2. **Cantidad** en transacciones (actualmente solo monto total)
3. **Precio unitario** explícito
4. **Proveedor/Cliente** estructurado (no solo en descripción)
5. **Detalles del animal** en compra/venta (peso, edad, características)

---

### 6. REGISTRO DE ENCASTE/REPRODUCCIÓN

#### Datos en Excel:
- **Fecha de inicio** y **finalización** del período de encaste
- **Duración** (40 días)
- **Observaciones** del proceso

#### Estructura Actual del Sistema:
```sql
livestock.reproductive_events (
    animal_id UUID,              -- ✅ Animal específico
    event_type VARCHAR(50),     -- ✅ 'heat', 'insemination', 'calving'
    event_date DATE,            -- ✅ Fecha del evento
    outcome VARCHAR(50),        -- ✅ Resultado
    notes TEXT                  -- ✅ Observaciones
)
```

#### ✅ Lo que SÍ cubre:
- Eventos reproductivos individuales
- Fechas y resultados

#### ❌ Lo que FALTA:
1. **Períodos de encaste** (ventanas de tiempo para reproducción)
2. **Registro grupal** (no solo por animal individual)
3. **Duración del período** de encaste
4. **Planificación** de encastes futuros

---

### 7. REGISTRO DE DESTETE

#### Datos en Excel:
- **CUIG** o **IDV** del animal
- **SEXO** (H/M)
- **PESO** al destete
- **OBSERVACIONES**
- **Venta** (si aplica)
- **Sin registrar** (animales sin identificación completa)

#### Estructura Actual del Sistema:
```sql
livestock.reproductive_events (
    event_type = 'calving'      -- ✅ Cubre parto
)
-- ⚠️ No hay tabla específica para destete
```

#### ❌ Lo que FALTA COMPLETAMENTE:
1. **Tabla de destete** específica
2. **Peso al destete** como métrica importante
3. **Registro de animales sin identificar** completamente
4. **Relación madre-cría** en el destete

---

### 8. PLANES DE ACTIVIDADES (Plan A y Plan C)

#### Datos en Excel:
- **Actividades** (DESTETE, SERVICIO, TACTO, ECOGRAFIA, PARTOS, etc.)
- **Meses** (Octubre-Marzo para Plan A, Abril-Septiembre para Plan C)
- **Fechas específicas** o períodos

#### Estructura Actual del Sistema:
```sql
tasks.tasks (
    title VARCHAR(255),         -- ✅ Título de la tarea
    description TEXT,           -- ✅ Descripción
    due_date TIMESTAMP,         -- ✅ Fecha límite
    category VARCHAR(100),      -- ✅ Categoría
    status VARCHAR(50),         -- ✅ Estado
    assigned_to_id UUID         -- ✅ Asignado a
)
```

#### ✅ Lo que SÍ cubre:
- Tareas básicas
- Fechas y asignaciones

#### ❌ Lo que FALTA:
1. **Tipos de actividades específicas** (DESTETE, SERVICIO, TACTO, etc.)
2. **Planificación estacional** (Plan A vs Plan C)
3. **Actividades recurrentes** por mes
4. **Plantillas de actividades** por tipo de ganado

---

### 9. RODEOS Y ORGANIZACIÓN POR CAMPOS

#### Datos en Excel:
- **Rodeos** por campo (Alberto, Renuevo)
- **Categorías** de animales por rodeo (Vacas, Vaq, Paridas, Terneros, etc.)
- **Stock inicial**
- **Salidas** (Ventas)
- **Movimientos** entre campos
- **Totales** por categoría

#### Estructura Actual del Sistema:
```sql
livestock.animal_groups (
    name VARCHAR(255),          -- ✅ Nombre del grupo
    group_type VARCHAR(50),     -- ✅ Tipo de grupo
    location_id UUID            -- ✅ Ubicación
)

livestock.animal_group_memberships (
    animal_id UUID,             -- ✅ Animal
    group_id UUID,              -- ✅ Grupo
    joined_date DATE,           -- ✅ Fecha de ingreso
    left_date DATE              -- ✅ Fecha de salida
)
```

#### ✅ Lo que SÍ cubre:
- Grupos de animales
- Membresías temporales

#### ❌ Lo que FALTA:
1. **Concepto de "Rodeo"** como organización específica
2. **Stock por categoría** dentro de un rodeo
3. **Movimientos entre rodeos** estructurados
4. **Totales y resúmenes** por rodeo/categoría

---

### 10. CONTROL DE ENGORDE

#### Datos en Excel:
- **Ingresos** (origen, fecha, categorías)
- **Alimentos** consumidos (Alfalfa, Maíz) con cantidades y costos
- **Producción** (Lana, Carne) con cantidades
- **Cálculos** de costo por kilo
- **Categorías** de animales en engorde

#### Estructura Actual del Sistema:
```sql
-- ⚠️ No existe tabla específica para engorde
livestock.animals (
    current_weight DECIMAL(6,2)  -- ✅ Peso actual
)
```

#### ❌ Lo que FALTA COMPLETAMENTE:
1. **Tabla de engorde** específica
2. **Registro de ingresos** a engorde
3. **Consumo de alimentos** en engorde
4. **Producción** (lana, carne) del engorde
5. **Cálculos económicos** (costo por kilo, margen)

---

## 🎯 Resumen de Categorías Faltantes

### CRÍTICAS (No existen en el sistema):
1. ❌ **Inventario de Alimentos** (stock físico)
2. ❌ **Registro de Destete** (tabla específica)
3. ❌ **Control de Engorde** (tabla específica)
4. ❌ **Períodos de Encastre** (ventanas de reproducción)
5. ❌ **Movimientos de Stock** (compras/ventas/traslados estructurados)

### IMPORTANTES (Existen pero incompletas):
1. ⚠️ **Categorización de Animales** (faltan categorías específicas por especie)
2. ⚠️ **Registro Sanitario Grupal** (solo individual)
3. ⚠️ **Historial de Evolución** (cambios de categoría en el tiempo)
4. ⚠️ **Planes de Actividades Estacionales** (solo tareas genéricas)
5. ⚠️ **Rodeos** (existen grupos pero no el concepto de rodeo)

### MEJORAS (Existen pero pueden mejorarse):
1. 🔧 **CUIG como campo específico** (actualmente solo tag_number)
2. 🔧 **Color en ovinos** (puede ir en metadata pero debería ser campo)
3. 🔧 **Dientes/Nacimiento** como método de edad alternativa
4. 🔧 **Proveedores/Clientes** estructurados (no solo en descripción)

---

## 📐 Propuesta de Refactorización

### Estrategia: **Extensión sin Romper**

La estrategia será **agregar nuevas tablas y campos** sin modificar las existentes, usando:
- **Campos nuevos con valores por defecto** donde sea posible
- **Nuevas tablas relacionadas** para funcionalidades nuevas
- **Campos JSONB existentes** para datos temporales hasta migrar
- **Vistas y funciones** para mantener compatibilidad

---

## 🏗️ Estructura Propuesta de Nuevas Tablas

### 1. ESQUEMA: livestock (EXTENDIDO)

#### 1.1 Nueva Tabla: `livestock.animal_categories`
```sql
CREATE TABLE livestock.animal_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    species VARCHAR(50) NOT NULL, -- 'cattle', 'sheep'
    code VARCHAR(50) NOT NULL,   -- 'vientre', 'toro', 'ternero', 'oveja', 'borrega', etc.
    name VARCHAR(100) NOT NULL,  -- Nombre descriptivo
    description TEXT,
    age_range_months_min INTEGER,
    age_range_months_max INTEGER,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(species, code)
);
```

**Propósito**: Categorizar animales por especie y etapa de vida.

**Datos del Excel que cubre**:
- Bovinos: Vientres, Toros, Terneros, Novillos, Terneras, Recría
- Ovinos: Ovejas, Borregas, Corderas, Corderos, Capones, Carneros

---

#### 1.2 Modificar: `livestock.animals` (AGREGAR CAMPOS)
```sql
-- Agregar nuevos campos (sin eliminar los existentes)
ALTER TABLE livestock.animals
    ADD COLUMN cuig VARCHAR(50),              -- CUIG oficial
    ADD COLUMN sub_number VARCHAR(50),        -- Sub-número
    ADD COLUMN color VARCHAR(50),             -- Color (importante en ovinos)
    ADD COLUMN teeth_or_birth VARCHAR(50),    -- Dientes/Nacimiento como alternativa a birth_date
    ADD COLUMN category_id UUID REFERENCES livestock.animal_categories(id),
    ADD COLUMN current_category_since DATE;   -- Desde cuándo está en esta categoría

-- Índices
CREATE INDEX idx_animals_cuig ON livestock.animals(cuig);
CREATE INDEX idx_animals_category ON livestock.animals(category_id);
```

**Propósito**: Extender la información básica sin romper lo existente.

---

#### 1.3 Nueva Tabla: `livestock.category_history`
```sql
CREATE TABLE livestock.category_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id UUID NOT NULL REFERENCES livestock.animals(id),
    category_id UUID NOT NULL REFERENCES livestock.animal_categories(id),
    changed_date DATE NOT NULL,
    changed_reason VARCHAR(100), -- 'age', 'reproduction', 'manual', etc.
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_category_history_animal ON livestock.category_history(animal_id, changed_date DESC);
```

**Propósito**: Historial de cambios de categoría (evolución temporal).

**Datos del Excel que cubre**:
- Evolución: Stock 2022 → 2023 → 2024 (cambios de categoría)

---

#### 1.4 Nueva Tabla: `livestock.weaning_records`
```sql
CREATE TABLE livestock.weaning_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id UUID REFERENCES livestock.animals(id),
    dam_id UUID REFERENCES livestock.animals(id), -- Madre
    weaning_date DATE NOT NULL,
    weight_at_weaning DECIMAL(6,2),
    age_days INTEGER,
    notes TEXT,
    sale_id UUID, -- Si fue vendido al destete
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_weaning_date ON livestock.weaning_records(weaning_date DESC);
CREATE INDEX idx_weaning_dam ON livestock.weaning_records(dam_id);
```

**Propósito**: Registro específico de destete con pesos.

**Datos del Excel que cubre**:
- DESTETE BOVINO 2025 (CUIG, SEXO, PESO, OBSERVACIONES)

---

#### 1.5 Nueva Tabla: `livestock.breeding_seasons`
```sql
CREATE TABLE livestock.breeding_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id),
    name VARCHAR(255) NOT NULL, -- 'ENCASTE 2025', 'Plan A', etc.
    species VARCHAR(50) NOT NULL, -- 'cattle', 'sheep'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_days INTEGER GENERATED ALWAYS AS (end_date - start_date) STORED,
    location_id UUID REFERENCES core.locations(id),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_breeding_seasons_dates ON livestock.breeding_seasons(start_date, end_date);
```

**Propósito**: Períodos de encaste/reproducción.

**Datos del Excel que cubre**:
- ENCASTE 2025 (Fecha inicio, fecha fin, duración)

---

#### 1.6 Nueva Tabla: `livestock.fattening_records`
```sql
CREATE TABLE livestock.fattening_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id),
    name VARCHAR(255) NOT NULL, -- 'ENGORDE 2025'
    location_id UUID REFERENCES core.locations(id),
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'cancelled'
    total_animals INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE livestock.fattening_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fattening_id UUID NOT NULL REFERENCES livestock.fattening_records(id),
    animal_id UUID REFERENCES livestock.animals(id),
    entry_date DATE NOT NULL,
    origin VARCHAR(100), -- 'STOCK PROPIO', 'ANGULO', etc.
    category VARCHAR(50),
    initial_weight DECIMAL(6,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE livestock.fattening_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fattening_id UUID NOT NULL REFERENCES livestock.fattening_records(id),
    feed_type VARCHAR(100) NOT NULL, -- 'ALFALFA', 'MAIZ', etc.
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) DEFAULT 'kg',
    cost_per_unit DECIMAL(10,2),
    total_cost DECIMAL(12,2) GENERATED ALWAYS AS (quantity * cost_per_unit) STORED,
    feed_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE livestock.fattening_production (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fattening_id UUID NOT NULL REFERENCES livestock.fattening_records(id),
    production_type VARCHAR(50) NOT NULL, -- 'LANA', 'CARNE'
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) DEFAULT 'kg',
    price_per_unit DECIMAL(10,2),
    total_value DECIMAL(12,2) GENERATED ALWAYS AS (quantity * price_per_unit) STORED,
    production_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Propósito**: Control completo de engorde con alimentos y producción.

**Datos del Excel que cubre**:
- ENGORDE 2025 (Ingresos, Alimentos, Producción, Cálculos)

---

#### 1.7 Nueva Tabla: `livestock.herds` (Rodeos)
```sql
CREATE TABLE livestock.herds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id),
    name VARCHAR(255) NOT NULL, -- 'RODEO Alberto', 'RODEO Renuevo'
    location_id UUID REFERENCES core.locations(id),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

CREATE TABLE livestock.herd_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    herd_id UUID NOT NULL REFERENCES livestock.herds(id),
    category_id UUID REFERENCES livestock.animal_categories(id),
    stock_count INTEGER NOT NULL DEFAULT 0,
    as_of_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE livestock.herd_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    herd_id UUID NOT NULL REFERENCES livestock.herds(id),
    movement_type VARCHAR(50) NOT NULL, -- 'entry', 'exit', 'transfer'
    animal_id UUID REFERENCES livestock.animals(id),
    category_id UUID REFERENCES livestock.animal_categories(id),
    quantity INTEGER DEFAULT 1,
    movement_date DATE NOT NULL,
    reason VARCHAR(100), -- 'VENTA', 'COMPRA', 'TRANSFER', etc.
    destination_herd_id UUID REFERENCES livestock.herds(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Propósito**: Gestión de rodeos con stock y movimientos.

**Datos del Excel que cubre**:
- RODEO Alberto / RODEO Renuevo (Stock, Salidas, Movimientos, Totales)

---

#### 1.8 Modificar: `livestock.health_records` (EXTENDER)
```sql
-- Agregar campos para tratamientos grupales
ALTER TABLE livestock.health_records
    ADD COLUMN is_group_treatment BOOLEAN DEFAULT false,
    ADD COLUMN location_id UUID REFERENCES core.locations(id),
    ADD COLUMN species_filter VARCHAR(50), -- Si es grupal, filtrar por especie
    ADD COLUMN category_filter VARCHAR(100), -- Si es grupal, filtrar por categoría
    ADD COLUMN animals_count INTEGER, -- Cantidad de animales tratados
    ADD COLUMN operator_name VARCHAR(100); -- Operario (no solo veterinario)

-- Nueva tabla para animales tratados en tratamientos grupales
CREATE TABLE livestock.group_health_treatment_animals (
    health_record_id UUID NOT NULL REFERENCES livestock.health_records(id),
    animal_id UUID NOT NULL REFERENCES livestock.animals(id),
    PRIMARY KEY (health_record_id, animal_id)
);
```

**Propósito**: Soportar tratamientos grupales además de individuales.

**Datos del Excel que cubre**:
- Registro Sanitario (tratamientos por Campo/Especie)

---

### 2. ESQUEMA: inventory (NUEVO)

#### 2.1 Nueva Tabla: `inventory.feed_types`
```sql
CREATE TABLE inventory.feed_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE, -- 'Fardos', 'Mezcla', 'Maíz', 'Balanceado'
    unit VARCHAR(50) NOT NULL DEFAULT 'kg',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2.2 Nueva Tabla: `inventory.feed_stock`
```sql
CREATE TABLE inventory.feed_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id),
    feed_type_id UUID NOT NULL REFERENCES inventory.feed_types(id),
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit_quantity DECIMAL(10,2), -- Cantidad por unidad (ej: 18 kg por fardo)
    total_quantity DECIMAL(12,2) GENERATED ALWAYS AS (quantity * COALESCE(unit_quantity, 1)) STORED,
    location_id UUID REFERENCES core.locations(id),
    as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_feed_stock_org_date ON inventory.feed_stock(organization_id, as_of_date DESC);
```

#### 2.3 Nueva Tabla: `inventory.feed_purchases`
```sql
CREATE TABLE inventory.feed_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id),
    feed_type_id UUID NOT NULL REFERENCES inventory.feed_types(id),
    purchase_date DATE NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    supplier VARCHAR(255),
    invoice_number VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2.4 Nueva Tabla: `inventory.feed_consumption`
```sql
CREATE TABLE inventory.feed_consumption (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id),
    feed_type_id UUID NOT NULL REFERENCES inventory.feed_types(id),
    consumption_date DATE NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    target_group VARCHAR(100), -- 'lactating_cows', 'fattening', etc.
    location_id UUID REFERENCES core.locations(id),
    notes TEXT,
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_feed_consumption_date ON inventory.feed_consumption(consumption_date DESC);
```

**Propósito**: Gestión completa de inventario de alimentos.

**Datos del Excel que cubre**:
- Plan Alimentacion (Stock, Compras, Raciones, Costos)

---

### 3. ESQUEMA: finance (EXTENDIDO)

#### 3.1 Nueva Tabla: `finance.suppliers`
```sql
CREATE TABLE finance.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES core.organizations(id),
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(50),
    contact_info JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3.2 Nueva Tabla: `finance.customers`
```sql
CREATE TABLE finance.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES core.organizations(id),
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(50),
    contact_info JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3.3 Modificar: `finance.transactions` (EXTENDER)
```sql
ALTER TABLE finance.transactions
    ADD COLUMN supplier_id UUID REFERENCES finance.suppliers(id),
    ADD COLUMN customer_id UUID REFERENCES finance.customers(id),
    ADD COLUMN unit_price DECIMAL(10,2),
    ADD COLUMN quantity DECIMAL(10,2) DEFAULT 1,
    ADD COLUMN movement_type VARCHAR(50); -- 'purchase', 'sale', 'transfer', 'loss'

-- Nueva tabla para detalles de animales en transacciones
CREATE TABLE finance.transaction_animals (
    transaction_id UUID NOT NULL REFERENCES finance.transactions(id),
    animal_id UUID REFERENCES livestock.animals(id),
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2),
    animal_details JSONB, -- Detalles como peso, edad, características
    PRIMARY KEY (transaction_id, animal_id)
);
```

**Propósito**: Mejorar el registro de compras/ventas/movimientos.

**Datos del Excel que cubre**:
- Registro C-V (Compra/Venta/Movimiento con detalles)

---

### 4. ESQUEMA: tasks (EXTENDIDO)

#### 4.1 Nueva Tabla: `tasks.activity_templates`
```sql
CREATE TABLE tasks.activity_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL, -- 'DESTETE', 'SERVICIO', 'TACTO', etc.
    description TEXT,
    activity_type VARCHAR(50), -- 'reproduction', 'health', 'management', etc.
    default_duration_hours DECIMAL(5,2),
    species VARCHAR(50), -- Para qué especie aplica
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern JSONB, -- Patrón de recurrencia
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4.2 Nueva Tabla: `tasks.seasonal_plans`
```sql
CREATE TABLE tasks.seasonal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES core.organizations(id),
    name VARCHAR(255) NOT NULL, -- 'Plan A', 'Plan C'
    season VARCHAR(50) NOT NULL, -- 'summer', 'winter', 'spring', 'fall'
    start_month INTEGER NOT NULL CHECK (start_month BETWEEN 1 AND 12),
    end_month INTEGER NOT NULL CHECK (end_month BETWEEN 1 AND 12),
    year INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tasks.seasonal_plan_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seasonal_plan_id UUID NOT NULL REFERENCES tasks.seasonal_plans(id),
    activity_template_id UUID REFERENCES tasks.activity_templates(id),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    scheduled_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Propósito**: Planificación estacional de actividades.

**Datos del Excel que cubre**:
- Plan A (Octubre-Marzo) y Plan C (Abril-Septiembre)

---

## 🔄 Plan de Migración

### Fase 1: Preparación (Sin cambios en producción)
1. ✅ Crear nuevas tablas en esquema de desarrollo
2. ✅ Crear funciones de migración de datos del Excel
3. ✅ Validar integridad de datos

### Fase 2: Extensión (Agregar sin romper)
1. ✅ Agregar nuevos campos a tablas existentes (con valores por defecto)
2. ✅ Crear nuevas tablas relacionadas
3. ✅ Crear vistas de compatibilidad para código existente

### Fase 3: Migración de Datos
1. ✅ Importar datos del Excel a nuevas estructuras
2. ✅ Validar consistencia
3. ✅ Crear registros de respaldo

### Fase 4: Actualización de Código
1. ✅ Actualizar APIs para usar nuevas estructuras
2. ✅ Mantener compatibilidad con código antiguo
3. ✅ Actualizar interfaces de usuario

### Fase 5: Limpieza (Opcional, futuro)
1. ⚠️ Migrar datos de campos JSONB a campos específicos
2. ⚠️ Deprecar código antiguo gradualmente

---

## 📊 Mapeo de Datos Excel → Nuevas Tablas

### Stock Bovinos → `livestock.animals` + `livestock.animal_categories`
```
CUIG → cuig
NUMERO → tag_number
SUB → sub_number
DIENT / NACI → teeth_or_birth
OBSERVACION → notes
Categoría → category_id (buscar en animal_categories)
```

### Stock Ovinos → `livestock.animals` + `livestock.category_history`
```
IDV → tag_number
Color → color
Categoría → category_id
Evolución temporal → category_history (múltiples registros)
Pérdidas → status = 'deceased' o 'lost' + notes
```

### Plan Alimentacion → `inventory.feed_stock` + `inventory.feed_purchases`
```
TIPO → feed_types.name
CANTIDAD → feed_stock.quantity
KG UNITARIO → feed_stock.unit_quantity
Compras → feed_purchases
```

### ENGORDE → `livestock.fattening_records` + tablas relacionadas
```
Ingresos → fattening_entries
Alimentos → fattening_feed
Producción → fattening_production
```

### Registro C-V → `finance.transactions` + `finance.transaction_animals`
```
Compra/Venta/Movimiento → transaction_type + movement_type
Proveedor/Cliente → supplier_id / customer_id
Detalles del animal → transaction_animals.animal_details
```

---

## ✅ Ventajas de Esta Propuesta

1. **No rompe código existente**: Todas las tablas y campos actuales se mantienen
2. **Extensible**: Fácil agregar nuevas funcionalidades
3. **Compatible**: Los campos JSONB permiten almacenar datos temporalmente
4. **Normalizado**: Estructura limpia y escalable
5. **Trazable**: Historial completo de cambios
6. **Flexible**: Soporta tanto registros individuales como grupales

---

## 🚨 Consideraciones Importantes

1. **Campos opcionales**: Los nuevos campos son NULL por defecto, no afectan datos existentes
2. **Migración gradual**: Se puede migrar datos del Excel progresivamente
3. **Compatibilidad**: El código existente seguirá funcionando mientras se actualiza
4. **Performance**: Los índices nuevos optimizarán consultas
5. **Validación**: Se deben crear constraints para mantener integridad

---

## 📝 Próximos Pasos Recomendados

1. **Revisar esta propuesta** y ajustar según necesidades específicas
2. **Crear scripts SQL** para las nuevas tablas y modificaciones
3. **Desarrollar funciones de importación** desde Excel
4. **Crear pruebas** para validar la migración
5. **Documentar** los cambios en el código

---

*Este documento es una propuesta de diseño. No se han realizado cambios en la base de datos aún.*



