# 04 — Producción de lana (PROLANA)

Módulo crítico para los dos clientes patagónicos. Hoy **no existe en el schema**: hay que crear todo el flujo desde la zafra de esquila hasta la liquidación de la lana.

## 4.1 Contexto productivo

- Chubut: principal provincia lanera de Argentina (60-70% del stock ovino merino).
- Río Negro: producción significativa, especialmente en la línea sur y zona andina.
- Razas: **Merino australiano** (lana fina, 18-22 μm), **Corriedale** (doble propósito, 27-30 μm), **Romney Marsh / Lincoln** (lana gruesa).
- 90%+ de la producción se exporta lavada, peinada o hilada (Europa, China, Turquía).
- **PROLANA** (Programa Nacional de Calidad de Lana) es el estándar de acondicionamiento técnico. La adhesión es voluntaria pero **el precio del kilo limpio PROLANA es notablemente superior**.

## 4.2 Workflow completo

```
1. Planificación de zafra
        │
        ▼
2. Esquila (galpón / comparsa)
        │
        ▼
3. Acondicionamiento PROLANA (clasificación a piso, embolsado)
        │
        ▼
4. Pesaje + romaneo (lote esquila → fardos)
        │
        ▼
5. Envío a laboratorio (muestras para análisis)
        │
        ▼
6. Liquidación y embarque
        │
        ▼
7. Cobranza
```

## 4.3 Entidades nuevas

```
model Esquila {
  id                String   @id @default(uuid()) @db.Uuid
  zafra             Int      // 2026 (año de zafra)
  fechaInicio       DateTime @db.Date
  fechaFin          DateTime? @db.Date
  comparsa          String?  // nombre de la comparsa / contratista
  sistema           String   // 'tally_hi' | 'maceta' | 'desmaneada' | 'preparto' | 'postparto'
  responsablePROLANA String? // clasificador PROLANA certificado
  certificadoPROLANA Boolean @default(false)
  certificadoNumero  String?

  establecimientoId String   @db.Uuid
  establecimiento   Establecimiento @relation(fields: [establecimientoId], references: [id])

  loteEsquilas      LoteEsquila[]
  fardos            Fardo[]
  observ            String?
  createdAt         DateTime @default(now())

  @@index([establecimientoId])
  @@index([zafra])
  @@map("esquilas")
}

model LoteEsquila {
  id                String   @id @default(uuid()) @db.Uuid
  nombre            String   // "Majada 1 - merino fino"
  categoria         String   // 'borrega' | 'oveja' | 'capon' | 'carnero' | 'cordero'
  raza              String?  // 'merino_australiano' | 'corriedale' | ...
  cantidadAnimales  Int
  pesoSucioKg       Float    // total esquilado
  pesoVellonPromedio Float?  // kg por animal
  fechaEsquila      DateTime @db.Date

  esquilaId         String   @db.Uuid
  esquila           Esquila  @relation(fields: [esquilaId], references: [id], onDelete: Cascade)

  loteAnimalId      String?  @db.Uuid // lote de animales (vínculo opcional)
  loteAnimal        Lote?    @relation(fields: [loteAnimalId], references: [id])

  fardos            Fardo[]
  analisis          AnalisisLana[]

  @@map("lotes_esquila")
}

model Fardo {
  id                String   @id @default(uuid()) @db.Uuid
  numero            String   // numeración interna o PROLANA
  tipoFibra         String   // 'velloncito' (vellón principal) | 'puntas' | 'barriga' | 'pedazos' | 'cogote' | 'bragas'
  pesoSucioKg       Float
  fechaPrensado     DateTime @db.Date

  esquilaId         String   @db.Uuid
  esquila           Esquila  @relation(fields: [esquilaId], references: [id])

  loteEsquilaId     String?  @db.Uuid
  loteEsquila       LoteEsquila? @relation(fields: [loteEsquilaId], references: [id])

  analisisLanaId    String?  @unique @db.Uuid
  analisisLana      AnalisisLana? @relation(fields: [analisisLanaId], references: [id])

  embarqueLanaId    String?  @db.Uuid
  embarqueLana      EmbarqueLana? @relation(fields: [embarqueLanaId], references: [id])

  observ            String?

  @@index([esquilaId])
  @@index([numero])
  @@map("fardos")
}

model AnalisisLana {
  id                String   @id @default(uuid()) @db.Uuid
  laboratorio       String   // "INTA Bariloche" | "Sipym" | "Lab Patagónico"
  fechaMuestra      DateTime @db.Date
  fechaResultado    DateTime? @db.Date

  // Resultados
  micronesPromedio  Float?   // μm — finura
  desviacionMicrones Float?  // CV de finura
  rindeAlPeinadoPct Float?   // ej: 64.5 (% kilo limpio sobre sucio)
  materiaVegetalPct Float?
  contenidoLanolinaPct Float?
  color             String?  // 'blanco' | 'crema' | 'amarillento'
  largoMechaMm      Float?
  resistenciaCNTex  Float?   // resistencia a la tracción

  loteEsquilaId     String?  @db.Uuid
  loteEsquila       LoteEsquila? @relation(fields: [loteEsquilaId], references: [id])

  fardos            Fardo[]

  observ            String?
  createdAt         DateTime @default(now())

  @@map("analisis_lana")
}

model EmbarqueLana {
  id                String   @id @default(uuid()) @db.Uuid
  fecha             DateTime @db.Date
  comprador         String   // razón social
  compradorCuit     String?
  transportista     String?
  remito            String?
  destino           String?  // dirección destino

  pesoTotalSucioKg  Float
  cantidadFardos    Int

  establecimientoId String   @db.Uuid
  establecimiento   Establecimiento @relation(fields: [establecimientoId], references: [id])

  fardos            Fardo[]
  liquidaciones     LiquidacionLana[]

  observ            String?
  createdAt         DateTime @default(now())

  @@index([establecimientoId])
  @@map("embarques_lana")
}

model LiquidacionLana {
  id                String   @id @default(uuid()) @db.Uuid
  fecha             DateTime @db.Date
  comprador         String
  numeroLiquidacion String?

  // Cálculo
  kilosSucios       Float
  rindePromedioPct  Float
  kilosLimpios      Float    // = kilosSucios * rindePromedioPct / 100
  precioUsdKgLimpio Float?
  precioArsKgLimpio Float?
  cotizacionUsdArs  Float?

  // Totales
  subtotalArs       Float
  bonificaciones    Float    @default(0) // ej. bonificación PROLANA
  retenciones       Float    @default(0)
  impuestos         Float    @default(0)
  netoArs           Float

  fechaCobro        DateTime? @db.Date
  estadoCobro       String   @default("pendiente") // 'pendiente' | 'parcial' | 'cobrado'

  embarqueLanaId    String?  @db.Uuid
  embarqueLana      EmbarqueLana? @relation(fields: [embarqueLanaId], references: [id])

  documentoUrl      String?  // PDF de la liquidación

  @@map("liquidaciones_lana")
}
```

## 4.4 Reglas de negocio

### Validaciones al crear `Esquila`
- `establecimientoId` debe tener `programaPROLANA = true` si `certificadoPROLANA = true`.
- `responsablePROLANA` obligatorio si `certificadoPROLANA = true`.
- `fechaFin >= fechaInicio` cuando se cierra.

### Validaciones al crear `Fardo`
- El total de pesos de fardos debe coincidir (±1%) con el peso sucio del `LoteEsquila` o de la `Esquila`.
- Numeración correlativa por establecimiento + zafra.

### Trigger al cerrar `Esquila`
- Generar `EvtAlimentacionForraje` invertido si correspondiera (consumo de reservas no aplica aquí, pero **sí registrar el descanso post-esquila** como nota agronómica).
- Crear `EvtSanidad` opcional de "antiparasitario post-esquila" si está en el calendario sanitario.

### Cálculo del kilo limpio
```
kilosLimpios = kilosSucios * (rindeAlPeinadoPct / 100)
ingresoBrutoArs = kilosLimpios * precioArsKgLimpio
```

El precio se negocia por μm (a menor micraje, mayor precio).

### Bonificación PROLANA
Si el certificado PROLANA está válido para la zafra, el comprador aplica una bonificación al precio (típicamente 5-10% sobre el precio base, según contrato). Modelarlo como porcentaje en `LiquidacionLana.bonificaciones`.

## 4.5 Categorías de fibra (clasificación PROLANA)

| Tipo | Origen | Calidad | Precio relativo |
|---|---|---|---|
| **Vellón principal** (velloncito) | Cuerpo, lomo, costillares | Mejor | 100% |
| **Bragas** | Periné, cara interna patas | Media | 60-70% |
| **Barriga** | Vientre | Media-baja | 50-60% |
| **Pedazos** | Recortes | Baja | 40-50% |
| **Puntas** | Extremos sucios | Muy baja | 20-30% |
| **Cogote** | Cuello | Variable | 50-70% |

Cada fardo se prensa por tipo. La planilla PROLANA exige reportar pesos por tipo.

## 4.6 Análisis de laboratorio

Los laboratorios típicos en Patagonia:
- **INTA Bariloche** (Río Negro).
- **SIPyM** (Servicio de Pruebas y Mediciones) de PROLANA.
- **Lab Patagónico** privado.

Se envían muestras (testigo) de cada lote de esquila → el laboratorio devuelve micrones, rinde al peinado, materia vegetal, color. El sistema permite cargar el resultado e imprimirlo asociado a fardos/embarques.

## 4.7 Workflow PWA en galpón

Pantalla optimizada para tablet en galpón de esquila:
1. **Iniciar esquila** — datos básicos (zafra, comparsa, sistema).
2. **Cargar lote esquila** — categoría, cantidad de animales, peso total al cerrar el día.
3. **Cargar fardos** — numerar, pesar, tipo de fibra.
4. **Cerrar esquila** — totales y observaciones.
5. **Sincroniza al recuperar red.**

## 4.8 KPIs del módulo

- **Kg lana sucia / oveja esquilada** (por raza, categoría, zafra).
- **Rinde promedio por establecimiento** (μm, % kilo limpio, materia vegetal).
- **Comparativo zafras** (año vs año).
- **% lana PROLANA / total** (cuánto del total se certifica).
- **Precio promedio kg limpio cobrado** (USD/ARS).
- **Días entre esquila y cobranza** (financiero).

## 4.9 Integración con sanidad

- **No aplicar antiparasitarios baño 30 días antes de esquila** (residuos en la lana). El sistema bloquea o alerta.
- Post-esquila, generar tarea de antiparasitario inyectable / pour-on.

## Pendientes con cliente

- ¿Tienen certificado PROLANA vigente?
- ¿Qué laboratorio usan?
- ¿Comprador habitual? (Lorenzato, Fuhrmann, Chargeurs, etc.)
- ¿Vende lana sucia "al barrer" o ya con análisis pre-venta?
- ¿Esquila pre-parto o post-parto?
- ¿Cuántas comparsas trabajan? ¿son contratadas o propias?
