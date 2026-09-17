# Actualización aplicada y validación — 17/09/2026

Este informe corresponde a la primera entrega (PR #3). La siguiente etapa de patrimonio, comprobantes, documentos privados y seguimiento de trámites se describe en [Administración del campo](ADMINISTRACION_DEL_CAMPO.md).

## Alcance

Se ensayó la reconciliación del esquema de AgroMonitor con Prisma en una rama Neon separada y después se aplicó a `main/neondb`, conforme a la autorización del usuario. No se borraron tablas ni registros. Esta entrega deja operativa la estructura existente; no implementa todavía patrimonio, archivo privado, facturación o integración oficial con SENASA.

## Respaldo y entorno de ensayo

- Proyecto Neon: `agromonitor`, ID `sparkling-morning-18269506`.
- Rama de ensayo: `codex-erp-foundation-test`, ID `br-patient-rice-ah9t1nrs`.
- Snapshot previo de main: `before-erp-foundation-20260917`, ID `snap-gentle-art-ahiixdt2`.
- Base adicional `erp_empty_check`, dentro de la rama de ensayo: verifica instalación desde cero.
- `claude-sandbox` se conservó intacta.

La copia de ensayo contiene los datos heredados de main y usuarios ficticios creados por las pruebas HTTP. No debe conectarse como producción ni exponerse públicamente sin revisar accesos.

## Cambios aplicados

1. Nueve columnas faltantes, 22 índices nuevos y 11 claves foráneas faltantes; sustitución del índice global de nombres de especies por unicidad dentro de cada organización y eliminación del índice redundante de email.
2. Cuatro importes convertidos de Float a Decimal(12,2), con comprobación previa de rango y ausencia de redondeo necesario. Fechas del historial de lotes convertidas a timestamp, conservando las fechas originales a medianoche.
3. Los 34 animales vinculados a sus campos a partir de historiales abiertos coincidentes. Catálogos, productos y dieta asignados únicamente cuando su uso identifica una sola organización.
4. Dieciséis CHECK validados y tres índices únicos parciales para impedir estados/eventos inválidos e historiales abiertos duplicados.
5. Migración versionada de integridad en `prisma/migrations/20260917030000_integrity`. El SQL de adaptación de la base histórica se conserva en `scripts/audit/reconcile-neon-legacy.sql`; no debe repetirse sobre una base ya actualizada. La asignación por evidencia está en `scripts/audit/backfill-neon-evidence.sql`.
6. Middleware de autenticación sin Prisma: los tokens corruptos requieren nuevo login. Los tokens válidos siguen funcionando y desaparece la advertencia de Prisma en Edge durante el build.
7. Alta atómica de animales, pesada inicial y sus historiales. Un fallo de una operación revierte todo el alta. Se rechazan lotes y sectores de otro establecimiento.

Se compararon conteos y hashes de identidades de las 45 tablas originales antes y después de actualizar main: coinciden. Las relaciones nuevas se completaron y los tipos señalados cambiaron; esta comprobación verifica preservación de registros, no que todas las columnas hayan permanecido iguales.

## Pruebas ejecutadas

- 66 pruebas automatizadas unitarias/de rutas aprobadas.
- 54 comprobaciones reales de Prisma en la rama Neon: lectura de los 45 modelos, alta transaccional, pesadas, precisión decimal, conservación de hora, rechazo de eventos ambiguos, valores inválidos y lotes abiertos duplicados. Las fixtures de esta prueba se revirtieron.
- 50 comprobaciones HTTP sobre la compilación real: registro de dos cuentas, login, sesión, organización/campo iniciales, catálogos, animal, pesada inicial y posterior, aislamiento de lectura/escritura entre organizaciones, rollback de alta parcial, rechazo de sector de otro campo y respuestas de seis páginas.
- Migraciones aplicadas correctamente desde cero en `erp_empty_check` y sobre la copia reconciliada de datos existentes.
- Compilación de producción aprobada. Persisten advertencias previas de hooks/deprecaciones; no se deshabilitaron validaciones.
- TypeScript y lint de los archivos modificados aprobados.

Las pruebas HTTP comprueban respuestas y datos del servidor; no sustituyen una prueba visual de todos los formularios, dispositivos o del bastón RFID.

## Registros pendientes de titularidad

Se conservaron sin asignación automática 3 productos, 1 especie, 3 razas y 7 categorías que no permiten deducir propietario por su uso. No se publicaron a todas las organizaciones ni se asignaron a la primera. Los registros sin organización no aparecen en las listas normales del ERP. Hace falta identificar el propietario antes de hacerlos visibles.

## Preview y siguientes módulos

La prueba local utiliza la rama de ensayo. El enlace/configuración del proyecto Vercel sigue pendiente de confirmación; un merge en GitHub no demuestra por sí solo que se haya desplegado ni que las variables apunten a la rama correcta.

El siguiente desarrollo funcional debe agregar activos patrimoniales y archivo privado, seguido por facturas/pagos y trámites documentados. PDFs/fotos necesitan almacenamiento privado y autorización de acceso; no se simula una carga funcional guardando solamente nombres de archivos.
