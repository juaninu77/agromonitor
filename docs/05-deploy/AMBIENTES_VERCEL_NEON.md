# Ambientes en Vercel + Neon (producción, preview y desarrollo)

> Cómo quedan separados los ambientes para que ningún deploy ni prueba toque
> la base de producción, y qué configurar en cada lugar. Todo se hace desde
> las webs de Vercel y Neon; no hace falta terminal.

## Estado actual (octubre 2026)

La base vive en el proyecto Neon **`icy-firefly-40648824`**, dentro de la
organización Neon administrada por Vercel del team **Inus** (Vercel → Inus →
Storage). Se migró desde el proyecto personal `sparkling-morning-18269506`
copiando esquema + datos (56 tablas, conteos verificados tabla por tabla); ese
proyecto viejo quedó **solo como respaldo** y no lo usa ningún ambiente.

| Ambiente Vercel | Rama Neon | Endpoint (host directo) |
|---|---|---|
| Production | `main` | `ep-odd-sea-b7v6f4t4.c-13.us-east-1.aws.neon.tech` |
| Preview | `develop` | `ep-rapid-resonance-b7bdf4nu.c-13.us-east-1.aws.neon.tech` |
| Development | `dev` | `ep-soft-wave-b7fj4mzy.c-13.us-east-1.aws.neon.tech` |

El host *pooled* es el mismo con el sufijo `-pooler` (va en `DATABASE_URL`; el
directo va en `DIRECT_URL`). Las ramas `develop` y `dev` se crearon desde `main`
después de la copia, así que arrancan con los mismos datos que producción.

Tras la copia se eliminaron los datos de demostración (organización "Estancia
La Esperanza" y su usuario demo, con animales, eventos, lotes, sectores y
sesiones) en las tres ramas. Quedan solo las cuentas reales y los **catálogos
base globales** (`organizacion_id = NULL`: especies, razas, categorías,
productos sanitarios y forrajes), visibles para todas las organizaciones. Las
variables `POSTGRES_*` / `PG*` / `DATABASE_URL_UNPOOLED` que dejó la
integración anterior apuntan a la base vieja y deben borrarse en Vercel; al
conectar la base nueva desde Storage → *Connect Project*, hacerlo **solo para
Production** para no pisar las variables de Preview y Development.

## Cómo funciona

| Ambiente Vercel | Rama Git | Base de datos (rama Neon) | URL |
|---|---|---|---|
| **Production** | `main` | `main` (producción) | dominio principal |
| **Preview** | `develop` y cualquier otra rama / PR | `develop` (o una rama Neon por deploy, ver abajo) | `agromonitor-git-<rama>-...vercel.app` |
| **Development** | tu computadora | `dev` | `localhost:3000` |

Cada ambiente de Vercel tiene **sus propias variables de entorno**. El build de
Vercel corre `pnpm vercel-build` (definido en `package.json`), que:

1. genera el cliente de Prisma,
2. ejecuta `scripts/vercel-migrate.mjs` → `prisma migrate deploy` sobre **la base
   de ese ambiente** (solo aplica migraciones pendientes; nunca borra datos) y
   aplica `prisma/constraints.sql`,
3. compila la app.

Si la migración falla, el build falla y **queda online el deploy anterior**.

### Guardas que trae el script

| Variable | Qué hace |
|---|---|
| `PRODUCTION_DATABASE_HOST` | Host de la rama `main` de Neon. Si un ambiente que no es Production apunta a ese host, el build **se detiene** sin migrar. Configurarla en **todos** los ambientes. |
| `PREVIEW_DATABASE_HOST` | Opcional. Host de la rama de preview; el build de preview se detiene si apunta a otra base. No usar si se activa "una rama Neon por deploy". |
| `SKIP_DB_MIGRATE=1` | Opcional. Compila sin migrar (por ejemplo, para un hotfix de solo UI). |

El script imprime en el log de build el ambiente y el **host** de la base (nunca
la contraseña), así queda trazado a qué rama fue cada migración.

---

## Paso 1 — Ramas en Neon

En [console.neon.tech](https://console.neon.tech) → proyecto → **Branches**:

1. Verificá que exista `main` (producción).
2. **New Branch** → nombre `develop`, parent `main`. Para el preview.
3. **New Branch** → nombre `dev`, parent `main`. Para desarrollo local.

Cada rama tiene su propio endpoint `ep-...`. Anotá los tres hosts (solo el host,
tipo `ep-xxx.region.aws.neon.tech`), los vas a necesitar en el Paso 3.

> Alternativa recomendada para preview: la integración **Neon Postgres** del
> Marketplace de Vercel puede crear automáticamente **una rama Neon por cada
> deploy de preview** (Settings de la integración → "Preview branches"). Así
> cada PR tiene su copia de la base y se borra sola al cerrar el PR. Si la
> activás, no configures `PREVIEW_DATABASE_HOST`.

## Paso 2 — Connection strings

Para cada rama, en Neon → **Connect**:

- Copiá la **pooled** (host con `-pooler`) → va a `DATABASE_URL`.
- Destildá "Connection pooling" y copiá la **directa** (sin `-pooler`) → va a
  `DIRECT_URL`.

Las dos deben terminar en `?sslmode=require`.

## Paso 3 — Variables en Vercel

Vercel → proyecto → **Settings → Environment Variables**. Al agregar cada
variable, elegí **solo** el ambiente que corresponde (destildá los otros).

### Production (rama `main` de Neon)

| Variable | Valor |
|---|---|
| `DATABASE_URL` | pooled de `main` |
| `DIRECT_URL` | directa de `main` |
| `AUTH_SECRET` | un secreto largo y aleatorio (ver abajo) |
| `PRODUCTION_DATABASE_HOST` | host directo de `main` (`ep-...neon.tech`, sin usuario ni contraseña) |

### Preview (rama `develop` de Neon)

| Variable | Valor |
|---|---|
| `DATABASE_URL` | pooled de `develop` |
| `DIRECT_URL` | directa de `develop` |
| `AUTH_SECRET` | **otro** secreto, distinto al de producción |
| `PRODUCTION_DATABASE_HOST` | el mismo host de `main` que en Production |
| `PREVIEW_DATABASE_HOST` | host directo de `develop` |

### Development (para `vercel env pull`, opcional)

Mismas cuatro variables apuntando a la rama `dev`.

**Generar `AUTH_SECRET`:** en Vercel, al crear la variable hay un botón para
generar un valor aleatorio; o usá cualquier generador de contraseñas con
32+ caracteres. No reutilizar el mismo entre ambientes.

> Si usás la integración Neon del Marketplace, ella crea `DATABASE_URL` y
> `DATABASE_URL_UNPOOLED` por sí sola. El script de migración acepta
> `DATABASE_URL_UNPOOLED` en lugar de `DIRECT_URL`; igual conviene crear
> `DIRECT_URL` para que `pnpm env:check` y Prisma Studio funcionen sin cambios.

## Paso 4 — Ajustes del proyecto en Vercel

- **Settings → General → Build & Development Settings**: dejar *Framework
  Preset* en Next.js y **no** sobrescribir el *Build Command*. Vercel usa
  automáticamente el script `vercel-build` del `package.json`.
- **Settings → Git → Production Branch**: `main`.
- **Settings → Git → Ignored Build Step** (opcional): dejar en automático.
- **Settings → Deployment Protection**: para que el preview sea accesible
  desde el celular sin loguearse en Vercel, poner *Vercel Authentication* en
  "Only Production" o desactivarlo. Producción queda pública igual (es la app).

## Paso 5 — Primer deploy y verificación

1. Hacé un deploy (merge a `main`, o **Deployments → Redeploy** del último).
2. En **Deployments → (el deploy) → Build Logs** buscá las líneas:
   ```
   🗄️  [migrate] Ambiente: production · base: ep-xxx.region.aws.neon.tech
   ✅ [migrate] Base de datos al día
   ```
   El host debe ser el de la rama `main` de Neon.
3. Abrí la URL de producción → **Registrarse** → crear la primera cuenta.
4. Repetí con una rama cualquiera (abrí un PR): en su build log el host debe ser
   el de `develop` (o una rama `preview/...` si usás la integración).

## Desarrollo local

```bash
cp .env.example .env.development   # y completar con la rama `dev` de Neon
pnpm env:check                      # valida variables sin conectarse
pnpm dev
```

`pnpm db:migrate:dev` crea y aplica migraciones **solo** en la rama `dev`.
Nunca apuntar `.env.development` a `main`.

## Flujo de cambios de esquema

1. Editar `prisma/schema.prisma` en una rama Git.
2. `pnpm db:migrate:dev --name <descripcion>` → genera `prisma/migrations/...` y
   lo aplica a tu rama `dev` de Neon.
3. Commit + push → el preview aplica la migración en la rama `develop` (o en su
   rama por deploy) y podés probarla.
4. Merge a `main` → el build de producción aplica la misma migración en `main`.

Reglas de `.cursor/rules/seguridad-db.md`: nunca `db push --force-reset` ni
`migrate reset` contra una rama que no sea tuya; antes de un cambio grande en
producción, crear un **Restore point** / branch de respaldo en Neon.
