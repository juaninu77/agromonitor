# 07 — Comercial y administrativo

Liquidación de hacienda, facturación, AFIP/ARCA, IVA agropecuario y cuenta corriente con clientes/proveedores. Hoy el schema solo guarda `EvtBaja.precioTotal` y `dtaNumero`/`facturaNumero` — falta toda la capa comercial estructurada.

## 7.1 Alcance

El módulo cubre:

1. **Operaciones de venta** de hacienda (con o sin consignatario).
2. **Operaciones de venta** de lana (ver `04-produccion-lana.md` para la lógica específica).
3. **Compras** de hacienda y de insumos.
4. **Facturación electrónica** vía ARCA (ex AFIP).
5. **Cuenta corriente** con clientes y proveedores.
6. **Exportación contable** a sistemas externos (Xubio, Tango, Holistor, planilla manual).

**Fuera de alcance:** libro diario contable, mayor, balance, estado de resultados. Esos quedan en el contable externo.

## 7.2 Liquidación de hacienda con consignatario

Flujo típico de venta en remate:

```
1. Productor consigna hacienda al consignatario.
2. Consignatario gana subasta o remate particular.
3. Consignatario factura al comprador a nombre del productor.
4. Consignatario retiene comisión + gastos de venta + impuestos.
5. Consignatario liquida al productor el neto.
```

Modelo:

```
model LiquidacionHacienda {
  id                String   @id @default(uuid()) @db.Uuid
  fecha             DateTime @db.Date
  numero            String?  // número de liquidación del consignatario

  consignatarioId   String?  @db.Uuid
  consignatario     Cliente? @relation("ConsignatarioLiquidacion", fields: [consignatarioId], references: [id])
  compradorFinal    String?  // razón social del frigorífico / comprador final
  compradorCuit     String?

  // Detalles
  cantidadAnimales  Int
  pesoTotalKg       Float?
  precioKg          Float?
  bruto             Float
  comisionConsignatario Float @default(0)
  gastosVenta       Float    @default(0)  // flete, sanidad pre-venta, etc.
  iva               Float    @default(0)
  ingresoBruto      Float    @default(0)  // II.BB. provincia
  retencionGanancias Float   @default(0)
  retencionIVA      Float    @default(0)
  otrasRetenciones  Float    @default(0)
  neto              Float    // = bruto - todas las deducciones

  fechaCobro        DateTime? @db.Date
  estadoCobro       String   @default("pendiente") // 'pendiente' | 'parcial' | 'cobrado'
  formaPago         String?  // 'transferencia' | 'cheque' | 'ec'

  // Vinculación
  establecimientoId String   @db.Uuid
  establecimiento   Establecimiento @relation(fields: [establecimientoId], references: [id])

  documentoTransitoId String? @db.Uuid
  documentoTransito   DocumentoTransito? @relation(fields: [documentoTransitoId], references: [id])

  items             LiquidacionHaciendaItem[]

  documentoUrl      String?  // PDF de la liquidación
  observ            String?
  createdAt         DateTime @default(now())

  @@index([establecimientoId])
  @@index([fecha])
  @@map("liquidaciones_hacienda")
}

model LiquidacionHaciendaItem {
  id                String   @id @default(uuid()) @db.Uuid
  liquidacionId     String   @db.Uuid
  liquidacion       LiquidacionHacienda @relation(fields: [liquidacionId], references: [id], onDelete: Cascade)

  categoriaNombre   String   // "Novillo"
  cantidad          Int
  pesoTotalKg       Float
  pesoPromedio      Float
  precioKg          Float
  subtotal          Float

  @@map("liquidaciones_hacienda_items")
}
```

Al cargar una `LiquidacionHacienda`:
1. Vincular al `DocumentoTransito` correspondiente.
2. Para cada animal individualizado en el DT-e, registrar `EvtBaja` con `motivo='venta'`, `precioKg`, `precioTotal` (prorrateado).
3. Crear movimientos en **cuenta corriente** con el comprador/consignatario.
4. Generar comprobante de venta (factura o remito según corresponda).

## 7.3 ARCA (ex AFIP) — facturación electrónica

### Comprobantes relevantes para el sector

| Comprobante | Uso |
|---|---|
| **Factura A / B / C** | Venta a frigoríficos, exportadores, particulares. La letra depende del comprador y el régimen del productor. |
| **Factura E** | Exportación (lana lavada/peinada a Europa/China). |
| **Remito R** | Documento de traslado AFIP (complementa el DT-e SENASA). |
| **Liquidación primaria de granos (LPG)** | Si se vende grano de los verdeos cosechados. |
| **Carta de porte** | Para granos en tránsito. |
| **Recibo X** | Cobro de la liquidación. |

### Integración con ARCA

**Servicios disponibles:**
- WSFE (factura electrónica mercado interno).
- WSFEX (factura electrónica exportación).
- WSCDC (constancia de inscripción).
- WSRemCarne (remito electrónico cárnico — opcional).

**Estrategia:**
- **Fase MVP:** generación de **PDF imprimible** con todos los campos requeridos, sin emisión electrónica. El productor o contador externo lo emite manualmente en el portal ARCA.
- **Fase 2:** integración WSFE/WSFEX vía certificado digital y token de la organización.

Modelo:

```
model Comprobante {
  id                String   @id @default(uuid()) @db.Uuid
  tipo              String   // 'factura_A' | 'factura_B' | 'factura_C' | 'factura_E' | 'remito_R' | 'recibo' | 'nota_credito' | 'nota_debito'
  puntoVenta        Int
  numero            Int
  fechaEmision      DateTime @db.Date
  fechaVencimiento  DateTime? @db.Date

  emisorCuit        String   // CUIT del productor (organización)
  receptorCuit      String?
  receptorRazonSocial String?
  receptorCondicionIVA String? // 'RI' | 'MT' | 'EX' | 'CF'

  // Totales
  netoGravado       Float    @default(0)
  iva              Float    @default(0)
  noGravado         Float    @default(0)
  exento            Float    @default(0)
  total             Float

  // ARCA
  cae               String?
  caeVencimiento    DateTime? @db.Date
  arcaEstado        String   @default("borrador") // 'borrador' | 'emitido' | 'rechazado' | 'anulado'
  arcaError         String?

  organizacionId    String   @db.Uuid
  organizacion      Organizacion @relation(fields: [organizacionId], references: [id])

  // Vinculación opcional
  liquidacionHaciendaId String? @db.Uuid
  liquidacionLanaId     String? @db.Uuid

  documentoUrl      String?

  items             ComprobanteItem[]
  cobros            Cobro[]

  observ            String?
  createdAt         DateTime @default(now())

  @@unique([organizacionId, tipo, puntoVenta, numero])
  @@index([organizacionId])
  @@index([fechaEmision])
  @@map("comprobantes")
}

model ComprobanteItem {
  id                String   @id @default(uuid()) @db.Uuid
  descripcion       String
  cantidad          Float
  unidad            String?  // 'kg' | 'cabeza' | 'unidad'
  precioUnitario    Float
  subtotal          Float
  ivaAlicuota       Float?   // 21.0 | 10.5 | 0
  iva              Float    @default(0)

  comprobanteId     String   @db.Uuid
  comprobante       Comprobante @relation(fields: [comprobanteId], references: [id], onDelete: Cascade)

  @@map("comprobantes_items")
}
```

### IVA agropecuario

- **Alícuota 10.5%** para venta de hacienda en pie y leche cruda.
- **Alícuota 21%** para servicios y la mayoría de insumos.
- **Exento** lana sucia (en algunos casos — confirmar régimen).

El sistema sugiere la alícuota según el tipo de operación pero permite override.

### Padrón ganadero AFIP

Régimen tributario específico. El productor inscripto en padrón ganadero tiene:
- Reducción de retenciones.
- Plazo extendido de pago de IVA.
- Obligación de declarar movimientos.

Solo se registra el flag `Organizacion.padronGanadero = boolean` y el efecto se aplica en cálculo de retenciones.

## 7.4 Cuenta corriente

Por cliente y por proveedor:

```
model CuentaCorriente {
  id                String   @id @default(uuid()) @db.Uuid
  contraparteTipo   String   // 'cliente' | 'proveedor'
  contraparteId     String   @db.Uuid
  organizacionId    String   @db.Uuid

  saldo             Float    @default(0)
  ultimoMovimiento  DateTime?

  movimientos       MovimientoCuentaCte[]

  @@unique([contraparteTipo, contraparteId, organizacionId])
  @@map("cuentas_corrientes")
}

model MovimientoCuentaCte {
  id                String   @id @default(uuid()) @db.Uuid
  fecha             DateTime @db.Date
  tipo              String   // 'venta' | 'compra' | 'cobro' | 'pago' | 'ajuste'
  concepto          String
  debe              Float    @default(0)
  haber             Float    @default(0)
  saldoPosterior    Float

  comprobanteId     String?  @db.Uuid
  comprobante       Comprobante? @relation(fields: [comprobanteId], references: [id])

  liquidacionHaciendaId String? @db.Uuid
  liquidacionLanaId     String? @db.Uuid

  cuentaId          String   @db.Uuid
  cuenta            CuentaCorriente @relation(fields: [cuentaId], references: [id], onDelete: Cascade)

  observ            String?
  createdAt         DateTime @default(now())

  @@index([cuentaId])
  @@index([fecha])
  @@map("movimientos_cuenta_cte")
}

model Cobro {
  id            String   @id @default(uuid()) @db.Uuid
  fecha         DateTime @db.Date
  monto         Float
  formaPago     String   // 'transferencia' | 'cheque' | 'efectivo' | 'compensacion'
  referencia    String?  // n° cheque, CBU, etc.

  comprobanteId String   @db.Uuid
  comprobante   Comprobante @relation(fields: [comprobanteId], references: [id])

  observ        String?
  createdAt     DateTime @default(now())

  @@index([comprobanteId])
  @@map("cobros")
}
```

## 7.5 Compras de hacienda

Cuando se compra hacienda:

1. Cargar `EvtMovimiento` o nuevo evento `EvtAlta` para los animales.
2. Crear `Comprobante` recibido (no emitido) con `tipo='factura_A'`, `receptorCuit` = cuit propio.
3. Generar movimiento en cuenta corriente del proveedor.

## 7.6 Exportación contable

Pantalla "Exportar a contable" — genera CSVs/Excel con:
- Comprobantes emitidos del período.
- Comprobantes recibidos del período.
- Cobros y pagos.
- Saldos de cuenta corriente.

Formatos sugeridos: **Xubio**, **Tango Gestión**, **Holistor**, y formato genérico (CSV con cabeceras estándar).

## 7.7 Centros de costo

Cada `Establecimiento` actúa como centro de costo. Reportes financieros se pueden filtrar por establecimiento. La organización ve el agregado.

## 7.8 Reportes financieros

- **Margen bruto por categoría** — ingresos por ventas - costos directos (sanidad + alimentación específica).
- **Resultado por establecimiento** — ingresos - egresos del período.
- **Ranking de clientes** por volumen anual.
- **Ranking de proveedores**.
- **Aging de cuentas corrientes** (0-30, 31-60, 61-90, 90+).
- **Proyección de cobros** (liquidaciones pendientes con fecha estimada).

## 7.9 Multimoneda

La lana se cotiza en USD. Los granos a veces también. Operaciones internas en ARS.

`Comprobante.moneda` (`'ARS' | 'USD' | 'EUR'`) y `Comprobante.cotizacion` (a la fecha). Reportes consolidados en ARS aplicando cotización.

## Pendientes con cliente

- ¿Régimen tributario actual? (Responsable Inscripto, Monotributo agropecuario, etc.).
- ¿Está en padrón ganadero AFIP?
- ¿Tiene contador externo? ¿Qué sistema usa?
- ¿Vende a frigorífico, consignatario, particular?
- ¿Operaciones en USD recurrentes (lana)? ¿Cómo registra la cotización?
- ¿Quiere facturación electrónica integrada o exportar a contador?
