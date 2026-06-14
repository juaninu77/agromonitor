# 11 — Modelo de datos: matriz canónica

Diff entre lo que existe hoy en `prisma/schema.prisma` (v3) y lo que pide esta spec. Cada entrada indica acción: **Mantener** | **Extender** | **Crear** | **Renombrar/Generalizar**.

## 11.1 Identidad y multi-tenant

| Entidad | Estado actual | Acción | Cambios |
|---|---|---|---|
| `Usuario` | OK | Mantener | — |
| `Account`, `Session`, `VerificationToken` | OK | Mantener | NextAuth estándar |
| `Organizacion` | OK | Extender | Agregar `politicaValuacion`, `padronGanadero`, `artNombre/numeroContrato/vigenciaDesde/Hasta`, `condicionIVA` |
| `Membresia` | OK | Mantener | — |

## 11.2 Catálogos base

| Entidad | Estado actual | Acción | Cambios |
|---|---|---|---|
| `Especie` | OK | Mantener | Seed con bovino, ovino (al menos). Equino/caprino opcionales. |
| `Raza` | OK | Mantener | Seed con merino_australiano, corriedale, romney, lincoln (ovino); angus, hereford, criollo, cruza (bovino). |
| `Categoria` | OK | Mantener | Seed con categorías bovinas y ovinas (ver `05-stock-movimientos.md`). |
| `Forraje` | OK | Extender seed | Agregar especies patagónicas (coirones, pasto llorón, etc.). |

## 11.3 Establecimientos y sectores

| Entidad | Estado actual | Acción | Cambios |
|---|---|---|---|
| `Establecimiento` | Tiene `renspa` | **Extender** | Agregar: `cuig`, `marcaNumero`, `marcaFechaInscripcion`, `marcaFechaVencimiento`, `marcaOrganoEmisor`, `senalDescripcion`, `senalFechaInscripcion`, `senalFechaVencimiento`, `zonaAftosa`, `programaPROLANA`, `senasaOficinaEmisora`, `latitud`, `longitud` |
| `Sector` | OK | Mantener | — |
| `SectorForraje` | OK | Mantener | — |
| `MedicionPotrero` | OK | Extender | Agregar `metodo`, `numeroMuestras`, `tipoPastura` |

## 11.4 Animales e identificación

| Entidad | Estado actual | Acción | Cambios |
|---|---|---|---|
| `Animal` | OK (`cuig`, `caravanaVisual`, `caravanaRfid` como columnas) | Extender | Agregar `establecimientoActualId` (FK, caché de ubicación), `loteActualId` (caché), `pesoUltimoKg` (caché) — opcional, optimización. Mantener `caravanaRfid`/`caravanaVisual` como caché del activo. |
| `Caravana` | Inexistente | **Crear** | Historial de caravanas por animal con lifecycle. Ver `01-identificacion-trazabilidad.md`. |
| `Genealogia` | OK | Mantener | — |
| `AnimalAttr` | OK (EAV) | Mantener | — |
| `AnimalLoteHist` | OK | Mantener | — |
| `UbicacionHist` | OK | Mantener | — |

## 11.5 Eventos de ciclo de vida

| Entidad | Estado actual | Acción | Cambios |
|---|---|---|---|
| `EvtParicion` | OK | Mantener | — |
| `EvtDestete` | OK | Mantener | — |
| `EvtPesada` | OK | Mantener | — |
| `EvtMovimiento` | OK | Mantener | — |
| `EvtSanidad` | OK | Extender | Agregar `itemProtocoloId` (FK opcional) y `calendarioId` (FK opcional). |
| `EvtBaja` | OK | Extender | Agregar `policiaCausa`, `liquidacionHaciendaId` (FK). |
| `EvtServicio` | OK | Mantener | — |
| `EvtTacto` | OK | Mantener | — |
| `EvtSenalada` | **Inexistente** | **Crear** | Evento ovino — ver `03-reproduccion.md`. |
| `EvtAlimentacion` | OK | Mantener | — |
| `EvtPastoreo` | OK | Mantener | — |
| `Torada` | OK | Extender | Agregar `tipoGrupo = 'torada' \| 'encarnerada'`. Renombrar opcional a `GrupoReproductivo` (con `@@map` original). |

## 11.6 Productos sanitarios e inventario

| Entidad | Estado actual | Acción | Cambios |
|---|---|---|---|
| `Producto` | OK | Mantener | — |
| `LoteProducto` | OK | Mantener | — |
| `MovimientoStock` | OK | Mantener | — |
| `ProtocoloSanitario` | Inexistente | **Crear** | Receta sanitaria reusable. |
| `ItemProtocolo` | Inexistente | **Crear** | — |
| `CalendarioSanitario` | Inexistente | **Crear** | Instancia anual. |

## 11.7 Producción y planes

| Entidad | Estado actual | Acción | Cambios |
|---|---|---|---|
| `Lote` | OK | Mantener | — |
| `Dieta`, `DietaComponente`, `PlanAlimentacion` | OK | Mantener | — |

## 11.8 Forraje y reservas

| Entidad | Estado actual | Acción | Cambios |
|---|---|---|---|
| `Reserva` | Inexistente | **Crear** | Rollos, fardos, silo. |
| `ConsumoReserva` | Inexistente | **Crear** | — |
| `AsignacionPotrero` | Inexistente | Crear (opcional MVP) | — |

## 11.9 Producción de lana (módulo nuevo completo)

| Entidad | Estado actual | Acción |
|---|---|---|
| `Esquila` | Inexistente | **Crear** |
| `LoteEsquila` | Inexistente | **Crear** |
| `Fardo` | Inexistente | **Crear** |
| `AnalisisLana` | Inexistente | **Crear** |
| `EmbarqueLana` | Inexistente | **Crear** |
| `LiquidacionLana` | Inexistente | **Crear** |

## 11.10 Trazabilidad SENASA

| Entidad | Estado actual | Acción | Cambios |
|---|---|---|---|
| `DocumentoTransito` | OK parcial | **Extender** | Agregar `cuigOrigen`, `cuigDestino`, `establecimientoId` (FK), `kmEstimados`, `valorDeclarado`, `motivoDetalle`, `senasaOficinaEmisora`. |
| `DocumentoTransitoItem` | Inexistente | **Crear** | Detalle de caravanas embarcadas. |

## 11.11 Comercial (módulo nuevo completo)

| Entidad | Estado actual | Acción |
|---|---|---|
| `LiquidacionHacienda` | Inexistente | **Crear** |
| `LiquidacionHaciendaItem` | Inexistente | **Crear** |
| `Comprobante` | Inexistente | **Crear** |
| `ComprobanteItem` | Inexistente | **Crear** |
| `Cobro` | Inexistente | **Crear** |
| `CuentaCorriente` | Inexistente | **Crear** |
| `MovimientoCuentaCte` | Inexistente | **Crear** |

## 11.12 Personal rural (módulo nuevo completo)

| Entidad | Estado actual | Acción |
|---|---|---|
| `Trabajador` | Inexistente | **Crear** |
| `Contrato` | Inexistente | **Crear** |
| `Jornal` | Inexistente | **Crear** |
| `LiquidacionSueldo` | Inexistente | **Crear** |
| `TarifaEsquila` | Inexistente | **Crear** |
| `EscalaSalarialCNTA` | Inexistente | **Crear** |
| `LicenciaTrabajador` | Inexistente | **Crear** |

## 11.13 Stock y cierre

| Entidad | Estado actual | Acción |
|---|---|---|
| `CierreStock` | Inexistente | **Crear** |
| `CierreStockItem` | Inexistente | **Crear** |
| `CierreStockResumen` | Inexistente | **Crear** |

## 11.14 Terceros

| Entidad | Estado actual | Acción | Cambios |
|---|---|---|---|
| `Proveedor` | OK | Extender | Agregar `condicionIVA`, `direccion`, `localidad`, `provincia`, `email`. |
| `Cliente` | OK | Extender | Agregar `condicionIVA`, `direccion`, `localidad`, `provincia`, `email`. Modelar también `'consignatario'` y `'frigorifico'` en el array tipo (ya soportado). |

## 11.15 Operativa

| Entidad | Estado actual | Acción | Cambios |
|---|---|---|---|
| `Tarea` | OK | Extender | Agregar `trabajadorAsignadoId` (FK a `Trabajador`), `tipoFuente = 'manual' \| 'calendario_sanitario' \| 'reproduccion'`, `itemProtocoloId` (FK), `loteId` (FK opcional), `sectorId` (FK opcional). |
| `Notificacion` | OK | Mantener | — |
| `SesionManga` | OK | Mantener | — |
| `SesionMangaItem` | OK | Extender | Agregar `caravanaId` (FK a nueva tabla Caravana). |
| `AuditLog` | OK | Mantener | — |

## 11.16 Resumen numérico

- Modelos existentes: **~35**.
- Modelos a extender: **8**.
- Modelos a crear: **~35** (módulos lana, comercial, personal, sanidad-protocolos, cierre, caravana, reservas, contratos, etc.).
- Total final estimado: **~70 modelos**.

## 11.17 Migraciones — estrategia

1. **No romper el schema actual.** Toda migración es **aditiva** (`ALTER TABLE ADD COLUMN`, `CREATE TABLE`).
2. Para `Establecimiento` se agregan columnas con `DEFAULT NULL`; el sistema solo exige los nuevos campos al alta nueva.
3. Para campos como `Caravana`, generar registros desde los datos existentes en `Animal.caravanaVisual` / `Animal.caravanaRfid` con `estado='colocada'`.
4. Cada migración Prisma se acompaña de un `seed_supplemental.ts` que pobla datos derivables.
5. Usar `prisma migrate` (no `db push`) para todas las migraciones productivas.

## 11.18 Conformidad con Postgres / Neon

- Todos los IDs son UUID v4 (`@db.Uuid`).
- Las fechas operativas son `@db.Date` (no `Timestamp`) salvo cuando importa el momento exacto.
- Los `Decimal/Float` van como `Float` (Prisma) — para precios y kilos. Cuidado con redondeo: en montos > $1M, considerar `Decimal` con precisión 12,2.
- Índices: ya están bien marcados en el schema actual. Agregar índices en los nuevos modelos por `organizacionId`, `establecimientoId`, `fecha`.
