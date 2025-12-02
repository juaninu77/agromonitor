# 🐄 Análisis Comparativo: Modelo de Datos Ganadero

## Índice
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Comparativa de Campos por Entidad](#comparativa-de-campos)
3. [Análisis de Brechas](#análisis-de-brechas)
4. [Propuesta de Modelo Final](#propuesta-de-modelo-final)
5. [Migraciones Necesarias](#migraciones-necesarias)

---

## Resumen Ejecutivo

### Lo que tenemos ACTUALMENTE

| Componente | Estado | Observaciones |
|------------|--------|---------------|
| **Schema BD (Prisma)** | 🟡 Básico | Campos esenciales, falta event-sourcing |
| **UI (animal-card)** | 🟢 Rico | Muestra más datos de los que la BD soporta |
| **Datos Mock** | 🟢 Completo | Estructura ideal para UI |
| **Multi-tenancy** | 🟢 Implementado | Campo → Organización |

### Propuesta del Usuario
| Componente | Estado | Observaciones |
|------------|--------|---------------|
| **Event Sourcing** | 🔴 No implementado | Propone eventos por cada acción |
| **Catálogos** | 🔴 No implementado | Razas, categorías, etc. normalizados |
| **Maestros** | 🟡 Parcial | Falta Potrero como entidad, Proveedores, Clientes |
| **Trazabilidad** | 🟡 Parcial | Solo DTA, falta historial completo |

---

## Comparativa de Campos por Entidad

### 1. ANIMAL (Bovino)

| Campo | BD Actual | UI Muestra | Propuesta | Recomendación |
|-------|-----------|------------|-----------|---------------|
| **IDENTIFICACIÓN** |
| id | ✅ cuid | ✅ | ✅ animal_id | ✅ Mantener |
| cuig | ✅ único | ❌ | ✅ cuig | ✅ Mantener |
| numero | ✅ | ✅ tagNumber | - | ✅ Mantener |
| caravana_visual | ❌ | ✅ tagNumber | ✅ | ⭐ **AGREGAR** |
| caravana_rfid | ❌ | ❌ | ✅ chip_rfid | ⭐ **AGREGAR** |
| marca_fuego | ❌ | ❌ | ✅ opcional | ⭐ **AGREGAR** |
| **DEMOGRÁFICOS** |
| nombre | ❌ | ✅ name | ❌ | ⭐ **AGREGAR** (opcional) |
| sexo | ❌ derivado | ❌ | ✅ sexo | ⭐ **AGREGAR** explícito |
| raza | ✅ texto | ✅ breed | ✅ raza_id FK | ⭐ **NORMALIZAR** |
| fechaNacimiento | ✅ | ✅ birthDate | ✅ | ✅ Mantener |
| edad | ✅ texto | ✅ age | ❌ calculado | 🔄 Calcular dinámico |
| **CLASIFICACIÓN** |
| categoria | ✅ texto | ✅ category | ✅ categoria_id FK | ⭐ **NORMALIZAR** |
| dientes | ✅ | ❌ | - | ✅ Mantener |
| estado (vital) | ✅ | ❌ | ✅ estado_vital | ✅ Mantener |
| **FÍSICO** |
| peso | ✅ último | ✅ weight | ❌ (evento) | 🔄 Mover a evento |
| condicionCorporal | ✅ | ✅ bodyConditionScore | ❌ (evento) | 🔄 Mover a evento |
| **PRODUCTIVO** |
| dailyGain | ❌ | ✅ calculado | ❌ (KPI) | ⭐ **AGREGAR** como vista |
| reproductiveStatus | ❌ | ✅ | ✅ estado_fisiologico | ⭐ **AGREGAR** |
| offspring | ❌ | ✅ | ✅ conteo hijos | 🔄 Calcular |
| **UBICACIÓN** |
| rodeo | ✅ texto | ❌ | ❌ | ⭐ Mover a Lote |
| ubicacion | ✅ texto | ✅ location | ✅ potrero_id FK | ⭐ **NORMALIZAR** |
| **GENEALOGÍA** |
| padreId | ✅ FK | ❌ | ✅ padre_id | ✅ Mantener |
| madreId | ✅ FK | ❌ | ✅ madre_id | ✅ Mantener |
| padreExterno | ✅ texto | ❌ | - | ✅ Mantener |
| madreExterna | ✅ texto | ❌ | - | ✅ Mantener |
| pedigree.sire | ❌ | ✅ | ✅ | 🔄 Usar relación |
| pedigree.dam | ❌ | ✅ | ✅ | 🔄 Usar relación |
| **SANIDAD** |
| healthStatus | ❌ | ✅ | ❌ (derivado) | ⭐ **AGREGAR** (estado) |
| lastVaccination | ❌ | ✅ | ❌ (evento) | 🔄 Query eventos |
| nextVaccination | ❌ | ✅ | ❌ (calculado) | 🔄 Calcular |
| alerts | ❌ | ✅ array | ❌ | ⭐ **AGREGAR** sistema alertas |
| **ECONÓMICO** |
| valorMercado | ✅ | ✅ marketValue | ❌ | ✅ Mantener |
| geneticValue | ❌ | ✅ | ❌ | ⭐ **AGREGAR** |
| **NUTRICIÓN** |
| feedEfficiency | ❌ | ✅ | ❌ (KPI) | ⭐ **AGREGAR** como KPI |
| **GENÓMICA** |
| breedingValues | ❌ | ✅ JSON | - | ⭐ **AGREGAR** si es cabaña |
| genomicReliability | ❌ | ✅ | - | ⭐ **AGREGAR** si es cabaña |
| **METADATA** |
| observaciones | ✅ | ❌ | ✅ | ✅ Mantener |
| historial | ✅ JSON | ❌ | ❌ (eventos) | 🔄 Migrar a eventos |
| foto | ❌ | ❌ | ✅ foto_uri | ⭐ **AGREGAR** |
| origen | ❌ | ❌ | ✅ cria_propia/compra | ⭐ **AGREGAR** |

### 2. CATÁLOGOS (No existen actualmente)

| Catálogo | BD Actual | UI | Propuesta | Recomendación |
|----------|-----------|-----|-----------|---------------|
| Raza | ❌ texto libre | ✅ | ✅ tabla | ⭐ **CREAR** |
| Categoria | ❌ texto libre | ✅ | ✅ tabla | ⭐ **CREAR** |
| EstadoFisiologico | ❌ | ✅ | ✅ tabla | ⭐ **CREAR** |
| CausaBaja | ❌ | ❌ | ✅ tabla | ⭐ **CREAR** |
| MotivoMovimiento | ❌ | ❌ | ✅ tabla | ⭐ **CREAR** |
| TipoTarea | ❌ | ❌ | ✅ tabla | ⭐ **CREAR** |

### 3. MAESTROS DEL CAMPO

| Entidad | BD Actual | UI | Propuesta | Recomendación |
|---------|-----------|-----|-----------|---------------|
| **Campo** | ✅ básico | ❌ | ✅ establecimiento | ✅ Expandir |
| **Potrero** | 🟡 JSON array | ✅ location | ✅ tabla propia | ⭐ **EXTRAER a tabla** |
| **Corral** | ❌ | ❌ | ✅ tabla | ⭐ **CREAR** |
| **Proveedor** | ❌ texto | ❌ | ✅ tabla | ⭐ **CREAR** |
| **Cliente** | ❌ | ❌ | ✅ tabla | ⭐ **CREAR** |

### 4. EVENTOS (Event Sourcing)

| Evento | BD Actual | UI | Propuesta | Recomendación |
|--------|-----------|-----|-----------|---------------|
| Nacimiento | ❌ | ❌ | ✅ Evt_Nacimiento | ⭐ **CREAR** |
| Destete | ✅ agregado | ❌ | ✅ Evt_Destete | ⭐ **NORMALIZAR** |
| Pesada | ❌ | ✅ weightRecords | ✅ Evt_Pesada | ⭐ **CREAR** |
| Servicio | ❌ | ❌ | ✅ Evt_Reproduccion_Servicio | ⭐ **CREAR** |
| Tacto | ❌ | ❌ | ✅ Evt_Tacto | ⭐ **CREAR** |
| Parición | ❌ | ❌ | ✅ Evt_Paricion | ⭐ **CREAR** |
| Sanidad | ✅ básico | ✅ healthRecords | ✅ Evt_Sanidad | ⭐ **EXPANDIR** |
| Alimentación | ✅ plan | ✅ nutritionPlan | ✅ Evt_Alimentacion | ⭐ **EXPANDIR** |
| Movimiento | ✅ básico | ❌ | ✅ Evt_Movimiento | ⭐ **EXPANDIR** |
| Baja/Venta | ❌ | ❌ | ✅ Evt_Baja | ⭐ **CREAR** |

### 5. LOTES Y RODEOS

| Campo | BD Actual | UI | Propuesta | Recomendación |
|-------|-----------|-----|-----------|---------------|
| Lote/Rodeo | 🟡 texto en animal | ❌ | ✅ tabla propia | ⭐ **EXTRAER a tabla** |
| Animal_Lote_Hist | ❌ | ❌ | ✅ tabla historial | ⭐ **CREAR** |
| LoteEngorde | ✅ | ❌ | ✅ | ✅ Mantener |

---

## Análisis de Brechas

### 🔴 Brechas Críticas

1. **Sin Event Sourcing**: Perdemos historial detallado
2. **Catálogos como texto libre**: No podemos filtrar/reportar bien
3. **Potreros en JSON**: No relacionables, sin historial
4. **Sin estado reproductivo**: Crítico para manejo del rodeo
5. **Sin alertas**: No hay sistema de notificaciones

### 🟡 Brechas Importantes

1. **Sin foto del animal**: Identificación visual
2. **Sin RFID/chip**: Trazabilidad electrónica
3. **Peso como snapshot**: Debería ser evento
4. **Sin proveedores/clientes**: Para compras/ventas

### 🟢 Lo que está bien

1. **Multi-tenancy** funcionando
2. **Genealogía** con relaciones reales
3. **CUIG** y número visual
4. **DTA** para SENASA
5. **Base del modelo** extensible

---

## Propuesta de Modelo Final

### Fase 1: Catálogos y Maestros (Prioridad Alta)

```
┌─────────────────────────────────────────────────────────────┐
│                    CATÁLOGOS BASE                           │
├─────────────────────────────────────────────────────────────┤
│  Raza(id, nombre, especie, descripcion)                     │
│  Categoria(id, nombre, especie, sexo, rango_edad_meses)     │
│  EstadoFisiologico(id, nombre, aplica_a[])                  │
│  MotivoMovimiento(id, nombre, requiere_destino)             │
│  CausaBaja(id, nombre, tipo[muerte|venta|perdida])          │
│  ProductoSanitario(id, nombre, tipo, principio_activo,      │
│                    dias_carencia)                           │
└─────────────────────────────────────────────────────────────┘
```

### Fase 2: Maestros del Campo (Prioridad Alta)

```
┌─────────────────────────────────────────────────────────────┐
│                    MAESTROS                                  │
├─────────────────────────────────────────────────────────────┤
│  Potrero(id, campo_id, nombre, hectareas, tipo_pastura,     │
│          capacidad_cabezas, estado[activo|descanso])        │
│  Corral(id, campo_id, nombre, capacidad, tipo[manga|...])   │
│  Proveedor(id, org_id, nombre, cuit, contacto, tipo[])      │
│  Cliente(id, org_id, nombre, cuit, contacto, tipo[])        │
│  Rodeo(id, campo_id, nombre, tipo[cria|recria|engorde],     │
│        especie, objetivo)                                    │
└─────────────────────────────────────────────────────────────┘
```

### Fase 3: Animal Mejorado (Prioridad Alta)

```
┌─────────────────────────────────────────────────────────────┐
│                    ANIMAL (Bovino/Ovino)                     │
├─────────────────────────────────────────────────────────────┤
│ IDENTIFICACIÓN:                                              │
│   id, cuig, caravana_visual, caravana_rfid, marca_fuego     │
│   nombre_apodo (opcional)                                    │
│                                                              │
│ DEMOGRÁFICOS:                                                │
│   sexo, raza_id (FK), fecha_nacimiento, origen              │
│   proveedor_id (FK, si compra)                              │
│                                                              │
│ CLASIFICACIÓN:                                               │
│   categoria_id (FK), estado_vital, dientes                  │
│   estado_fisiologico_id (FK) [preñada, lactando, seca...]   │
│                                                              │
│ UBICACIÓN ACTUAL (snapshot, historial en eventos):          │
│   potrero_id (FK), rodeo_id (FK)                            │
│                                                              │
│ GENEALOGÍA:                                                  │
│   padre_id (FK), madre_id (FK)                              │
│   padre_externo, madre_externa (texto si no está en BD)     │
│                                                              │
│ ESTADO ACTUAL (snapshots, calculados de eventos):           │
│   peso_actual, condicion_corporal, estado_sanitario         │
│   fecha_ultimo_peso, fecha_ultima_sanidad                   │
│                                                              │
│ ECONÓMICO:                                                   │
│   valor_mercado, valor_genetico (si cabaña)                 │
│                                                              │
│ METADATA:                                                    │
│   foto_uri, observaciones, created_at, updated_at           │
└─────────────────────────────────────────────────────────────┘
```

### Fase 4: Eventos (Event Sourcing) - Prioridad Media

```
┌─────────────────────────────────────────────────────────────┐
│                    EVENTOS GANADEROS                         │
├─────────────────────────────────────────────────────────────┤
│ EvtPesada(id, animal_id|lote_id, fecha, peso, cc,           │
│           operador_id, observaciones)                        │
│                                                              │
│ EvtMovimiento(id, animal_id|lote_id, fecha,                 │
│               origen_potrero_id, destino_potrero_id,        │
│               motivo_id, operador_id)                        │
│                                                              │
│ EvtSanidad(id, animal_id|lote_id, fecha, producto_id,       │
│            dosis, via, lote_farmaco, operador_id,           │
│            veterinario, costo)                               │
│                                                              │
│ EvtServicio(id, hembra_id, macho_id, fecha,                 │
│             tipo[natural|IA], lote_semen, torada_id)        │
│                                                              │
│ EvtTacto(id, hembra_id, fecha, resultado, meses_gest,       │
│          veterinario_id)                                     │
│                                                              │
│ EvtParto(id, madre_id, fecha, cria_id, tipo_parto,          │
│          dificultad, peso_cria, vivo)                        │
│                                                              │
│ EvtDestete(id, cria_id, fecha, peso, metodo)                │
│                                                              │
│ EvtBaja(id, animal_id, fecha, causa_id, comprador_id,       │
│         precio_kg, peso_venta, doc_venta_id)                 │
└─────────────────────────────────────────────────────────────┘
```

### Fase 5: KPIs y Vistas (Prioridad Baja)

```
┌─────────────────────────────────────────────────────────────┐
│                    VISTAS CALCULADAS                         │
├─────────────────────────────────────────────────────────────┤
│ Vista: AnimalConKPIs                                         │
│   - ganancia_diaria (de eventos pesada)                     │
│   - dias_desde_ultima_sanidad                               │
│   - dias_preñez (de evento tacto)                           │
│   - eficiencia_conversion (eventos alimentación)            │
│   - alertas[] (reglas de negocio)                           │
│                                                              │
│ Vista: ResumenRodeo                                          │
│   - total_cabezas, por_categoria                            │
│   - peso_promedio, cc_promedio                              │
│   - tasa_preñez, tasa_destete, mortandad                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Migraciones Necesarias

### Orden de Implementación

```
Fase 1 (Semana 1-2): CATÁLOGOS
├── 1.1 Crear modelo Raza
├── 1.2 Crear modelo Categoria
├── 1.3 Crear modelo EstadoFisiologico
├── 1.4 Crear modelo ProductoSanitario
├── 1.5 Migrar datos existentes (texto → FK)
└── 1.6 Actualizar seed.ts

Fase 2 (Semana 2-3): MAESTROS
├── 2.1 Extraer Potrero de JSON a tabla
├── 2.2 Crear modelo Corral
├── 2.3 Crear modelo Proveedor/Cliente
├── 2.4 Crear modelo Rodeo
├── 2.5 Migrar ubicaciones existentes
└── 2.6 Actualizar APIs

Fase 3 (Semana 3-4): ANIMAL MEJORADO
├── 3.1 Agregar campos al modelo Bovino
│   ├── sexo, caravana_rfid, foto_uri
│   ├── estado_fisiologico_id
│   ├── potrero_id, rodeo_id
│   └── origen, proveedor_id
├── 3.2 Mismos cambios para Ovino
├── 3.3 Actualizar API y UI
└── 3.4 Migrar datos existentes

Fase 4 (Semana 4-6): EVENTOS
├── 4.1 Crear modelo EvtPesada
├── 4.2 Crear modelo EvtSanidad (expandir RegistroSanitario)
├── 4.3 Crear modelo EvtMovimiento
├── 4.4 Crear modelos reproductivos
│   ├── EvtServicio
│   ├── EvtTacto
│   └── EvtParto
├── 4.5 Crear modelo EvtBaja
├── 4.6 Migrar datos de historial JSON
└── 4.7 Crear triggers/funciones para snapshots
```

---

## Decisiones Arquitectónicas

### ¿Event Sourcing completo o híbrido?

**Recomendación: HÍBRIDO**

- **Snapshots en Animal**: peso_actual, cc_actual, ubicacion_actual
- **Eventos para historial**: EvtPesada, EvtMovimiento, etc.
- **Razón**: Simplifica queries frecuentes, mantiene auditabilidad

### ¿Catálogos editables o fijos?

**Recomendación: EDITABLES por organización**

```prisma
model Raza {
  id             String @id
  nombre         String
  especie        String
  organizacionId String? // null = catálogo global
}
```

### ¿Peso en Animal o solo en eventos?

**Recomendación: AMBOS**

- `peso_actual` en Animal (snapshot para queries rápidas)
- `EvtPesada` para historial completo
- Trigger: al crear EvtPesada, actualiza peso_actual

---

## Próximos Pasos

1. **Validar** este análisis con el usuario
2. **Priorizar** qué fases implementar primero
3. **Crear schema.prisma** con Fase 1
4. **Migrar** datos existentes
5. **Actualizar** APIs y UI

---

*Documento generado: Diciembre 2025*
*Proyecto: AgroMonitor ERP*

