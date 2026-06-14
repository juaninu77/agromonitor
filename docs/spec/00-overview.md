# 00 — Overview

## Propósito

Agromonitor es un ERP para **emprendimientos agropecuarios argentinos**, con foco inicial en **producción ganadera mixta (bovino + ovino) en Patagonia**. Cubre el ciclo productivo completo desde el alta del animal hasta la liquidación de venta, manteniendo la trazabilidad regulatoria que exige SENASA y la documentación comercial que exige ARCA/AFIP.

A diferencia de un ERP genérico adaptado, Agromonitor toma como invariantes:

- **CUIG y RENSPA** como identificadores primarios del productor.
- **Caravana RFID** como identificador primario del animal (Res. SENASA 841/2025, vigente desde 2026).
- **Eventos inmutables** como fuente de verdad de cualquier estado derivado (peso actual, ubicación, condición sanitaria, preñez).

## Audiencia

| Rol | Qué hace en el sistema |
|---|---|
| **Productor / dueño** | Configura organización y establecimientos, ve KPIs, autoriza ventas, revisa liquidaciones. |
| **Encargado / capataz** | Planifica trabajos, asigna tareas, supervisa eventos de campo, emite DT-e. |
| **Veterinario** | Define protocolos sanitarios, registra diagnósticos, prescribe tratamientos, firma certificados. |
| **Operario / peón** | Carga eventos desde la manga (PWA offline-first): pesadas, vacunaciones, tactos, movimientos. |
| **Contador externo** (opcional) | Consulta comprobantes y exporta para contable; no edita operación de campo. |

## Alcance funcional

Doce módulos, agrupados en cinco áreas:

1. **Trazabilidad SENASA** — Identificación, Movimientos (DT-e), Sanidad, Reproducción.
2. **Producción** — Stock, Forraje, Lana (PROLANA).
3. **Comercial** — Liquidaciones, Facturación, AFIP/ARCA.
4. **Personal** — RENATRE, jornales.
5. **Plataforma** — Multi-tenant, roles/permisos, auditoría, notificaciones, PWA offline.

Fuera de alcance inicial: contabilidad completa (libro diario/mayor) — se exporta a contable externo. Cultivos extensivos y agroquímicos (módulo existe en repo pero no se especifica aquí). IoT y mapas (puntos de extensión).

## Principios de diseño

1. **Parametrizable por establecimiento.** Especie dominante, zona aftosa, programa PROLANA, plan sanitario, marca/señal — todo se configura por `Establecimiento`, nunca hardcoded.
2. **Event sourcing puro.** El estado actual (peso, ubicación, lote, preñez, estado vital) se deriva de los eventos. No se mutan estados pasados.
3. **Multi-tenant estricto.** Toda query filtra por `organizacionId`. Sin excepciones.
4. **Offline-first en la manga.** La captura de eventos (PWA) debe operar sin red y sincronizar al recuperar conexión. El campo argentino no tiene buena cobertura.
5. **Validación al borde, no al guardar.** CUIG, RENSPA, dosis sanitaria, fechas de campaña aftosa, formato de caravana — todo validado antes de persistir.
6. **Idempotencia en eventos.** La carga de un EID en sesión de manga debe ser segura ante reintentos (offline → online).
7. **Auditoría completa.** Todo cambio queda en `AuditLog`. Especialmente movimientos sanitarios y bajas.

## Glosario AR

| Término | Significado |
|---|---|
| **CUIG** | Código Único de Identificación Ganadera — formato `AA000`, identifica al productor. |
| **RENSPA** | Registro Nacional Sanitario de Productores Agropecuarios — formato `00.000.0.00000/00`. |
| **Caravana** | Identificación individual del animal. Visual (tarjeta) + RFID (botón electrónico) post Res. 841/2025. |
| **DT-e** | Documento de Tránsito Electrónico — autoriza movimiento de hacienda. |
| **SIGSA** | Sistema Integrado de Gestión de Sanidad Animal (SENASA). |
| **SIGBIOTraza** | App SENASA para identificación electrónica y trazabilidad. |
| **ZLSV** | Zona Libre de Aftosa Sin Vacunación (Patagonia al sur del paralelo 42º). |
| **Marca / señal** | Identificación visual de propiedad (marca = bovinos a fuego, señal = ovinos con corte de oreja). Boleto provincial vigencia 10 años. |
| **Categoría** | Bovino: ternero/a, novillito, novillo, vaquillona, vaca, toro. Ovino: cordero, borrego/a, capón, oveja, carnero. |
| **GDP** | Ganancia Diaria de Peso (kg/día). |
| **CC** | Condición Corporal (escala 1-9 bovinos, 1-5 ovinos). |
| **EV** | Equivalente Vaca (1 EV = vaca 400 kg que pare y desteta). |
| **Señalada** | Marcación de corderos al pie de la madre (ovinos). |
| **Refugo / descarte** | Salida del rodeo reproductivo por edad/performance. |
| **Tacto** | Diagnóstico de preñez (palpación o ecografía). |
| **Servicio / encarnerada** | Período de monta. "Servicio" en bovino, "encarnerada" en ovino. |
| **Tropa** | Conjunto de animales viajando bajo un mismo DT-e. |
| **PROLANA** | Programa Nacional de Calidad de Lana — acondicionamiento técnico de la lana. |
| **Tally-Hi** | Sistema de esquila preparada con clasificación a piso. |
| **Kilo limpio** | Kilo de lana neta después de descontar materia vegetal y rinde al peinado. |
| **Micronaje** | Finura de la fibra de lana en micrones (μm). |
| **ARCA** | Agencia de Recaudación y Control Aduanero (ex AFIP, vigente desde 2024-2025). |
| **RENATRE** | Registro Nacional de Trabajadores Rurales y Empleadores. |
| **ROSGAN** | Mercado Ganadero de Rosario — referencia de precios. |

## Decisiones de arquitectura ya tomadas en v2

Se documentan acá para no revisitar:

- **PostgreSQL en Neon** (con `DATABASE_URL` poolizada y `DIRECT_URL` para migraciones).
- **Prisma 6** como ORM, con `@map` para mantener snake_case en columnas físicas.
- **NextAuth 5 (beta)** con JWT, auto-reparación del token si el `id` no es UUID válido (ver `auth.config.ts`).
- **Roles globales** en `Usuario.rol` + **rol por organización** en `Membresia.rol`. El rol efectivo es el de la membresía activa.
- **EAV en `AnimalAttr`** para atributos extensibles sin migrar schema (DEPs, biotipo, línea sanguínea, etc.).
- **`SesionManga` + `SesionMangaItem`** como puerta de entrada de datos masivos desde lectora RFID.

## Pendientes con cliente

- Validar glosario con encargados de los dos campos (Chubut + RN). Pueden haber regionalismos.
- Confirmar si "señalada" es práctica vigente o se usa otra terminología local.
