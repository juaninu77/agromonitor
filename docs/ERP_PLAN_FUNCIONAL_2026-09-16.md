# AgroMonitor: revisión y camino hacia un ERP utilizable

Fecha: 16 de septiembre de 2026.

## Estado comprobado

La PR #2 fue integrada en main. Esta revisión parte de esa versión. El esquema Prisma contiene 45 modelos. **Todavía no se inspeccionó la base real de Neon**: el conector no está disponible en esta sesión. No se ejecutaron migraciones ni escrituras sobre la base. Tampoco se confirmó una URL de preview funcionando.

Los hallazgos siguientes describen el código, no certifican la configuración ni los datos de producción.

## Qué existe y qué falta

| Área | En el código | Trabajo pendiente |
| --- | --- | --- |
| Organización y campos | Organizaciones, membresías, establecimientos, sectores y lotes | Probar separación de datos y permisos con dos organizaciones |
| Ganadería | Animales, genealogía, eventos, historia de ubicación y sesiones de manga | Contrastar restricciones y datos reales; revisar identidad y trazabilidad |
| Insumos | Productos, existencias y movimientos | Confirmar consistencia de cantidades y ámbito de cada organización |
| Patrimonio | No hay modelo general de activos | Inmuebles, maquinaria, vehículos, mejoras, titularidad y valuaciones |
| Documentos | Documentos de tránsito con algunos datos estructurados | Archivo privado, adjuntos, versiones y vínculos con campo, animal, activo o trámite |
| Facturas y pagos | Finanzas es una pantalla en desarrollo | Comprobantes, renglones, vencimientos, pagos y conciliación |
| SENASA | Registro básico de documentos de tránsito | Trámites, estados, vencimientos, evidencias y animales asociados |

## Hallazgos prioritarios

1. `Animal.cuig` tiene una restricción única por animal. Hay que revisar los valores existentes antes de migrar: CUIG identifica al productor en un establecimiento, por lo que varios animales pueden compartirlo. No debe confundirse con la identificación individual. Referencia: [SENASA, trazabilidad](https://www.argentina.gob.ar/senasa/programas-sanitarios/cadenaanimal/bovinos-y-bubalinos/bovinos-y-bubalinos-produccion-primaria/trazabilidad).
2. La caravana visual es globalmente única. Confirmar si representa una identificación oficial global o un identificador interno que puede repetirse entre campos; la restricción depende de esa decisión.
3. Un establecimiento tiene un solo campo RENSPA. Conviene separar el campo físico de sus registros sanitarios y productores, preservando vigencias e historia.
4. Hay relaciones de organización/establecimiento que permiten NULL. Un catálogo compartido puede justificarlo; un animal o comprobante huérfano requiere investigación. Los conteos de auditoría son señales, no autorización para borrar o completar datos automáticamente.
5. Algunas restricciones están en `prisma/constraints.sql`. Su existencia en el repositorio no prueba que estén aplicadas y validadas en Neon. Revisar también índices, claves foráneas, historial de migraciones y posibles relaciones entre organizaciones distintas.
6. Revisar borrados en cascada antes de agregar patrimonio y documentación: una baja operativa no debería destruir comprobantes e historia. Preferir estados, anulación con motivo y auditoría según cada entidad.
7. El workflow anunciaba un preview sin desplegarlo. Se reemplazó por validación real, sin anuncios ficticios. La publicación requiere confirmar el proveedor y su integración.
8. El verificador de entorno imprimía partes de las conexiones. Ahora muestra errores sin credenciales. La guía conserva TLS y diferencia host directo de host con pooling. La comprobación de host es un diagnóstico, no un bloqueo automático de la aplicación ni prueba de aislamiento.

## Modelo propuesto para ampliar, aún no implementado

- **Organización**: ámbito de permisos. **Persona/empresa**: tercero que puede ser propietario, arrendatario, cliente, proveedor o productor. No asumir que el usuario de acceso es el dueño de todos los campos.
- **Campo y registro sanitario**: campo físico, productor, RENSPA/CUIG, fechas de vigencia y documentos asociados.
- **Activo patrimonial**: tipo, descripción, identificadores, campo, estado; relaciones de titularidad o arrendamiento con porcentaje y vigencia. Valuaciones separadas con fecha y moneda. Los animales conservan su modelo especializado.
- **Documento y archivo**: metadatos y relaciones en Neon; PDF, fotos y escaneos en almacenamiento privado. Guardar clave del archivo, tamaño, tipo, huella y versión; autorizar tanto la carga como la descarga según organización. Un enlace difícil de adivinar no reemplaza permisos.
- **Comprobante**: emisor, receptor, tipo, número, fecha, moneda, importes y renglones. Usar decimales para dinero. Factura y pago son entidades distintas: un pago puede cancelar parcialmente varias facturas y viceversa, mediante imputaciones. Adjuntar un PDF no significa contabilizarlo automáticamente.
- **Trámite**: organismo, tipo, número, estado, responsables, fechas y evidencias; para tránsito, origen/destino y animales o lotes involucrados. Registrar documentos oficiales no equivale a emitirlos en SENASA; una integración oficial requeriría comprobar acceso y servicios disponibles.

Evitar una sola tabla de archivos o un JSON gigante que intente reemplazar relaciones, estados y validaciones del negocio.

## Próximos pasos, en orden

### 1. Verificar Neon de solo lectura

Conectar el plugin Neon y confirmar proyecto, rama y base. Ejecutar `scripts/audit/neon-catalog.sql`; después adaptar `scripts/audit/neon-integrity.sql` a las tablas reales antes de ejecutarlo. Revisar permisos del rol, restricciones validadas, índices y diferencias frente a Prisma. No declarar insegura una base solamente por no tener RLS: comprobar también la autorización y el filtrado por organización en todas las rutas. Revisar política de recuperación y ramas disponibles en la cuenta.

### 2. Preparar un preview separado

Confirmar dónde se publica el proyecto y su URL. Crear o verificar una rama de base exclusiva de pruebas y usar datos de demostración. Una rama Neon puede copiar datos de su origen: comprobar qué contiene antes de dar acceso al preview. Mantener almacenamiento y credenciales de prueba separados.

Configurar `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` y, para el diagnóstico de preview, `PREVIEW_DATABASE_HOST`. Ejecutar `pnpm env:check` en ese entorno. Nunca pegar contraseñas en el chat ni guardarlas en Git. Comparar esquema e historial antes de aplicar migraciones versionadas; no usar reset ni db push sobre datos existentes como atajo.

Referencia: [integración Neon/Vercel y ramas por preview](https://neon.com/blog/neon-vercel-native-integration). Para archivos, una opción a evaluar si se usa Vercel es [Blob privado](https://vercel.com/docs/vercel-blob/private-storage).

### 3. Primera entrega funcional

Después de confirmar titularidad y auditar la base: carga y edición de campos, terceros y activos; archivo privado con adjuntos; factura con renglones y vencimiento; pago parcial; ficha del animal con evidencias; registro de trámite SENASA y documento oficial adjunto. Cada entrega debe incluir pantalla, API, permisos, migración y prueba del recorrido completo. No presentar estas funciones como terminadas antes de poder probarlas.

### 4. Pruebas acompañadas

Crear una organización de demostración con dos campos y otra organización separada. Cargar un animal, registrar una pesada y verificar su historia. Cargar un activo y su documento. Registrar una factura y un pago parcial y comprobar el saldo. Adjuntar un trámite con vencimiento. Intentar consultar archivos y registros desde la otra organización y desde un usuario sin permisos. Probar errores de carga y reintentos sin duplicar información.

## Datos que faltan para continuar

Nombre del proyecto Neon, conexión autorizada del plugin, URL/proveedor del preview y si se administrará una o varias personas/empresas propietarias. No hacen falta contraseñas en el chat.
