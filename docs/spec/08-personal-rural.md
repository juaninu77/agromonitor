# 08 — Personal rural

Gestión del personal afectado a las tareas del campo. Marco regulatorio: **Ley 26.727** (Régimen de Trabajo Agrario) y **RENATRE** (Registro Nacional de Trabajadores Rurales y Empleadores). Convenios homologados por UATRE–CNTA.

## 8.1 Marco regulatorio resumido

| Norma | Implicancia |
|---|---|
| **Ley 26.727** | Régimen único del trabajo agrario. Reemplaza al RNTRA. |
| **RENATRE** | Organismo de control. Toda relación laboral rural se registra acá. |
| **Libreta de Trabajo Rural** | Documento personal e intransferible del trabajador. Hoy digital con código único (C.U.) y QR. |
| **Convenios homologados por CNTA** | Salarios mínimos por categoría (peón, capataz, esquilador, ordeñador, etc.). Actualización trimestral. |
| **Aporte UATRE** | 2% del salario. Empleador retiene. |
| **Aporte Solidario / Obra Social** | OSPRERA. |

## 8.2 Entidades nuevas

```
model Trabajador {
  id                String   @id @default(uuid()) @db.Uuid
  nombre            String
  apellido          String
  dni               String   @unique
  cuil              String   @unique
  codigoUnicoRenatre String? @unique @map("c_u_renatre")
  fechaNacimiento   DateTime? @db.Date
  domicilio         String?
  localidad         String?
  provincia         String?
  telefono          String?
  email             String?

  // Datos bancarios
  cbu               String?
  banco             String?

  // Datos médicos / obra social
  obraSocial        String?  // 'OSPRERA' u otra
  numeroAfiliado    String?

  // Categoría laboral
  categoriaActual   String?  // 'peon_general' | 'capataz' | 'esquilador' | 'medianero' | ...
  fechaIngresoActiva DateTime? @db.Date

  activo            Boolean  @default(true)
  notas             String?

  organizacionId    String   @db.Uuid
  organizacion      Organizacion @relation(fields: [organizacionId], references: [id])

  contratos         Contrato[]
  jornales          Jornal[]
  liquidacionesSueldo LiquidacionSueldo[]

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([organizacionId])
  @@index([cuil])
  @@map("trabajadores")
}

model Contrato {
  id                String   @id @default(uuid()) @db.Uuid
  tipo              String   // 'permanente' | 'temporario' | 'estacional' | 'cuadrilla'
  fechaInicio       DateTime @db.Date
  fechaFin          DateTime? @db.Date  // null si permanente
  categoriaCNTA    String   // categoría del convenio
  remuneracionMensual Float?
  jornalDiario      Float?
  modalidad         String?  // 'mensual' | 'jornal' | 'tanto_alzado'
  observ            String?

  trabajadorId      String   @db.Uuid
  trabajador        Trabajador @relation(fields: [trabajadorId], references: [id], onDelete: Cascade)

  establecimientoId String   @db.Uuid
  establecimiento   Establecimiento @relation(fields: [establecimientoId], references: [id])

  activo            Boolean  @default(true)
  createdAt         DateTime @default(now())

  @@index([trabajadorId])
  @@index([establecimientoId])
  @@map("contratos")
}

model Jornal {
  id                String   @id @default(uuid()) @db.Uuid
  fecha             DateTime @db.Date
  horas             Float    @default(8)
  esFeriado         Boolean  @default(false)
  esExtra           Boolean  @default(false)
  importe           Float
  concepto          String?  // 'jornal_normal' | 'feriado' | 'horas_extra' | 'esquila_por_oveja'

  trabajadorId      String   @db.Uuid
  trabajador        Trabajador @relation(fields: [trabajadorId], references: [id])

  contratoId        String?  @db.Uuid
  contrato          Contrato? @relation(fields: [contratoId], references: [id])

  tareaId           String?  @db.Uuid
  tarea             Tarea?   @relation(fields: [tareaId], references: [id])

  pagado            Boolean  @default(false)
  fechaPago         DateTime? @db.Date

  observ            String?
  createdAt         DateTime @default(now())

  @@index([trabajadorId])
  @@index([fecha])
  @@map("jornales")
}

model LiquidacionSueldo {
  id                String   @id @default(uuid()) @db.Uuid
  periodo           String   // '2026-05'
  fechaEmision      DateTime @db.Date

  trabajadorId      String   @db.Uuid
  trabajador        Trabajador @relation(fields: [trabajadorId], references: [id])

  // Bruto
  sueldoBasico      Float
  jornalesBruto     Float    @default(0)
  horasExtra        Float    @default(0)
  feriados          Float    @default(0)
  sac               Float    @default(0) // aguinaldo proporcional / pago
  vacaciones        Float    @default(0)
  premios           Float    @default(0)
  total Bruto       Float

  // Deducciones
  jubilacion        Float    @default(0)  // 11%
  obraSocial        Float    @default(0)  // 3%
  ley19032          Float    @default(0)  // 3% PAMI
  aporteUatre       Float    @default(0)  // 2%
  ospreraExtra      Float    @default(0)
  otrosDescuentos   Float    @default(0)
  totalDescuentos   Float

  neto              Float

  // Contribuciones patronales (informativo)
  contribJubilacion Float    @default(0)
  contribObraSocial Float    @default(0)
  contribUatre      Float    @default(0)
  contribRenatre    Float    @default(0)

  estado            String   @default("borrador") // 'borrador' | 'emitido' | 'pagado'
  fechaPago         DateTime? @db.Date

  documentoUrl      String?  // PDF recibo

  observ            String?
  createdAt         DateTime @default(now())

  @@unique([trabajadorId, periodo])
  @@index([periodo])
  @@map("liquidaciones_sueldo")
}
```

## 8.3 Categorías típicas del convenio CNTA

| Categoría | Tareas |
|---|---|
| **Peón general** | Tareas generales del establecimiento. |
| **Peón ganadero** | Manejo de hacienda. |
| **Puestero** | Cuidador de puesto, vive en el campo. |
| **Capataz** | Jefe operativo, supervisa peones. |
| **Encargado** | Responsable del campo, reporta al productor. |
| **Esquilador** | Por temporada/zafra. Cobra por oveja esquilada (tanto alzado). |
| **Mensual** | Equipo de esquila (5-10 personas). |
| **Domador** | Tareas de doma. |
| **Casera/o** | Servicios del casco. |

Cada categoría tiene un piso salarial actualizado trimestralmente por CNTA. **El sistema mantiene una tabla de referencias salariales** sincronizada por la org (no auto-actualizable, salvo integración futura).

```
model EscalaSalarialCNTA {
  id                String   @id @default(uuid()) @db.Uuid
  categoria         String
  region            String?  // 'patagonia' | 'pampa' | etc. (algunos convenios tienen diferencial)
  vigenciaDesde     DateTime @db.Date
  vigenciaHasta     DateTime? @db.Date
  remuneracionMensual Float?
  jornalDiario      Float?
  observ            String?

  @@unique([categoria, vigenciaDesde])
  @@map("escala_salarial_cnta")
}
```

## 8.4 Esquila — pago a destajo

La esquila se paga por oveja esquilada (no por jornal). El equipo de comparsa típico:
- Esquiladores (3-8 personas).
- Mensual (clasificador, embolsador, prensador).
- Cocinero.

**Tarifa por oveja:** se acuerda por contrato. El sistema permite:

```
model TarifaEsquila {
  id                String   @id @default(uuid()) @db.Uuid
  zafra             Int
  rol               String   // 'esquilador' | 'mensual' | 'clasificador' | 'cocinero'
  importe           Float
  unidad            String   // 'por_oveja' | 'por_dia' | 'mensual'
  observ            String?

  establecimientoId String   @db.Uuid
  establecimiento   Establecimiento @relation(fields: [establecimientoId], references: [id])

  @@map("tarifas_esquila")
}
```

Y el cálculo de remuneración al cerrar la esquila genera `Jornal` por trabajador con `concepto='esquila_por_oveja'`.

## 8.5 Integración con tareas y eventos

- Una `Tarea` puede tener `trabajadorAsignadoId` (a agregar como FK opcional).
- Al ejecutar la tarea, el sistema sugiere generar `Jornal` con el importe acorde.
- Los `EvtSanidad`, `EvtMovimiento`, etc., pueden registrar `aplicador` o `responsable` — vincular a `Trabajador.id` si es trabajador registrado, o `aplicadorTexto` libre.

## 8.6 Libreta digital RENATRE

El trabajador tiene un C.U. (Código Único) y QR. El sistema:
- Almacena el C.U. en `Trabajador.codigoUnicoRenatre`.
- Permite cargar PDF de la libreta para tenerla a mano (cumple con exigencia de tenerla en el establecimiento).
- Genera comprobantes con el C.U. impreso.

## 8.7 ART (Aseguradora de Riesgos del Trabajo)

Toda relación laboral debe tener ART. El sistema:
- Por organización guarda `Organizacion.artNombre`, `artNumeroContrato`, `artVigenciaDesde/Hasta`.
- Por trabajador, fecha de alta declarada en ART.
- Genera certificado de cobertura imprimible para mostrar en controles.

## 8.8 Reportes

- **Padrón de trabajadores activos** del establecimiento.
- **Costo laboral mensual** por establecimiento y categoría.
- **Esquila zafra X** — total pagado a la comparsa.
- **Aportes/contribuciones del período** para conciliación con AFIP/ARCA.

## 8.9 Vacaciones y licencias

`LicenciaTrabajador { id, trabajadorId, tipo, desde, hasta, motivo, gozadaEntera }` — entidad simple para gestionar ausencias y proyectar la liquidación.

## Pendientes con cliente

- ¿Cantidad de trabajadores estables por campo?
- ¿Esquila propia o contratada (comparsa externa)?
- ¿ART contratada?
- ¿Sistema de liquidación actual (planilla, contador, software)?
- ¿Trabaja con puestero/caseros (vivienda incluida)?
