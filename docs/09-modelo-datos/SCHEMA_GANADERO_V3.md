# 🐄 Schema Ganadero v3 - Modelo Híbrido Final

## Resumen

El Schema v3 combina lo mejor de dos enfoques:
- **Estructura de producción real** (tu propuesta)
- **Compatibilidad Prisma/Next.js** (mi implementación)

---

## Características Principales

| Característica | Implementación |
|----------------|----------------|
| **Especie como tabla** | ✅ Extensible a ovino, equino, etc. |
| **Sector unificado** | ✅ potrero, corral, manga, feedlot |
| **Forraje/Pastura** | ✅ Catálogo + historial por sector |
| **Balance forrajero** | ✅ Mediciones + pastoreo |
| **Animal minimalista** | ✅ Estados derivados de eventos |
| **EAV extensible** | ✅ `animal_attr` para atributos custom |
| **Event Sourcing** | ✅ Eventos para todo el ciclo |
| **Ciclo reproductivo** | ✅ Torada → Servicio → Tacto → Parto → Destete |
| **Alimentación híbrida** | ✅ Por lote con registro diario |
| **Cabaña (opcional)** | ✅ Campos para registro genético |
| **Vistas SQL** | ✅ 9 vistas predefinidas |
| **UUID** | ✅ Para todas las PKs |
| **Auditoría** | ✅ `audit_log` con JSONB |

---

## Estructura de Archivos

```
prisma/
├── schema.prisma              ← Schema actual (respaldo)
├── schema-ganadero-v3.prisma  ← NUEVO schema híbrido
└── vistas-sql.sql             ← Vistas PostgreSQL
```

---

## Diagrama de Entidades

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ORGANIZACIÓN                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────┐                       │
│  │   CATÁLOGOS      │    │   TERCEROS       │                       │
│  ├──────────────────┤    ├──────────────────┤                       │
│  │ • Especie        │    │ • Proveedor      │                       │
│  │ • Raza           │    │ • Cliente        │                       │
│  │ • Categoria      │    │                  │                       │
│  │ • Producto       │    │                  │                       │
│  │ • Forraje        │    │                  │                       │
│  │ • Dieta          │    │                  │                       │
│  └──────────────────┘    └──────────────────┘                       │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    ESTABLECIMIENTO                            │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │                                                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │   │
│  │  │   SECTOR    │  │   SECTOR    │  │   SECTOR    │           │   │
│  │  │  (potrero)  │  │  (corral)   │  │  (feedlot)  │           │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘           │   │
│  │        │                                                      │   │
│  │        ├── SectorForraje (qué pastura hay)                   │   │
│  │        ├── MedicionPotrero (altura, MS/ha)                   │   │
│  │        └── EvtPastoreo (ingreso/egreso lote)                 │   │
│  │                                                               │   │
│  │  ┌─────────────────────────────────────────────────────┐     │   │
│  │  │                    LOTES / RODEOS                    │     │   │
│  │  ├─────────────────────────────────────────────────────┤     │   │
│  │  │  • Lote Cría     • Lote Recría    • Lote Engorde   │     │   │
│  │  │                                                      │     │   │
│  │  │  └── AnimalLoteHist (qué animales, desde cuándo)   │     │   │
│  │  │  └── PlanAlimentacion (dieta asignada)             │     │   │
│  │  │  └── Torada (temporada de servicio)                │     │   │
│  │  └─────────────────────────────────────────────────────┘     │   │
│  │                                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                         ANIMAL                                │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  Identificación: cuig, caravana_visual, caravana_rfid        │   │
│  │  Básicos: sexo, fecha_nacimiento, estado_vital               │   │
│  │  Físicos: color_manto, mocho, denticion, marca_fuego         │   │
│  │                                                               │   │
│  │  ├── Genealogia (1:1) - padre, madre                         │   │
│  │  ├── AnimalAttr (EAV) - atributos extensibles                │   │
│  │  ├── UbicacionHist - dónde está/estuvo                       │   │
│  │  └── AnimalLoteHist - a qué lote pertenece/perteneció        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                        EVENTOS                                │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  • EvtParicion (nacimiento)     • EvtServicio (monta/IA)     │   │
│  │  • EvtDestete                   • EvtTacto (preñez)          │   │
│  │  • EvtPesada                    • EvtBaja (venta/muerte)     │   │
│  │  • EvtSanidad                   • EvtAlimentacion            │   │
│  │  • EvtMovimiento                • EvtPastoreo                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Modelo Animal - Filosofía

### Estados DERIVADOS (no almacenados)

```
┌─────────────────────────────────────────────────────────────┐
│  En lugar de guardar:          Calculamos de eventos:       │
├─────────────────────────────────────────────────────────────┤
│  peso_actual                →  Último EvtPesada             │
│  ubicacion_actual           →  Último UbicacionHist         │
│  lote_actual                →  Último AnimalLoteHist        │
│  estado_reproductivo        →  Último EvtTacto + EvtParto   │
│  fecha_fin_carencia         →  EvtSanidad + Producto.retiro │
│  ganancia_diaria            →  Diferencia entre pesadas     │
└─────────────────────────────────────────────────────────────┘
```

### Atributos EAV (Entity-Attribute-Value)

Para datos no estándar sin modificar el schema:

```sql
-- Línea sanguínea
INSERT INTO animal_attrs (animal_id, clave, valor)
VALUES ('uuid', 'linea_sanguinea', 'Angus Puro Pedigree');

-- DEP de peso al destete (cabaña)
INSERT INTO animal_attrs (animal_id, clave, valor, desde)
VALUES ('uuid', 'dep_peso_destete', '+25.4', '2024-01-01');

-- Biotipo
INSERT INTO animal_attrs (animal_id, clave, valor)
VALUES ('uuid', 'biotipo', 'Británico carnicero');
```

---

## Vistas SQL Incluidas

| Vista | Descripción |
|-------|-------------|
| `v_ubicacion_actual` | Dónde está cada animal ahora |
| `v_lote_actual` | A qué lote pertenece cada animal |
| `v_stock_por_sector` | Cantidad de animales por sector |
| `v_stock_por_lote` | Cantidad de animales por lote |
| `v_ultimo_peso` | Última pesada de cada animal |
| `v_carencias_activas` | Animales en período de retiro |
| `v_estado_reproductivo` | Estado reproductivo de hembras |
| `v_timeline_animal` | Historia completa de un animal |
| `v_kpi_rodeo` | KPIs por lote (cantidad, peso prom, CC) |

---

## Ciclo Reproductivo

```
TORADA                    ← Temporada de servicio (otoño/primavera)
    │
    └── EvtServicio       ← Monta natural o IA
            │
            └── EvtTacto  ← Diagnóstico (60-90 días)
                    │
                    └── EvtParicion  ← Nacimiento (9 meses)
                            │
                            └── EvtDestete  ← Separación (6-8 meses)
```

---

## Balance Forrajero

```
Sector (potrero)
    │
    ├── SectorForraje     ← Qué pastura hay (festuca, alfalfa)
    │       desde/hasta, densidad siembra
    │
    ├── MedicionPotrero   ← Estado del pasto
    │       altura_cm, ms_kg_ha, cobertura_%
    │
    └── EvtPastoreo       ← Uso del potrero
            lote, ingreso, egreso, animales_promedio
            
            → Cálculo: días ocupación × animales × consumo = demanda
            → Cálculo: ms_kg_ha × hectáreas = oferta
            → Balance = oferta - demanda
```

---

## Migracion desde Schema Actual

### Paso 1: Respaldar

```bash
cp prisma/schema.prisma prisma/schema-backup.prisma
```

### Paso 2: Reemplazar

```bash
cp prisma/schema-ganadero-v3.prisma prisma/schema.prisma
```

### Paso 3: Crear seed de catálogos base

```typescript
// Especies
await prisma.especie.createMany({
  data: [
    { nombre: 'bovino' },
    { nombre: 'ovino' },
  ]
});

// Categorías bovino
await prisma.categoria.createMany({
  data: [
    { especieId: bovinoId, nombre: 'ternero', sexo: 'M', edadMaxMeses: 12 },
    { especieId: bovinoId, nombre: 'ternera', sexo: 'F', edadMaxMeses: 12 },
    { especieId: bovinoId, nombre: 'novillito', sexo: 'M', edadMinMeses: 12, edadMaxMeses: 24 },
    { especieId: bovinoId, nombre: 'vaquillona', sexo: 'F', edadMinMeses: 12, edadMaxMeses: 36 },
    { especieId: bovinoId, nombre: 'novillo', sexo: 'M', edadMinMeses: 24 },
    { especieId: bovinoId, nombre: 'vaca', sexo: 'F', edadMinMeses: 36 },
    { especieId: bovinoId, nombre: 'toro', sexo: 'M', edadMinMeses: 24 },
  ]
});

// Razas comunes
await prisma.raza.createMany({
  data: [
    { especieId: bovinoId, nombre: 'Angus' },
    { especieId: bovinoId, nombre: 'Hereford' },
    { especieId: bovinoId, nombre: 'Brangus' },
    { especieId: bovinoId, nombre: 'Braford' },
    { especieId: bovinoId, nombre: 'Limousin' },
    { especieId: bovinoId, nombre: 'Cruza' },
  ]
});

// Forrajes
await prisma.forraje.createMany({
  data: [
    { nombre: 'festuca', tipo: 'perenne', clase: 'pastura' },
    { nombre: 'alfalfa', tipo: 'perenne', clase: 'pastura' },
    { nombre: 'raigrás', tipo: 'anual', clase: 'verdeo' },
    { nombre: 'avena', tipo: 'anual', clase: 'verdeo' },
    { nombre: 'sorgo forrajero', tipo: 'anual', clase: 'verdeo' },
    { nombre: 'campo natural', tipo: 'perenne', clase: 'pastura' },
  ]
});
```

### Paso 4: Migrar datos existentes

Script de migración para convertir datos del schema actual al v3.

### Paso 5: Crear vistas

```bash
psql $DATABASE_URL -f prisma/vistas-sql.sql
```

---

## Próximos Pasos

1. ✅ Schema v3 creado
2. ✅ Vistas SQL definidas
3. ⏳ Crear seed de catálogos base
4. ⏳ Script de migración de datos
5. ⏳ Actualizar APIs
6. ⏳ Actualizar UI

---

*Creado: Diciembre 2025*
*Proyecto: AgroMonitor ERP*

