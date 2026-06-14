# 09 — Integraciones externas

Sistemas externos a sincronizar (o al menos a interoperar) y la estrategia recomendada para cada uno.

## 9.1 SENASA — SIGSA / SIGBIOTraza

**Objetivo:** mantener la coherencia entre el padrón en Agromonitor y el padrón oficial SENASA, y emitir DT-e con menor fricción.

**Operaciones que se pueden integrar:**
- Consulta de RENSPA (validar formato y estado).
- Consulta de stock declarado oficial (movimiento del padrón).
- Emisión de DT-e.
- Declaración de novedades (nacimientos, muertes, cambios de propietario).
- Reporte de identificación electrónica (Res. 841/2025).

**Realidad de APIs:** SENASA expone web services SOAP con acceso bajo régimen (credenciales por productor o por sistema acreditado). No es API REST pública.

**Estrategia por fases:**

| Fase | Estrategia | Esfuerzo |
|---|---|---|
| **F1 — Manual asistido** | Generamos PDF con datos prearmados para que el encargado pegue en SIGSA. Cuando vuelve el N° de DT-e, lo registra en el sistema. | Bajo |
| **F2 — Import/Export CSV** | Importar padrón oficial desde un export del portal SIGSA al sistema, y exportar novedades en formato compatible. | Medio |
| **F3 — Integración WS** | Conectar a SIGSA via SOAP con credenciales del productor. Requiere mantener el cliente SOAP, manejar errores y reintentos. | Alto |

**Decisión MVP:** F1 + F2 para los dos clientes. F3 queda para evaluación tras 6-12 meses de uso.

## 9.2 ARCA (ex AFIP) — facturación electrónica

**Servicios web disponibles:**

| WS | Función |
|---|---|
| **WSAA** | Autenticación con certificado X.509. Devuelve token + sign. |
| **WSFE v1** | Factura electrónica mercado interno. |
| **WSFEX v1** | Factura electrónica exportación. |
| **WSCDC** | Constancia de inscripción de un CUIT. |
| **WSCT** | Comprobantes de turismo (no aplica). |
| **wsfev1** | Variante. |

**Esquema técnico:**
- Certificado digital por organización (CSR generado en ARCA, certificado .pfx).
- Token de acceso (TA) válido 12 horas.
- Numeración de comprobantes consecutiva por punto de venta y tipo.
- Validación de productos/servicios vs padrón.

**Estrategia por fases:**

| Fase | Estrategia |
|---|---|
| **F1 — PDF previo** | Generamos PDF con datos listos. El productor o contador lo emite en el portal ARCA "Comprobantes en línea" o desde su sistema contable. |
| **F2 — Integración WSFE** | Emitir facturas A/B/C/M desde el sistema. Manejar CAE, anulaciones, notas de crédito/débito. |
| **F3 — Integración WSFEX** | Facturas E para exportación de lana. Más complejo por incoterm, FOB, divisa. |

**Decisión MVP:** F1. F2 cuando se cierre el primer flujo comercial completo de un cliente.

## 9.3 ROSGAN — precios de referencia

Mercado Ganadero de Rosario. Publica precios de referencia por categoría bovina, semanalmente (subastas online).

**Estrategia:** scraping de la página pública o uso del feed RSS si está disponible. Cargar referencia de precio promedio por categoría para mostrar al usuario al cargar una venta ("precio actual de mercado: $X/kg").

Out of scope MVP. Recomendado para Fase 3.

## 9.4 Mercado de Liniers / Cañuelas

Similar a ROSGAN — referencia de precios. Liniers cerró en 2020 y migró a Cañuelas (Mercado Agroganadero de Cañuelas, MAG). Publica precios diarios.

Out of scope MVP.

## 9.5 PROLANA

Programa nacional de calidad de lana. Hoy la operatoria es papel + certificado anual.

**Integración:**
- Generar planilla de acondicionamiento PROLANA en formato oficial (export PDF).
- Si en el futuro habilita digitalización del certificado, importar.

Out of scope técnico — out of scope ETL.

## 9.6 INTA y proveedores de servicios técnicos

INTA Bariloche, INTA Chubut, etc. Proveen:
- Resultados de análisis de lana (laboratorio).
- Análisis de suelos.
- Recomendaciones agronómicas y de sanidad.

Integración limitada: cargar resultados a mano. Si proveen API o portal de descarga, evaluar.

## 9.7 Cooperativas y consignatarios

Cada consignatario tiene su propio sistema (algunas usan email, otras portales).

**Estrategia:** importación de liquidación recibida (Excel/PDF parseado) para evitar doble carga. Out of scope MVP — manualmente se carga en `LiquidacionHacienda`.

## 9.8 Bancos

Para conciliación de cobros:
- Banco Patagonia, Galicia, Macro, Nación — tienen extractos descargables.
- Algunos ofrecen APIs (Banco Nación tiene API ARI/cuenta corriente vía homebanking empresas).

Out of scope MVP. F4: importación de extracto bancario para conciliación automática.

## 9.9 Mapas y geolocalización

`app/mapa/` ya existe en el repo. Para Patagonia importa:
- **Capas de potreros** dibujadas a mano sobre OSM/satellite.
- **Pesadas** geolocalizadas (lectura RFID con GPS de tablet).
- **Mortandad** con punto exacto (puede indicar problemas de sector).

Stack sugerido: Leaflet o MapLibre (open source) sobre tiles satelitales gratuitos. Polígonos guardados en columna `geometria` (PostGIS si se habilita en Neon) o GeoJSON en texto.

## 9.10 IoT — sensores de campo

`app/iot/` ya existe en el repo. Casos de uso patagónicos:
- Bebederos con sensor de nivel.
- Estaciones meteo (lluvia, temperatura, viento).
- Tranqueras con apertura/cierre programada.

Stack típico: MQTT broker + dispositivos LoRaWAN/4G. Out of scope detallado.

## 9.11 Hardware en manga

- **Lectoras RFID de mano:** Tru-Test, Allflex, Datamars.
- **Balanzas:** integración Bluetooth/RS232 (alguna lee directo a tablet).
- **Tabletas rugged:** para captura en galpón/manga.

El módulo `SesionManga` + `SesionMangaItem` ya soporta lectura EID. Hay que confirmar el formato de salida de cada lectora para parseo correcto.

## 9.12 Resumen — qué integramos en MVP

| Sistema | MVP | Fase 2 | Fase 3 |
|---|---|---|---|
| SENASA / SIGSA | PDF asistido + import CSV | — | WSDL completo |
| ARCA / WSFE | PDF previo | WSFE | WSFEX |
| ROSGAN | — | Scraping precios | — |
| Bancos | — | — | Import extracto |
| Mapas | OSM básico | Polígonos potreros | Tracks |
| IoT | — | Mock | MQTT broker |
| Lectoras RFID | Sí | — | — |
| Balanzas | Sí (manual) | Bluetooth | — |

## Pendientes con cliente

- ¿Tienen lectora RFID? ¿Marca/modelo?
- ¿Operan en SIGSA en autogestión hoy?
- ¿Tienen contador que use software específico (Xubio, Tango, Holistor)?
- ¿Operan con un consignatario principal? ¿cuál? (define prioridad de integración).
