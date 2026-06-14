# 02 — Sanidad

Plan sanitario diferencial por especie y zona, con énfasis en las particularidades de Patagonia (zona libre de aftosa sin vacunación) y producción ovina (sarna, hidatidosis).

## 2.1 Modelo conceptual

Tres entidades nuevas que componen el motor sanitario:

```
ProtocoloSanitario  ──◀──  ItemProtocolo
       │
       ▼
CalendarioSanitario ──▶  Tarea  (planificada)
       │                   │
       └──── proyecta ─────┘
                           ▼
                       EvtSanidad  (ejecutada)
```

- **`ProtocoloSanitario`**: receta sanitaria (qué se hace y cuándo) — definida por veterinario para un perfil (especie, categoría, zona). Reusable entre establecimientos.
- **`ItemProtocolo`**: cada evento esperado del protocolo (producto, dosis, vía, edad/fecha objetivo).
- **`CalendarioSanitario`**: instancia del protocolo aplicada a un lote o establecimiento, con fechas concretas y responsables.
- **`Tarea`** (ya existe): cada item proyectado genera una tarea pendiente con `tipo='sanitario'`.
- **`EvtSanidad`** (ya existe): la ejecución real, vinculada de vuelta al item del calendario.

## 2.2 Plan sanitario bovino — Argentina general

| Enfermedad | Tipo | Edad/Aplicación | Frecuencia | Notas |
|---|---|---|---|---|
| **Aftosa** | Vacunación (cepa cuadrivalente) | Todas las categorías | Campaña 1 (otoño): todas las categorías. Campaña 2 (primavera): solo terneros. | Solo en zona **con vacunación**. Cronograma SENASA. |
| **Brucelosis bovina** | Vacunación B19 | Terneras 3-8 meses, una vez en la vida | Simultánea con aftosa | Excepto Tierra del Fuego. RB51 para refugos. |
| **Tuberculosis** | Tuberculinización | Reproductores y movimientos | Anual / pre-movimiento | Prueba 60-90 días antes del DT-e. |
| **Carbunclo** | Vacunación | Bovinos > 6 meses | Anual | Foco endémico en pampa húmeda. Patagonia: confirmar con vet local. |
| **Mancha / gangrena** | Vacunación clostridial | Terneros al destete y recría | Anual con refuerzo | Polivalente clostridial. |
| **Enfermedades venéreas (Trichomoniasis, Campilobacteriosis)** | Raspaje prepucial | Toros pre-servicio | Anual | Solo machos reproductores. |
| **Parásitos internos** | Antiparasitario (ivermectina, levamisol) | Categorías jóvenes y adultos en otoño/primavera | 2-4× año | Rotar principios activos. |
| **Sarna / piojos** | Pour-on / baño | Todas las categorías | Otoño y primavera | Diagnóstico previo. |

## 2.3 Plan sanitario ovino — Argentina general (énfasis Patagonia)

Marco regulatorio: **Res. SENASA 40/2016** (sarna, melofagosis y pediculosis ovina).

| Enfermedad | Tipo | Edad/Aplicación | Frecuencia | Notas |
|---|---|---|---|---|
| **Sarna ovina** | Baño / inyectable | Toda la majada | 2× año en trashumantes, 1× en majada fija. **Obligatorio.** | Patagonia: principal problema sanitario ovino. |
| **Melofagosis (falsa garrapata)** | Baño / pour-on | Toda la majada | Junto con sarna | Resol. 40/2016 lo incluye. |
| **Pediculosis (piojos)** | Baño / pour-on | Toda la majada | Junto con sarna | Resol. 40/2016 lo incluye. |
| **Hidatidosis (equinococosis)** | Dosificación canina + control campañas | Perros del campo | Cada 45 días | Programa histórico desde 1948. Patagonia endémica. Ver §2.5. |
| **Enterotoxemia / clostridiosis** | Vacunación polivalente | Corderos al destete y borregos | Anual | Crucial en majadas con buen estado nutricional. |
| **Brucelosis ovina (B. ovis)** | Diagnóstico carneros | Pre-servicio | Anual | Examen serológico carneros + examen físico testicular. |
| **Parásitos GI** | Antiparasitario | Corderos, borregos, vientres pre-parto | 2-3× año | Detección de resistencia recomendada (HPG). |
| **Distomatosis (fasciola)** | Antifasciolicida | Donde hay caracoles (valles húmedos RN) | 1-2× año | Confirmar relevancia con vet local. |
| **Ectima contagioso** | Vacunación | Si hay antecedentes | Anual | Endémica en Patagonia. |

## 2.4 Diferencial Patagonia — Zona Libre de Aftosa Sin Vacunación (ZLSV)

**Reconocida por WOAH (2002)**. Incluye **toda la Patagonia al sur del paralelo 42º**: Chubut completo, Santa Cruz, Tierra del Fuego, y la mayor parte de Río Negro (sur del paralelo 42). El norte de Río Negro y otras provincias están **bajo vacunación**.

### Reglas operativas en el sistema

Por establecimiento se configura `Establecimiento.zonaAftosa`:
- `'libre_sin_vacunacion'` (ZLSV) — **no se generan campañas aftosa**.
- `'con_vacunacion'` — se generan 2 campañas anuales como tareas obligatorias.
- `'libre_con_vacunacion'` — algunas provincias tienen este estatus intermedio.

### Movimientos entre zonas

- **Salida de ZLSV hacia zona con vacuna**: en general permitido sin restricción especial (la zona origen es de menor riesgo).
- **Ingreso a ZLSV desde zona con vacuna**: prohibido para bovinos vivos en general; el sistema debe **bloquear** la emisión de DT-e con destino en establecimiento ZLSV si el origen no es ZLSV.
- **Ingreso de carne fresca**: regulado, ver con SENASA. El sistema solo trackea hacienda en pie.

### Validación en DT-e

```
si destino.zonaAftosa = 'libre_sin_vacunacion'
  y origen.zonaAftosa != 'libre_sin_vacunacion':
  bloquear emisión y alertar "Restricción ZLSV - consulte SENASA"
```

## 2.5 Hidatidosis — programa Patagonia

Importante por salud pública. Implementación en el ERP:

- **Censo canino** por establecimiento (perros del campo, no mascotas urbanas).
- **Dosificación periódica** con praziquantel cada 45 días → tarea recurrente.
- **Registro de tratamientos** ligado al perro, no al ganado (entidad auxiliar `Canino` o usar `Animal` con `Especie='canino'` flag-only).
- Articulación con autoridad sanitaria provincial (Chubut: Programa Hidatidosis del Ministerio de Salud).

Recomendación: módulo simple `SanidadCanina` con tabla `Canino { id, nombre, edad, establecimientoId }` y `EvtDosificacionCanina`. Out of scope del MVP pero documentado.

## 2.6 ProtocoloSanitario — modelo de datos propuesto

```
model ProtocoloSanitario {
  id              String   @id @default(uuid()) @db.Uuid
  nombre          String   // "Sanidad bovina Patagonia ZLSV - base"
  descripcion     String?
  especie         String   // 'bovino' | 'ovino' | ...
  categoriaAplicable String? // 'ternero' | 'vaca' | 'todos'
  zonaAplicable   String?  // 'libre_sin_vacunacion' | 'con_vacunacion' | null
  esPublico       Boolean  @default(false) // template del sistema vs custom de la org
  activo          Boolean  @default(true)

  organizacionId  String?  @db.Uuid // null si es template del sistema
  organizacion    Organizacion? @relation(fields: [organizacionId], references: [id])

  items           ItemProtocolo[]
  calendarios     CalendarioSanitario[]

  @@map("protocolos_sanitarios")
}

model ItemProtocolo {
  id              String   @id @default(uuid()) @db.Uuid
  orden           Int
  nombre          String   // "Vacunación brucelosis B19"
  edadDiasMin     Int?     // 90
  edadDiasMax     Int?     // 240
  fechaRelativa   String?  // "campania_aftosa_otoño" | "destete" | "pre_servicio"
  diasOffset      Int?     // -30 desde fechaRelativa
  productoTipo    String?  // 'vacuna' | 'antiparasitario' | etc.
  productoId      String?  @db.Uuid
  producto        Producto? @relation(fields: [productoId], references: [id])
  dosis           Float?
  unidad          String?
  via             String?
  obligatorio     Boolean  @default(true)
  notas           String?

  protocoloId     String   @db.Uuid
  protocolo       ProtocoloSanitario @relation(fields: [protocoloId], references: [id], onDelete: Cascade)

  @@map("items_protocolo")
}

model CalendarioSanitario {
  id              String   @id @default(uuid()) @db.Uuid
  nombre          String   // "Plan 2026 - Establecimiento Las Lajas"
  anio            Int
  activo          Boolean  @default(true)
  fechaCampanaOtonio    DateTime? @db.Date // ancla de la campaña aftosa de otoño
  fechaCampanaPrimavera DateTime? @db.Date

  protocoloId       String @db.Uuid
  protocolo         ProtocoloSanitario @relation(fields: [protocoloId], references: [id])

  establecimientoId String @db.Uuid
  establecimiento   Establecimiento @relation(fields: [establecimientoId], references: [id])

  loteId            String? @db.Uuid // opcional: calendario por lote
  lote              Lote? @relation(fields: [loteId], references: [id])

  @@map("calendarios_sanitarios")
}
```

`EvtSanidad` ya existe — al ejecutarse, **se vincula opcionalmente al `itemProtocoloId`** que cumple. Agregar columna `itemProtocoloId` opcional a `EvtSanidad`.

## 2.7 Generador automático de tareas

Cuando se activa un `CalendarioSanitario` para un establecimiento:

1. Para cada `ItemProtocolo`, calcular la fecha estimada:
   - Si `fechaRelativa = 'campania_aftosa_otonio'`, usar la fecha configurada del calendario.
   - Si `edadDiasMin/Max`, calcular para cada animal/categoría aplicable.
2. Crear una `Tarea` con:
   - `tipo='sanitario'`
   - `fechaLimite = fechaEstimada + diasOffset`
   - `descripcion = nombre del item + producto + dosis`
   - `establecimientoId = ...`
   - `prioridad = obligatorio ? 'alta' : 'media'`
3. Al completar la tarea, sugerir cargar el `EvtSanidad` correspondiente (deep link).

## 2.8 Carencia y períodos de retiro

`Producto.retiroDias` ya existe. Cuando se aplica un `EvtSanidad`:

1. Calcular `fechaLiberacion = fecha + retiroDias` (o `carenciaDias` del evento si fue override).
2. **Bloquear DT-e con `motivo='faena'`** para animales bajo retiro hasta `fechaLiberacion`.
3. **Alertar** si se intenta despachar a frigorífico un animal bajo retiro.

## 2.9 Templates iniciales (seed)

El sistema viene con templates `ProtocoloSanitario` cargados por seed:

1. **Bovino general (con vacunación)** — Pampa húmeda estándar.
2. **Bovino Patagonia ZLSV** — Sin aftosa, con brucelosis B19, parasitarios, clostridiales.
3. **Ovino Patagonia base** — Sarna+melofagosis+pediculosis 2× año, hidatidosis canina, clostridiales, parásitos GI.
4. **Ovino PROLANA** — Adicional al base, con timing pre-esquila (sin tratamientos cerca de la zafra).
5. **Bovino reproductor (toros)** — Sanidad venérea + tuberculinización pre-servicio.

El cliente clona un template y lo ajusta. Lo subido por el cliente queda con `esPublico=false` y atado a su `Organizacion`.

## 2.10 KPIs del módulo

- Cobertura sanitaria (% animales con esquema completo del año).
- Tareas sanitarias vencidas / total.
- Costo sanitario por categoría / por animal.
- Casos clínicos (`EvtSanidad.motivo='curativo'`) por mes — alerta de brote.
- Animales bajo retiro a la fecha (no faenables).

## Pendientes con cliente

- Confirmar vet de cabecera de cada campo (algunos vets prescriben protocolos custom).
- Confirmar si Río Negro está al norte o sur del paralelo 42 (define zona aftosa).
- Validar si tienen registro previo de calendario sanitario y formato.
- Decidir si se incluye `SanidadCanina` (hidatidosis) en MVP o se difiere.
