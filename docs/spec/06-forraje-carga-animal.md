# 06 — Forraje y carga animal

Balance forrajero: cuánta materia seca (MS) hay disponible, cuánta consumen los animales que están en cada potrero, y por cuánto tiempo se puede sostener. Crítico en campos extensivos patagónicos donde los recursos son limitados y las cargas animales son bajas.

## 6.1 Lo que ya existe en el schema

| Modelo | Función |
|---|---|
| `Forraje` | Catálogo de especies forrajeras (festuca, alfalfa, raigrás, avena, sorgo, etc.). |
| `SectorForraje` | Qué forraje hay sembrado en cada sector y desde cuándo. |
| `MedicionPotrero` | Mediciones de pasto (altura, MS kg/ha, cobertura) en una fecha. |
| `EvtPastoreo` | Período de pastoreo de un lote en un sector (ingreso/egreso). |
| `Dieta`, `DietaComponente` | Receta nutricional. |
| `PlanAlimentacion` | Asignación de dieta a lote en período. |
| `EvtAlimentacion` | Registro real de suministro. |

Cobertura conceptual: alta. Pero faltan **catálogo de pasturas naturales patagónicas**, **aforos sistemáticos**, **reservas forrajeras** (rollos, fardos, silo bolsa) y el **cálculo de carga animal en EV/ha**.

## 6.2 Catálogo de forrajes — seed para Patagonia

Además de las especies pampeanas, el seed debe incluir:

- **Pasto llorón** (Eragrostis curvula) — pastura de baja calidad pero adaptada a la meseta.
- **Festuca alta** (Festuca arundinacea) — riego en valle.
- **Agropiro alargado** (Thinopyrum ponticum) — suelos salinos.
- **Alfalfa** (Medicago sativa) — valles bajo riego.
- **Cebadilla criolla** (Bromus catharticus) — natural mejorada.
- **Trébol blanco** (Trifolium repens) — valle, riego.
- **Coirones** (Festuca pallescens, Pappostipa speciosa, etc.) — natural patagónica.
- **Mata negra** (Mulguraea tridens) — arbusto, palatabilidad estacional.

Estos coirones y arbustos son la base de la dieta ovina en monte patagónico — no son una pastura sembrada pero sí un componente del "tipo de campo natural".

## 6.3 Reservas forrajeras (entidad nueva)

```
model Reserva {
  id                String   @id @default(uuid()) @db.Uuid
  tipo              String   // 'rollo' | 'fardo' | 'silo_bolsa' | 'silo_torta' | 'henilage' | 'grano'
  insumo            String   // 'alfalfa' | 'avena' | 'maíz' | 'mezcla'
  fechaConfeccion   DateTime? @db.Date
  cantidadInicial   Int      // unidades (rollos) o kg
  cantidadActual    Int
  unidad            String   // 'unidad' | 'kg' | 'tn'

  pesoUnitarioKg    Float?   // peso típico por unidad (rollo 350-500kg)
  msPct             Float?   // % materia seca
  proteinaPct       Float?
  energiaMcalKg     Float?

  ubicacionSectorId String?  @db.Uuid
  ubicacionSector   Sector?  @relation(fields: [ubicacionSectorId], references: [id])

  establecimientoId String   @db.Uuid
  establecimiento   Establecimiento @relation(fields: [establecimientoId], references: [id])

  consumos          ConsumoReserva[]

  observ            String?
  createdAt         DateTime @default(now())

  @@index([establecimientoId])
  @@map("reservas")
}

model ConsumoReserva {
  id          String   @id @default(uuid()) @db.Uuid
  fecha       DateTime @db.Date
  cantidad    Int
  motivo      String?  // 'consumo_normal' | 'merma' | 'descarte'

  reservaId   String   @db.Uuid
  reserva     Reserva  @relation(fields: [reservaId], references: [id], onDelete: Cascade)

  loteId      String?  @db.Uuid
  lote        Lote?    @relation(fields: [loteId], references: [id])

  @@index([reservaId])
  @@index([fecha])
  @@map("consumos_reserva")
}
```

## 6.4 Aforos (extensión a `MedicionPotrero`)

`MedicionPotrero` ya tiene `alturaPastoCm`, `msKgHa`, `coberturaPct`. Suficiente para aforos básicos. Agregar:

- `metodo` — `'altura'` | `'doble_muestreo'` | `'estimacion_visual'` | `'rising_plate'`.
- `numeroMuestras` — int (calidad del aforo).
- `tipoPastura` — `'pastura'` | `'verdeo'` | `'natural'` | `'rastrojo'`.

## 6.5 Cálculo de carga animal (EV/ha)

**Equivalencias estándar argentinas:**

| Categoría | EV (Equivalente Vaca) |
|---|---|
| Vaca + ternero | 1.00 |
| Vaca seca | 0.85 |
| Vaquillona | 0.75 |
| Novillito | 0.70 |
| Novillo | 0.95 |
| Ternero/a (post-destete) | 0.50 |
| Toro | 1.20 |
| Oveja madre | 0.16-0.18 (≈1 EV = 6 ovejas) |
| Capón | 0.13 |
| Borrega | 0.13 |
| Carnero | 0.18 |
| Cordero | 0.08 |

**Función `calcularCargaAnimal(sector, fecha)`:**

```ts
function calcularCargaAnimal(sectorId: string, fecha: Date): {
  totalEV: number,
  superficieHa: number,
  cargaInstantanea: number  // EV/ha
} {
  // 1. animales en el sector a la fecha (via UbicacionHist)
  // 2. para cada animal: categoría → EV
  // 3. sum EV / Sector.superficieHa
}
```

Persistir el resultado como `MedicionPotrero` periódica (o calcular on-demand).

## 6.6 Balance forrajero

Pantalla "Balance forrajero" del establecimiento:

```
Sector "Potrero 4" - 350 ha
Aforos:
  - 2026-04-15: 850 kg MS/ha → 297,500 kg MS total
  - 2026-05-15: 720 kg MS/ha → 252,000 kg MS total

Carga actual: 180 vacas + 5 toros = 186 EV → 0.53 EV/ha

Consumo estimado: 186 EV × 12 kg MS/día = 2,232 kg MS/día
Días de pastoreo proyectados: 252,000 / 2,232 = 112 días
```

## 6.7 Asignación de potreros (planificación)

Permite asignar lotes de animales a sectores con fechas previstas de pastoreo:

```
model AsignacionPotrero {
  id          String   @id @default(uuid()) @db.Uuid
  fechaInicio DateTime @db.Date
  fechaFin    DateTime? @db.Date
  cantidadAnimalesEstim Int
  estado      String   @default("planificada") // 'planificada' | 'en_curso' | 'cumplida' | 'cancelada'

  loteId      String   @db.Uuid
  sectorId    String   @db.Uuid

  observ      String?
  createdAt   DateTime @default(now())

  @@map("asignaciones_potrero")
}
```

(Opcional para MVP — `EvtPastoreo` cubre el caso ejecutado).

## 6.8 KPIs del módulo

- **Carga animal promedio** por establecimiento (EV/ha).
- **MS disponible total** por establecimiento.
- **Días de pastoreo proyectados** con la carga actual.
- **Reservas en stock** (rollos, fardos, silo) y autonomía estimada.
- **Tasa de utilización** (kg MS consumido / kg MS producido).

## 6.9 Cultivos / verdeos (out of scope detallado)

El módulo existente de **Cultivos** maneja siembras y cosechas. La integración con forraje:
- Una siembra de verdeo (avena/centeno) genera `SectorForraje` al implantarse.
- El rinde de cosecha (si se reserva) genera `Reserva`.

Spec detallada de cultivos queda fuera de esta versión.

## Pendientes con cliente

- ¿Hace aforos sistemáticos o estimación visual?
- ¿Confecciona reservas en el campo o las compra?
- ¿Riega valles (Río Negro)? Implica pasturas implantadas vs natural.
- ¿Carneada de coirón (uso del campo natural)? Influye en cómo se modelan los sectores.
