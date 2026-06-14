# 01 — Identificación y trazabilidad

Núcleo regulatorio del sistema. Si esto no es correcto y verificable, el productor no puede mover, vender ni faenar legalmente. Aplica a todos los establecimientos.

## 1.1 CUIG — Código Único de Identificación Ganadera

**Qué es.** Identifica al productor pecuario en un establecimiento ante SENASA. Lo emite SENASA en oficina local una vez por establecimiento. Se imprime en toda caravana (visual y RFID).

**Formato.** Dos letras mayúsculas + tres dígitos. Regex: `^[A-Z]{2}\d{3}$`. Ejemplo: `AB123`.

**Reglas.**
- Un establecimiento puede tener **un solo CUIG vigente**.
- El CUIG va siempre acompañado del RENSPA del mismo titular.
- Cambio de titular ⇒ nuevo CUIG (no se transfiere).

**Dónde vive en el sistema.** Columna `Establecimiento.cuig` (a agregar — hoy no existe).

**Validación.** En el alta y actualización de `Establecimiento`. Si el formato no matchea, rechazar.

## 1.2 RENSPA — Registro Nacional Sanitario de Productores Agropecuarios

**Qué es.** Registro obligatorio (Res. SENASA 423/2014 y modificatorias) de toda explotación con producción comercializable. Cubre agricultura, ganadería y silvicultura.

**Formato.** 17 caracteres: `00.000.0.00000/00` (provincia.departamento.localidad.titular/renspa). Regex: `^\d{2}\.\d{3}\.\d\.\d{5}\/\d{2}$`.

**Reglas.**
- Un mismo predio puede tener varios RENSPA si hay co-productores.
- El RENSPA se renueva tácitamente mientras se comercialice.
- La parte `/00` se incrementa si el productor tiene varios predios o subdivisiones.

**Dónde vive.** `Establecimiento.renspa` ya existe (string opcional). Validar formato. Puede haber varios `Establecimiento` con distinto RENSPA bajo la misma `Organizacion`.

## 1.3 Marca y señal provincial

**Qué es.** Identificación visual de propiedad. Marca (a fuego) para bovinos, señal (corte de oreja) para ovinos. Registrada en juzgado/órgano provincial.

**Reglas.**
- Boleto provincial vigencia **10 años**, renovable.
- Sin marca/señal vigente, **no se puede emitir DT-e**.
- En **Chubut**: Juzgado de Paz local. En **Río Negro**: Departamento Provincial de Ganadería (Ministerio de Producción).
- Una organización puede tener marca y señal **distintas por provincia** (un campo en Chubut con marca chubutense + uno en RN con marca rionegrina).

**Dónde vive.** Agregar a `Establecimiento`:
- `marcaNumero` (string)
- `marcaFechaInscripcion` (date)
- `marcaFechaVencimiento` (date)
- `marcaOrganoEmisor` (string)
- `senalDescripcion` (string, p.ej. "media luna oreja derecha")
- `senalFechaInscripcion` (date)
- `senalFechaVencimiento` (date)

**Alerta.** Notificación 60 días antes del vencimiento (usa `Notificacion` tipo `vencimiento_marca`).

## 1.4 Caravana RFID — Identificación individual obligatoria 2026

**Marco.** Res. SENASA **841/2025** (B.O. 03/11/2025): identificación electrónica RFID obligatoria desde **01/01/2026** para todo ternero/a post-destete, bovino, bubalino y cérvido.

**Binomio obligatorio.**
- **Botón RFID** en oreja derecha (HDX o FDX-B, 134.2 kHz, ISO 11784/11785).
- **Tarjeta visual** en oreja izquierda con número humano-legible y CUIG.

**Lifecycle.** Una caravana atraviesa estos estados:
```
asignada → colocada → (perdida | reemplazada | retirada por baja del animal)
```

**Reglas.**
- Un animal **puede** tener historial de varias caravanas (pérdida + reemplazo).
- El número RFID es **único nacional** y no se reutiliza.
- En caso de pérdida, la caravana de reemplazo mantiene el vínculo al mismo animal con un nuevo `numeroRfid` y `numeroVisual`.

**Dónde vive.** El schema actual tiene `Animal.cuig`, `Animal.caravanaVisual`, `Animal.caravanaRfid` como columnas únicas. Esto resuelve el **estado actual** pero no el **historial**. Para soportar lifecycle:

```
model Caravana {
  id              String   @id @default(uuid()) @db.Uuid
  numeroRfid      String   @unique
  numeroVisual    String
  tipo            String   // 'botonRfid' | 'tarjetaVisual' | 'duo' | 'oficial' | 'manejo'
  estado          String   // 'asignada' | 'colocada' | 'perdida' | 'reemplazada' | 'retirada'
  fechaAsignacion DateTime?
  fechaColocacion DateTime?
  fechaBaja       DateTime?
  motivoBaja      String?

  animalId String? @db.Uuid
  animal   Animal? @relation(fields: [animalId], references: [id])

  // Si reemplaza a otra
  reemplazaCaravanaId String?   @unique @db.Uuid
  reemplazaCaravana   Caravana? @relation("CaravanaReemplazo", fields: [reemplazaCaravanaId], references: [id])
  reemplazadaPor      Caravana? @relation("CaravanaReemplazo")

  @@index([animalId])
  @@index([estado])
  @@map("caravanas")
}
```

`Animal.caravanaRfid` y `Animal.caravanaVisual` quedan como **caché del activo** (consultable rápido) y se actualizan al cambiar la caravana activa.

## 1.5 DT-e — Documento de Tránsito Electrónico

**Qué es.** Documento que autoriza el movimiento de hacienda entre RENSPAs o a faena/feria/exportación. Reemplaza el DTA papel.

**Estados.**
```
borrador → emitido → en_tránsito → arribado → cerrado
                  ↘ anulado (antes del uso)
                  ↘ vencido (si no se usa antes de fechaVencimiento)
```

**Campos obligatorios** (en `DocumentoTransito` — extender el modelo actual):

Ya existen: `numeroDta`, `tipo`, `fechaEmision`, `fechaVencimiento`, `fechaUso`, `renspaOrigen`, `nombreOrigen`, `renspaDestino`, `nombreDestino`, `especie`, `cantidadAnimales`, `categorias`, `motivo`, `estado`, `patenteCamion`, `transportista`.

A **agregar**:
- `cuigOrigen` (string, validar formato)
- `cuigDestino` (string)
- `establecimientoId` (FK a `Establecimiento`, para anclar el doc al campo)
- `kmEstimados` (int, opcional)
- `valorDeclarado` (decimal, opcional)
- `motivoDetalle` (string libre)
- `senasaOficinaEmisora` (string)

Y una **tabla de detalle** para ligar caravanas embarcadas al DT-e:

```
model DocumentoTransitoItem {
  id           String @id @default(uuid()) @db.Uuid
  documentoId  String @db.Uuid
  documento    DocumentoTransito @relation(fields: [documentoId], references: [id], onDelete: Cascade)

  caravanaRfid String?   // si individual
  animalId     String?   @db.Uuid
  animal       Animal?   @relation(fields: [animalId], references: [id])

  categoria    String?   // si se cargó por categoría/cantidad
  cantidad     Int       @default(1)

  @@index([documentoId])
  @@index([caravanaRfid])
  @@map("documentos_transito_items")
}
```

**Reglas de validación previas a emisión.**
1. CUIG origen + RENSPA origen pertenecen al mismo establecimiento dentro de la `Organizacion`.
2. Marca/señal vigente en el establecimiento origen.
3. Si destino está en zona con vacunación de aftosa y origen está en ZLSV, validar certificación especial (ver `02-sanidad.md`).
4. Si la categoría declarada es reproductor bovino, exigir tuberculinización negativa < 60 días.
5. Caravanas embarcadas existen, están `colocada` en el sistema, y pertenecen al establecimiento origen.
6. Cantidad declarada = caravanas individuales + suma de cantidades por categoría.
7. Stock disponible en sectores del establecimiento ≥ cantidad declarada.

**Trigger al `arribado`.** Crea automáticamente `EvtMovimiento` para los animales identificados individualmente, y actualiza la ubicación a un sector del destino (o a un sector virtual "tránsito recibido").

**Trigger al `cerrado` con motivo `venta`.** Crea `EvtBaja` con `motivo='venta'`, vinculando `dtaNumero` al evento (campo ya existe).

## 1.6 SIGSA / SIGBIOTraza

**SIGSA** — Sistema web SENASA del productor: declaración de stock, emisión DT-e en autogestión, recepción, novedades (nacimientos, muertes, cambios). Hoy el 76% de DT-e se emite por autogestión.

**SIGBIOTraza** — App mobile SENASA para colocar caravanas y vincular RFID al productor. Genera evento de "primera identificación".

**Estrategia de integración (ver `09-integraciones.md`).**

- **Fase 1 — Manual asistido.** El sistema imprime un PDF con todos los datos en el orden que pide SIGSA. El encargado los carga en el portal SENASA. Al recibir el N° de DT-e, lo registra en Agromonitor (campo `numeroDta`).
- **Fase 2 — Importación de stock.** Importar el padrón de animales del establecimiento desde SIGSA vía CSV (export oficial). Permite arrancar con un campo ya inventariado.
- **Fase 3 — API.** Si SENASA habilita credenciales WS para el productor, integración bidireccional (consulta de RENSPA, emisión DT-e, declaración de novedades).

## 1.7 Reglas transversales

1. **Un animal sin CUIG ni caravana RFID puede existir en el sistema** únicamente con estado `recienNacido` o `enColocacion`. Una vez asignada caravana, no se puede emitir DT-e sin caravana RFID.
2. **No se puede dar de baja un Animal si tiene una caravana en estado `colocada`** — primero hay que retirar la caravana (estado `retirada`) o pasar a `perdida`.
3. **Al cambiar de establecimiento via DT-e**, el RENSPA y CUIG del animal se actualizan al del destino.
4. **El historial de RENSPAs por los que pasó un animal** se reconstruye desde la cadena de `DocumentoTransito` cerrados.

## 1.8 KPIs del módulo

- % de animales con caravana RFID colocada / total.
- Cantidad de DT-e emitidos por mes (gráfico vs año anterior).
- Tiempo promedio entre emisión y arribo (detecta tropas problemáticas).
- DT-e vencidos sin usar (pérdida de tiempo administrativo).
- Caravanas perdidas / total (indicador de calidad de manga).

## Pendientes con cliente

- Confirmar si los dos campos usan caravana RFID HDX o FDX-B (afecta lectora compatible).
- Validar formato exacto de boleto de marca en Chubut vs Río Negro (puede requerir campo extra).
- Confirmar si trabajan con consignatario fijo o usan SIGSA autogestión.
- ¿Tienen oficina SENASA preferida? (para auto-completar `senasaOficinaEmisora`).
