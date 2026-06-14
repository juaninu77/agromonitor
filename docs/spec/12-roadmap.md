# 12 — Roadmap

Plan de implementación por fases. Pensado para tener un MVP utilizable por los dos clientes (Chubut + Río Negro) en 6-8 semanas y un sistema robusto en 5-6 meses.

## Fase 0 — Setup (1 semana)

**Objetivo:** dejar el sistema listo para implementar las features regulatorias sin romper lo existente.

- Conectar a Neon via Postgres MCP + `DATABASE_URL` (cuando el usuario lo habilite).
- Verificar que el schema en Neon coincide con `prisma/schema.prisma`. Si hay drift, decidir si traer Neon a v3 o partir de cero con migración planificada.
- Definir convenciones de migración Prisma (vs `db push`).
- Configurar entorno de staging separado en Neon (otra branch).
- Cargar seeds base: especies (bovino, ovino), categorías estándar, razas patagónicas, forrajes patagónicos.

**Entregable:** repo + DB en staging coherentes, seeds básicos cargados, ambiente de QA listo.

## Fase 1 — MVP regulatorio Chubut/RN (4-6 semanas)

**Objetivo:** que los dos clientes puedan operar legalmente desde Agromonitor.

### Sprint 1 — Identificación y configuración (semana 1-2)

- [ ] Extender `Establecimiento` con CUIG, marca/señal, zona aftosa, programa PROLANA.
- [ ] Validar formato CUIG y RENSPA en alta/edición.
- [ ] Crear modelo `Caravana` con lifecycle, migrar datos existentes desde `Animal.caravanaVisual` y `Animal.caravanaRfid`.
- [ ] Onboarding wizard nuevo: alta de Organización → primer Establecimiento (con CUIG, RENSPA, marca, señal, zona aftosa) → primer Sector.

**Demo:** crear las dos organizaciones reales (un cliente en Chubut, otro en RN) con sus establecimientos y datos regulatorios.

### Sprint 2 — Sanidad protocolizada (semana 2-3)

- [ ] Crear `ProtocoloSanitario`, `ItemProtocolo`, `CalendarioSanitario`.
- [ ] Templates seed: bovino con vacuna, bovino ZLSV, ovino Patagonia base, ovino PROLANA, reproductor.
- [ ] Generador de tareas sanitarias desde el calendario.
- [ ] Vincular `EvtSanidad` a items de protocolo.
- [ ] Bloqueo de DT-e faena durante carencia.

**Demo:** asignar al campo de Chubut el protocolo ovino Patagonia + bovino ZLSV. Ver el calendario anual generado con tareas concretas.

### Sprint 3 — DT-e y movimientos (semana 3-4)

- [ ] Extender `DocumentoTransito` con CUIG, FK establecimiento, items.
- [ ] Workflow estados borrador→emitido→en_tránsito→arribado→cerrado.
- [ ] Validaciones previas a emisión (zona aftosa, carencia, marca/señal vigente).
- [ ] Generación de PDF DT-e para llevar al portal SIGSA.
- [ ] Marcado de arribo dispara `EvtMovimiento` y actualización de RENSPA en animales.
- [ ] Marcado de cerrado con motivo venta dispara `EvtBaja`.

**Demo:** generar un DT-e de venta de novillos del campo de Chubut al frigorífico Comodoro.

### Sprint 4 — Reproducción ovino + señalada (semana 4-5)

- [ ] Extender `Torada` con `tipoGrupo`.
- [ ] Crear `EvtSenalada`.
- [ ] Adaptar UI de reproducción para usar terminología ovina cuando lote es ovino.
- [ ] KPIs reproductivos por torada/encarnerada.

**Demo:** registrar encarnerada otoño 2026, tactos, parición, señalada del campo de RN.

### Sprint 5 — Cierre de stock (semana 5-6)

- [ ] Crear `CierreStock` y `CierreStockItem`.
- [ ] Cálculo automático de saldos por categoría desde eventos.
- [ ] Pantalla de cierre mensual con detección de ajustes.
- [ ] Cierre con estado inmutable y reapertura auditada.

**Demo:** cerrar el mes de junio para ambos campos. Ver el comparativo.

### Sprint 6 — Buffer + QA (semana 6)

- Pulir UX, ajustar permisos, smoke tests, capacitación a clientes.

## Fase 2 — Producción de lana (4 semanas)

**Objetivo:** soportar la zafra de esquila 2026-2027 de los dos clientes.

### Sprint 1 — Esquila y fardos (semana 1-2)

- [ ] Crear `Esquila`, `LoteEsquila`, `Fardo`.
- [ ] Pantalla galpón: carga rápida desde tablet.
- [ ] Numeración correlativa de fardos.
- [ ] PWA offline confirmada.

### Sprint 2 — Análisis y embarque (semana 2-3)

- [ ] Crear `AnalisisLana`.
- [ ] Subir resultado de laboratorio (PDF + datos).
- [ ] Crear `EmbarqueLana` con asignación de fardos.
- [ ] Generar romaneo imprimible.

### Sprint 3 — Liquidación (semana 3-4)

- [ ] Crear `LiquidacionLana`.
- [ ] Cálculo automático: kilos sucios × rinde × precio.
- [ ] Bonificación PROLANA.
- [ ] Vinculación a `Cobro` y cuenta corriente.

**Demo:** registrar zafra completa hasta la cobranza para el campo de Chubut.

## Fase 3 — Comercial y personal (6-8 semanas)

**Objetivo:** cerrar el ciclo financiero y administrar la nómina.

### Sprint 1-2 — Liquidación hacienda y cuenta corriente (3 semanas)

- [ ] Crear `LiquidacionHacienda`, `LiquidacionHaciendaItem`.
- [ ] Crear `Comprobante`, `ComprobanteItem`, `Cobro`.
- [ ] Crear `CuentaCorriente`, `MovimientoCuentaCte`.
- [ ] Generación de PDF de comprobantes (factura, remito, recibo).

### Sprint 3 — Integración ARCA mínima (1-2 semanas)

- [ ] Generación de PDF previo emisión.
- [ ] Si hay recursos: WSAA + WSFE para emitir factura B/C electrónica directo.

### Sprint 4-5 — Personal rural (3 semanas)

- [ ] Crear `Trabajador`, `Contrato`.
- [ ] Crear `Jornal`, `LiquidacionSueldo`.
- [ ] Crear `TarifaEsquila`, `EscalaSalarialCNTA`.
- [ ] Recibo de sueldo en PDF.
- [ ] Reporte de costos laborales.

### Sprint 6 — Exportación contable (1 semana)

- [ ] Exportar comprobantes en formato CSV para Xubio/Tango.
- [ ] Exportar cuenta corriente.

**Demo:** ciclo comercial completo de un mes para ambos campos.

## Fase 4 — Forraje, mapas, IoT (4 semanas)

**Objetivo:** completar la gestión agronómica y abrir la puerta a integraciones avanzadas.

- [ ] Crear `Reserva`, `ConsumoReserva`.
- [ ] Mejorar aforos y balance forrajero.
- [ ] Mapa con polígonos de potreros (Leaflet/MapLibre).
- [ ] Mock IoT (carga manual + visualización).

## Fase 5 — Integraciones reales (8-12 semanas)

**Objetivo:** automatizar las cargas manuales que sobreviven.

- [ ] WS SENASA (consulta RENSPA, emisión DT-e via WS si SENASA habilita).
- [ ] WSFEX para exportación de lana.
- [ ] Scraping ROSGAN para precios de referencia.
- [ ] Importación de extractos bancarios.

## 12.1 MVP de validación temprana

Antes de Fase 1 completa, una **demo de validación** con los dos clientes en semana 2:

1. Mostrar el wizard de alta de establecimiento con sus datos reales.
2. Mostrar el calendario sanitario diferencial (ZLSV vs zona vacuna).
3. Mostrar el flujo de DT-e con sus datos.
4. Recoger feedback de terminología, campos faltantes, prioridades.

Esto baja el riesgo de construir lo equivocado durante 6 semanas.

## 12.2 Criterios de salida MVP (definition of done Fase 1)

- [ ] Los dos clientes tienen sus organizaciones y establecimientos cargados con datos regulatorios completos.
- [ ] Cada establecimiento tiene su plan sanitario activo y genera tareas.
- [ ] Se puede generar al menos 1 DT-e por cliente, con todos los datos correctos para SIGSA.
- [ ] Cada cliente cargó al menos 1 evento de reproducción (servicio + tacto).
- [ ] Cada cliente cerró al menos 1 mes con stock validado.
- [ ] No hay errores de auth, multi-tenant, o cross-org leakage.
- [ ] El sistema funciona offline en tablet por al menos 4 horas y sincroniza al recuperar conexión.

## 12.3 Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| SENASA cambia formato de DT-e antes del MVP | Tracking continuo del boletín oficial. Demora en F3 (WSDL) ya planeada. |
| Cliente quiere cambios masivos durante MVP | Sprint 0 con validación temprana. Backlog estructurado. |
| Schema drift entre Neon prod y staging | Migraciones únicamente con `prisma migrate`, no `db push` en prod. CI con `prisma migrate status`. |
| Lectoras RFID incompatibles | Sprint dedicado a integración hardware en Fase 1. |
| Conectividad de campo deficiente | PWA offline-first desde día 1. Buffer local persistente. |
| Norma 841/2025 sufre prórrogas | El sistema soporta animales sin RFID — solo bloquea DT-e. Resoluciones se modelan como flags configurables. |

## 12.4 Estimación de esfuerzo

- Fase 0: 1 sem
- Fase 1: 6 sem (con buffer)
- Fase 2: 4 sem
- Fase 3: 8 sem
- Fase 4: 4 sem
- Fase 5: 12 sem (opcional)

**Total core (Fases 0-3): ~19 semanas / ~4.5 meses** para un sistema productivo completo.

**Total con Fase 4: 23 semanas / ~5.5 meses.**

## Pendientes con cliente

- Acordar fecha del MVP demo (sprint 2 de Fase 1).
- Confirmar disponibilidad de los dos clientes para tests de aceptación al final de cada fase.
- Decidir si la Fase 5 se prioriza por sobre Fase 4 (depende de qué genere más fricción operativa).
