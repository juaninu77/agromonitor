# 03 — Reproducción

Ciclo reproductivo bovino y ovino. El schema actual cubre bien el caso bovino — para ovino hay que generalizar nombres y agregar la **señalada**.

## 3.1 Ciclo bovino

```
Servicio (natural / IA / IATF)
    │
    ▼
Tacto (30-90 días post servicio)
    │
    ├── preñada ────┐
    ├── vacía       │
    └── dudosa      │
                    ▼
              Parición (~283 días)
                    │
                    ▼
            Destete (180-240 días)
```

Eventos involucrados (todos ya existen en schema):
- `Torada` — período/temporada de servicio
- `EvtServicio` — cada monta o IA individual
- `EvtTacto` — diagnóstico de preñez (palpación o ecografía)
- `EvtParicion` — parto (con cría como `Animal` nuevo si vivo)
- `EvtDestete` — separación cría/madre

## 3.2 Ciclo ovino — diferencias

```
Encarnerada (período de servicio con carneros) [análogo a Torada]
    │
    ▼
Tacto / ecografía (45-60 días post inicio)
    │
    ▼
Parición (~150 días)
    │
    ▼
Señalada (marcación a 30-60 días de nacidos)   ← evento nuevo
    │
    ▼
Destete (90-120 días)
    │
    ▼
Esquila / clasificación (ver 04-produccion-lana.md)
```

### Diferencias clave bovino vs ovino

| Aspecto | Bovino | Ovino |
|---|---|---|
| Período gestación | ~283 días | ~150 días |
| Servicio típico | Servicio natural / IA / IATF | Encarnerada con carneros (proporción ~3-4% carneros sobre majada) |
| Tacto | Palpación a 60-90 días, ecografía desde 30 | Ecografía 45-60 días post encarnerada |
| Marcación cría | (no aplica como evento separado) | **Señalada** — corte de señal en oreja, castración machos, descole, vacuna clostridial |
| Destete | 180-240 días | 90-120 días |
| Esquila | (no aplica) | Anual (o pre-parto + post-parto en algunos sistemas) |

## 3.3 Decisión: extender Torada o crear Encarnerada

**Opción A — Generalizar `Torada` a `GrupoReproductivo`.** Rename + agregar `tipoGrupo = 'torada' | 'encarnerada'`. Migración con `@@map("toradas")` mantenida.

**Opción B — Crear `Encarnerada` espejo.** Más explícito en el código, redundante en esquema.

**Recomendación: opción A.** El concepto es idéntico (período de servicio con macho/s sobre un lote de hembras); cambia solo el nombre.

Cambios en el modelo:
```
model Torada {
  ...
  tipoGrupo       String   @default("torada")  // 'torada' | 'encarnerada'
  // 'torada' para bovinos, 'encarnerada' para ovinos
  ...
}
```

UI: usar el término correcto según la especie del lote.

## 3.4 Señalada — evento nuevo

```
model EvtSenalada {
  id        String   @id @default(uuid()) @db.Uuid
  fecha     DateTime @db.Date
  loteId    String   @db.Uuid
  lote      Lote     @relation(fields: [loteId], references: [id])

  corderosSenalados  Int      // total señalados
  corderosMuertos    Int      @default(0)  // mortandad pre-señalada
  machosMantenidos   Int      @default(0)  // no castrados
  machosCastrados    Int      @default(0)
  hembras            Int      @default(0)

  productoClostridialId String? @db.Uuid
  productoClostridial   Producto? @relation(fields: [productoClostridialId], references: [id])

  observ    String?
  createdAt DateTime @default(now())

  @@index([loteId])
  @@index([fecha])
  @@map("evt_senalada")
}
```

La señalada se hace **sobre el lote** (no animal por animal porque rara vez tienen caravana RFID a los 30-60 días). El número de corderos señalados es la base para calcular el **% señalada** vs hembras encarneradas.

## 3.5 KPIs reproductivos

Calcular como vistas materializadas o queries en runtime:

### Bovino
- **% preñez** = vacas preñadas / vacas servidas (post-tacto)
- **% parición** = vacas paridas / vacas servidas
- **% destete** = terneros destetados / vacas servidas
- **Pérdida tacto-parto** = preñadas - paridas
- **Pérdida parto-destete** = paridos - destetados (mortandad cría)
- **Intervalo parto-parto** (vacas multíparas)
- **% mellizos**

### Ovino
- **% señalada** = corderos señalados / ovejas encarneradas (el KPI patagónico por excelencia)
- **% parición** = ovejas paridas / ovejas encarneradas
- **% destete** = corderos destetados / ovejas encarneradas
- **Mortandad pre-señalada** = paridos - señalados
- **% mellizos / trillizos**

Benchmark Patagonia: % señalada bueno = 75-85%, regular = 60-75%, malo = <60%.

## 3.6 Servicio — captura de datos

`EvtServicio` ya tiene `tipo = 'natural' | 'ia' | 'iatf'`. Para ovino se usa solo `'natural'` (encarnerada con carneros). Para bovino el campo es estándar.

**Información a registrar por servicio:**
- `hembraId` — vaca/oveja servida
- `machoId` — toro/carnero (si conocido)
- `fecha` — fecha del servicio (o inicio del período si es encarnerada masiva)
- `tipo`
- `inseminador` — si IA
- `loteSemen` — si IA, número de lote
- `toroNombre` — si IA con semen externo

En ovino, la encarnerada típicamente no se registra animal por animal — se hace por lote (toda la majada con todos los carneros). En ese caso, la `Torada` registra el período y los `EvtServicio` individuales son opcionales (solo se cargan si hay un servicio dirigido o IA).

## 3.7 Tacto — captura

`EvtTacto` actual tiene: `resultado`, `mesesGest`, `fechaProbableParto`, `metodo`, `veterinario`. Suficiente para bovino y ovino.

**Validación:** si `resultado='preñada'` y `metodo='ecografia'`, exigir `mesesGest`. Si es `palpacion`, mesesGest puede ser estimado.

**Trigger:** al cargar tacto positivo, calcular `fechaProbableParto = fecha + (283 - mesesGest*30)` días para bovino, o `+(150 - mesesGest*30)` para ovino. Generar `Tarea` de "parto previsto" para esa fecha.

## 3.8 Parición — captura

`EvtParicion` actual: `resultado='vivo' | 'muerto'`, `pesoNacerKg`, `tipoParto`, `dificultad`, `sexoCria`, `nacidoAnimalId`.

**Si `resultado='vivo'`:**
1. Crear nuevo `Animal` con `especie`, `sexo=sexoCria`, `fechaNacimiento=fecha`, `origen='cria_propia'`, `madreId` vinculada via `Genealogia`.
2. Asignar a la `Categoria` de cría inicial (`ternero/a` o `cordero/a`).
3. Vincular al sector de la madre como ubicación inicial.

**Si `resultado='muerto'`:** solo se registra el evento, no se crea Animal.

## 3.9 Destete

`EvtDestete` actual: `fecha`, `pesoKg`, `edadDias`, `metodo`, `loteDesteteId`. Suficiente.

Al destetar:
1. Mover el animal a un lote de recría (`loteDesteteId`).
2. Calcular GDP nacer→destete y persistir en `EvtPesada` ligada.
3. Cambiar `Animal.categoria` si corresponde por edad.

## 3.10 Generador de tareas reproductivas

Por establecimiento/lote:
- Tacto previsto = fecha servicio + (60-90 días bovino, 45-60 ovino) → `Tarea(tipo='reproduccion')`.
- Parto previsto = fecha servicio confirmado + período gestación → `Tarea`.
- Señalada prevista (ovino) = fecha parición + 30-45 días → `Tarea`.
- Destete previsto = fecha parición + (180 bovino, 90 ovino) → `Tarea`.

## 3.11 Reportes

- **Hoja de servicio** por torada/encarnerada: hembras, carneros/toros, resultados de tacto, % preñez parcial.
- **Pronóstico de parición**: vacas/ovejas preñadas con fecha probable parto agrupadas por mes.
- **Resumen de zafra reproductiva**: comparativo año a año de los KPIs por establecimiento y por lote.

## Pendientes con cliente

- Confirmar terminología local (señalada, marcación, esquila, encarnerada).
- ¿Hace IA o solo servicio natural? Si hace IA, ¿con quién (técnico, cooperativa, ABS)?
- ¿Usa toros/carneros propios o alquila? Si alquila, modelar carnero externo en `EvtServicio.toroNombre`.
- ¿Hace ecografía o palpación? Define el detalle requerido en tacto.
- Confirmar fechas típicas de encarnerada y parición (afecta calendario por defecto).
