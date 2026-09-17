# Auditoría real de Neon — AgroMonitor

Fecha local: 16/09/2026. Fuente: MCP oficial de Neon, consultas SELECT sobre catálogo y conteos. No se aplicaron migraciones ni modificaciones de datos.

## Resultado principal

**La base tiene datos y las tablas del ERP, pero no coincide con el código actual.** Antes de probar los módulos publicados hay que reconciliar el esquema en una rama aislada. Una compilación correcta no detecta estas diferencias porque no ejecuta todas las consultas contra la base.

Proyecto: `agromonitor` (`sparkling-morning-18269506`), organización Neon `Vercel: juaninu77's projects`. Rama consultada: `main` (`br-odd-thunder-ahszbavr`), base `neondb`, PostgreSQL 17.11, región `aws-us-east-1`. La relación entre esta base y el despliegue publicado debe confirmarse en la configuración del hosting.

Existe además la rama `claude-sandbox`, creada el 19/05/2026. No se reutilizó ni modificó: puede contener trabajo previo. La rama main aparecía archivada en la consulta inicial y su endpoint pasó a activo al consultar; eso no significa pérdida de datos.

## Hallazgos que bloquean compatibilidad

### Nueve columnas esperadas por Prisma no existen

| Tabla | Columna faltante |
| --- | --- |
| animales | establecimiento_id |
| especies | organizacion_id |
| razas | organizacion_id |
| categorias | organizacion_id |
| productos | organizacion_id |
| dietas | organizacion_id |
| audit_log | organizacion_id |
| documentos_transito | establecimiento_id |
| lotes_producto | proveedor_id |

Las rutas que consultan o escriben estos campos pueden fallar aunque la aplicación compile. Agregar las columnas sin completar pertenencias tampoco resuelve todo: los filtros de organización pueden ocultar registros que permanezcan sin asignar.

### Tipos desactualizados

`evt_baja.precio_kg`, `evt_baja.precio_total`, `evt_sanidad.costo` y `lotes_producto.costo` están como `float8`; Prisma espera Decimal. `animal_lote_hist.desde/hasta` están como DATE; Prisma espera fecha y hora. Convertirlos no recuperará horas que nunca fueron guardadas. El control de importes con más de dos decimales devolvió 0, pero se debe comprobar rango y valores especiales antes de definir la conversión final.

### Sin historial de migraciones

No existe `public._prisma_migrations`. La migración inicial del repositorio representa un esquema más nuevo que el real. No ejecutar esa creación de tablas sobre esta base ni marcarla aplicada por el mero hecho de que existan las tablas. Primero reconciliar y verificar equivalencia, incluyendo índices y claves foráneas.

## Integridad y datos

Se observaron 45 tablas, 44 claves primarias y 68 claves foráneas; las claves foráneas están validadas. La tabla de tokens usa índices únicos y no tiene clave primaria, lo que explica la diferencia de conteo. Los índices únicos existen aunque no figuren como restricciones UNIQUE en pg_constraint.

Hay 34 animales, 3 organizaciones, 3 establecimientos, 3 usuarios, 6 sesiones de manga, 0 lecturas de manga, 6 productos, 1 dieta y 0 documentos de tránsito. Estos conteos no permiten distinguir datos de prueba de datos reales: conservar todos hasta aclararlo.

Controles ejecutados, todos con 0 casos afectados:

- Eventos de pesada, sanidad y movimiento con animal/lote ambiguo o ausente.
- Animales con varios lotes o ubicaciones abiertos simultáneamente.
- Intervalos de historial con fin anterior al inicio.
- Contadores de manga distintos del número de lecturas.
- Lecturas de manga sin animal (la tabla está vacía; no prueba ese recorrido).
- Precios y costos sanitarios negativos; existencias negativas de lotes de producto.

Los 34 animales tienen exactamente un establecimiento deducible por sus historiales abiertos; ninguno quedó sin candidato o con candidatos contradictorios. Esto es un diagnóstico: no se aplicó la asignación.

No existen CHECK en las tablas públicas ni los índices parciales que limitan los historiales abiertos. Por tanto, los datos examinados pasan esos controles hoy, pero el motor aún no impide futuras violaciones. Hay 19 relaciones con borrado en cascada; revisar sus efectos al incorporar documentos y patrimonio.

Los 34 animales tienen CUIG informado y existe `animales_cuig_key` único. Revisar el significado y origen de esos valores antes de quitar la unicidad o moverlos a un registro sanitario. No se leyó ni publicó su contenido.

## Seguridad y configuración

Ninguna de las 45 tablas tiene RLS habilitado y hay 0 políticas. La separación entre organizaciones depende actualmente de las rutas y permisos de la aplicación. Esto no demuestra por sí solo exposición pública, pero exige pruebas de acceso cruzado antes de usar varios titulares o compartir documentos.

El MCP consulta como `neondb_owner`, con permisos para crear bases/roles y omitir RLS. No se verificó qué rol usa Vercel: no confundir el rol de auditoría con el de la aplicación. Conviene separar rol de ejecución y rol de migración al preparar el despliegue.

La configuración consultada permite conexiones públicas autenticadas y no define una lista de IP. No cambiar esto a ciegas: una restricción incompatible con el hosting puede cortar el acceso. Ambos endpoints informan `pooler_enabled=false`; verificar las URLs y el modo de conexión usados realmente por el despliegue. No se recuperaron contraseñas.

El proyecto informa una retención histórica de 21.600 segundos (6 horas). Una rama de pruebas no reemplaza una política de respaldo y recuperación para documentación o movimientos patrimoniales.

## Correcciones de código realizadas a partir de la auditoría

- La auditoría estática ahora avisa expresamente que solo examina archivos y no certifica Neon.
- El runbook exige reconciliar diferencias antes de marcar la baseline aplicada.
- El backfill funciona en modo PLAN de solo lectura por defecto; las escrituras requieren `--apply` explícito.
- La asignación de animales usa evidencia de historiales abiertos y deja pendientes las contradicciones.
- La asociación de proveedores exige organización coincidente y nombre no ambiguo.
- Los documentos consideran origen y destino; si corresponden a distintos campos propios, quedan pendientes de una decisión.
- Los UPDATE de relaciones vuelven a exigir que la columna esté en NULL al escribir.

El script de backfill actualizado no se ejecutó contra main: sus columnas aún faltan. Sus pruebas de selección de candidatos son locales.

## Orden de resolución

1. Confirmar URL de la aplicación y relación del despliegue con esta base. Conservar todos los datos mientras no se aclare cuáles son de prueba.
2. Crear una rama nueva de ensayo desde main y un respaldo antes de una migración. Mantener claude-sandbox intacta.
3. Generar y revisar una reconciliación versionada: columnas, tipos, índices y relaciones. Ensayarla y comparar nuevamente con Prisma. Preparar el SQL concreto antes de pedir autorización para aplicar cambios sobre datos existentes.
4. Planificar asignaciones: los animales tienen candidatos no ambiguos, pero los catálogos/productos/dietas necesitan resolver pertenencia entre tres organizaciones. No asignar todo a la primera organización.
5. Adoptar historial de migraciones, completar asignaciones revisadas, agregar/validar restricciones y probar permisos con dos organizaciones.
6. Confirmar un preview aislado. Luego construir el recorrido campo → patrimonio → documento privado → factura → pago, y ampliar trámites y documentación ganadera.

Esta revisión no certifica todos los permisos de la aplicación, no prueba el frontend publicado, no restaura datos ni implementa los módulos que faltan. Las consultas de `scripts/audit/neon-integrity.sql` presuponen el esquema nuevo; en esta auditoría se usaron consultas adaptadas al catálogo real para no referenciar las nueve columnas ausentes.
