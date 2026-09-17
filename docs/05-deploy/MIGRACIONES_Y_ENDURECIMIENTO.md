# Migraciones y endurecimiento de la base de datos

Runbook para aplicar los cambios de esquema de forma segura, respetando
`.cursor/rules/seguridad-db.md` (backup antes de cualquier cambio; nada
destructivo sin confirmación explícita).

> **Regla de oro:** siempre `pnpm db:backup` antes de tocar la base.

## 1. Adopción de migraciones versionadas (baseline)

El proyecto pasó de `prisma db push` (sin historial) a **`prisma migrate`**.
La migración baseline vive en `prisma/migrations/00000000000000_init/` y
representa el esquema completo actual.

### Base de datos EXISTENTE (ya tiene las tablas)

Primero comparar el esquema real con la baseline. **No marcarla aplicada si
faltan columnas, índices o tipos distintos.** La auditoría de Neon del
16/09/2026 confirmó ese caso en `agromonitor/main`: nueve columnas faltantes,
dinero en Float y fechas de historial sin hora. Ver
`../AUDITORIA_NEON_2026-09-16.md`.

Probar y revisar una reconciliación en una rama aislada, conservar los datos,
y comprobar que el esquema resultante coincide con la baseline. Solo entonces
marcarla como aplicada **sin re-ejecutarla** (no recrea tablas):

```bash
pnpm db:backup
prisma migrate resolve --applied 00000000000000_init
```

### Base de datos NUEVA (vacía)

```bash
prisma migrate deploy      # crea todas las tablas desde la baseline
```

De acá en más, cada cambio de esquema se hace con:

```bash
pnpm db:migrate:dev        # crea y aplica una migración en desarrollo
pnpm db:migrate:deploy     # aplica migraciones pendientes en producción
```

## 2. Constraints a nivel motor (post-migración)

La baseline actual no incluye los CHECK ni los índices únicos parciales
(están en `prisma/constraints.sql`). Prisma puede ejecutar ese SQL si se
versiona en una migración. Mientras se mantenga separado, revisar y aplicar:

```bash
pnpm db:constraints        # idempotente
```

Incluye: XOR `animal_id`/`lote_id` en eventos, un solo intervalo abierto por
animal en historiales, dominios de valores (estados/motivos/tipos), y dinero
no negativo. Se crean **`NOT VALID`**: validan filas nuevas sin fallar con
datos históricos inconsistentes.

## 3. Backfill de columnas de tenant

Las columnas de scoping (`animales.establecimiento_id`,
`productos.organizacion_id`, `dietas.organizacion_id`,
`documentos_transito.establecimiento_id`, `lotes_producto.proveedor_id`, y los
catálogos `especies/razas/categorias.organizacion_id`) se agregaron **nullable**
para no romper datos existentes. Completar los NULLs:

```bash
pnpm db:backfill-tenant           # PLAN de solo lectura, opción predeterminada
# Con respaldo y autorización, en ventana sin escrituras concurrentes:
pnpm db:backfill-tenant --apply   # completa relaciones NULL
```

Revisar la salida: reporta cuántas filas quedaron **sin resolver** (requieren
asignación manual, p. ej. animales sin historial abierto de ubicación/lote).
Las evidencias contradictorias no se resuelven por orden de prioridad. Los
proveedores se buscan dentro de la organización del producto y los nombres
duplicados quedan pendientes. Los UPDATE vuelven a exigir NULL para no pisar
una asignación realizada desde que se leyó el plan.

> **Catálogos con varias organizaciones:** si hay más de una organización, los
> catálogos globales previos (especie/raza/categoría) **no** se asignan solos
> — el backfill lo reporta. Hay que **duplicarlos por organización** a mano
> (una copia de cada especie/raza/categoría por org) antes de endurecer.

## 4. Endurecimiento a NOT NULL (DESTRUCTIVO — requiere confirmación)

> ⚠️ Ejecutar **solo** después de que el backfill del punto 3 deje 0 filas sin
> resolver, y con backup previo. Estos `ALTER` fallan si queda algún NULL.

Verificar primero que no queden NULLs:

```sql
SELECT count(*) FROM animales            WHERE establecimiento_id IS NULL;
SELECT count(*) FROM productos           WHERE organizacion_id   IS NULL;
SELECT count(*) FROM dietas              WHERE organizacion_id   IS NULL;
SELECT count(*) FROM documentos_transito WHERE establecimiento_id IS NULL;
```

Si todos dan 0, generar la migración de endurecimiento cambiando esos campos a
obligatorios en `prisma/schema.prisma` (quitar el `?`) y:

```bash
pnpm db:migrate:dev --name tenant_not_null
```

## 5. Validación de los CHECK (post-saneo de datos)

Una vez que la data histórica esté limpia, promover los constraints
`NOT VALID` a validados (escanea las filas existentes una vez):

```sql
ALTER TABLE evt_pesada     VALIDATE CONSTRAINT evt_pesada_animal_xor_lote;
ALTER TABLE evt_sanidad    VALIDATE CONSTRAINT evt_sanidad_animal_xor_lote;
ALTER TABLE evt_movimiento VALIDATE CONSTRAINT evt_movimiento_animal_xor_lote;
ALTER TABLE animales       VALIDATE CONSTRAINT animales_estado_vital_chk;
-- ...y el resto de los CHECK de prisma/constraints.sql
```

## Orden recomendado en cada ambiente

```
auditar diferencias → respaldo → ensayo en rama aislada → revisar reconciliación
→ aplicar cambios aprobados → verificar baseline → adoptar historial
→ plan de backfill → resolver ambigüedades → aplicar backfill aprobado
→ constraints → verificar NULLs → NOT NULL cuando corresponda → VALIDATE
```
