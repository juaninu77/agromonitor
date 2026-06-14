# 05 — Stock y movimientos

Cómo se llevan las existencias de hacienda, qué movimientos las afectan, cómo se cierra un período y cómo se valorizan.

## 5.1 Categorías

### Bovinas (catálogo `Categoria` con `especie='bovino'`)

| Categoría | Sexo | Edad típica | Notas |
|---|---|---|---|
| Ternero | M | 0-8 meses | Pre-destete |
| Ternera | F | 0-8 meses | Pre-destete |
| Novillito | M | 8-18 meses | Post-destete, castrado o entero |
| Vaquillona | F | 8-24 meses | Hasta primer servicio |
| Novillo | M | 18+ meses | Engorde |
| Vaca | F | 24+ meses, parió | Reproductora |
| Vaca seca | F | 24+ meses, no preñada | Para refugo o invernada |
| Vaca CUT | F | descarte | Conserva (jurel) |
| Toro | M | 18+ meses, reproductor | Entero, servicio |
| Buey | M | adulto castrado | Trabajo (raro hoy) |

### Ovinas (catálogo `Categoria` con `especie='ovino'`)

| Categoría | Sexo | Edad típica | Notas |
|---|---|---|---|
| Cordero/a | ambos | 0-6 meses | Pre-destete o post-destete temprano |
| Borreguito/a | M/F | 6-12 meses | Post-destete |
| Borrega | F | 12-24 meses | Hasta primer servicio |
| Capón | M | 12+ meses castrado | Engorde / refugo |
| Oveja | F | 24+ meses, parió | Reproductora |
| Carnero | M | 12+ meses, entero | Reproductor |

El catálogo `Categoria` ya soporta `edadMinMeses`, `edadMaxMeses`, `sexo`. El seed debe poblar estas dos tablas (bovino + ovino) con los valores estándar argentinos.

### Recategorización automática

Por la edad y el sexo, el sistema **sugiere** la recategorización pero no la fuerza:
- Un ternero macho castrado al destete pasa a "novillito".
- Una vaquillona al primer parto pasa a "vaca".
- Una oveja seca dos años seguidos puede pasar a "refugo".

Implementación: job nocturno que evalúa `Animal.categoriaId` vs reglas y crea una `Tarea` de "revisar categoría sugerida" cuando hay desvío.

## 5.2 Movimientos

Todo movimiento se traduce en uno o varios eventos `Evt*`:

| Tipo movimiento | Evento(s) generados | Notas |
|---|---|---|
| **Nacimiento** | `EvtParicion` + nuevo `Animal` | Origen: `cria_propia` |
| **Compra** | `EvtMovimiento` (entrada) + alta `Animal` con `origen='compra'` | Asociar `proveedorId`, `dtaNumeroIngreso` |
| **Traslado interno** (entre sectores del mismo establecimiento) | `EvtMovimiento` | No emite DT-e |
| **Traslado entre establecimientos de la misma org** | `EvtMovimiento` + DT-e | Sí emite DT-e (cambio de RENSPA) |
| **Venta** | `EvtBaja` con `motivo='venta'` + DT-e | `Animal.estadoVital='vendido'` |
| **Muerte natural** | `EvtBaja` con `motivo='muerte'` | Sin DT-e, con causa |
| **Faena** | `EvtBaja` con `motivo='faena'` + DT-e con destino frigorífico | Validar período de carencia |
| **Descarte / refugo** | Cambio de `Lote` y `Categoria` | Sin baja del sistema |
| **Robo / cuatreo** | `EvtBaja` con `motivo='robo'` + denuncia policial | Documentar `policiaCausa` (campo nuevo) |
| **Extravío** | `EvtBaja` con `motivo='extravio'` | Reversible si aparece |

## 5.3 Parte diario / parte semanal

Pantalla operativa principal del encargado:

```
PARTE DIARIO - {{Establecimiento}} - {{Fecha}}

INGRESOS                          EGRESOS
- Nacimientos: X                  - Ventas: X  ($Y)
- Compras: X (proveedor Z)        - Muertes: X (causas)
- Recibido por DT-e #: X          - Faena: X
                                  - Despachado por DT-e #: X
                                  - Refugo (a otro lote): X

Stock al cierre del día por categoría:
| Categoría | Inicial | Entradas | Salidas | Final |
| ternero   | 100     | 5        | 0       | 105   |
| vaca      | 200     | 0        | 2       | 198   |
| ...       |         |          |         |       |
```

## 5.4 Cierre de stock

Entidad nueva — snapshot inmutable por período:

```
model CierreStock {
  id                String   @id @default(uuid()) @db.Uuid
  fecha             DateTime @db.Date  // último día del período
  periodo           String   // '2026-01' (YYYY-MM) o '2026-T1'
  tipo              String   // 'mensual' | 'trimestral' | 'anual'
  estado            String   @default("borrador") // 'borrador' | 'cerrado'
  fechaCierre       DateTime?
  cerradoPorId      String?  @db.Uuid

  establecimientoId String   @db.Uuid
  establecimiento   Establecimiento @relation(fields: [establecimientoId], references: [id])

  items             CierreStockItem[]
  resumenes         CierreStockResumen[]

  observ            String?
  createdAt         DateTime @default(now())

  @@unique([establecimientoId, periodo])
  @@index([establecimientoId])
  @@map("cierres_stock")
}

model CierreStockItem {
  id                String   @id @default(uuid()) @db.Uuid
  cierreId          String   @db.Uuid
  cierre            CierreStock @relation(fields: [cierreId], references: [id], onDelete: Cascade)

  especieId         String   @db.Uuid
  categoriaId       String   @db.Uuid
  sectorId          String?  @db.Uuid  // null = agregado del establecimiento

  cantidadInicial   Int      @default(0)
  nacimientos       Int      @default(0)
  compras           Int      @default(0)
  ingresosVarios    Int      @default(0)
  ventas            Int      @default(0)
  muertes           Int      @default(0)
  faenas            Int      @default(0)
  egresosVarios     Int      @default(0)
  cantidadFinal     Int      @default(0)

  valorUnitario     Float?
  valorTotal        Float?

  @@unique([cierreId, especieId, categoriaId, sectorId])
  @@map("cierre_stock_items")
}

model CierreStockResumen {
  id              String @id @default(uuid()) @db.Uuid
  cierreId        String @db.Uuid
  cierre          CierreStock @relation(fields: [cierreId], references: [id], onDelete: Cascade)
  concepto        String   // 'GDP_promedio' | 'CC_promedio' | 'mortandad_pct'
  valor           Float
  unidad          String?

  @@map("cierre_stock_resumenes")
}
```

**Workflow de cierre:**
1. Operativamente al fin del mes, el encargado abre la pantalla "Cierre mensual".
2. El sistema corre la query: stock inicial + suma de eventos del período = stock final.
3. Si hay diferencias, se cargan ajustes (genera `EvtMovimiento` o `EvtBaja` con `motivo='ajuste_stock'`).
4. Al cerrar (estado `cerrado`), se vuelve inmutable. Cambios posteriores requieren reapertura con justificación (audit log).

## 5.5 Valuación de inventario

Política configurable por organización (`Organizacion.politicaValuacion`):

- `'costo_adquisicion'` — animal comprado: precio pagado; cría propia: costo estimado (carga $) o $0.
- `'costo_produccion'` — cría propia: costo acumulado (sanidad + alimentación + mano de obra prorrateada).
- `'valor_mercado'` — valor de mercado por categoría a la fecha de cierre (referencia ROSGAN/Liniers).
- `'valor_neto_realizable'` — valor mercado menos costos directos de venta.

Para simplicidad MVP: **costo de adquisición** (más simple) + **valor mercado** (informativo, no contable). En `CierreStockItem` guardar ambos.

## 5.6 Inventario de productos sanitarios

Ya existe `Producto`, `LoteProducto`, `MovimientoStock`. Reglas:

- Stock = sum(entradas) - sum(salidas) por `loteProductoId`.
- Alertar cuando stock < umbral mínimo (config por producto).
- Alertar cuando `LoteProducto.vencimiento` < hoy + 60 días.
- Al aplicar `EvtSanidad` con producto, descontar automáticamente del stock (movimiento tipo `salida`, `motivo='aplicacion_sanitaria'`).

## 5.7 Reportes

- **Existencias por categoría y sector** (al día / a fecha).
- **Movimientos del período** (filtrado por tipo).
- **Comparativo de cierres** (mes a mes, año a año).
- **Mortandad mensual** por especie, categoría, causa.
- **Rotación de stock** (ingresos / inicial promedio).

## Pendientes con cliente

- Confirmar categorías locales (puede haber regionalismos: "criojo", "rezago", etc.).
- Política de valuación deseada.
- Periodicidad de cierre: ¿mensual, trimestral, semestral?
- ¿Lleva inventario de productos sanitarios o lo gestiona el veterinario?
