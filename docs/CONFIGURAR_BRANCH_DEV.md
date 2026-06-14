# Configurar Branch de Desarrollo en Neon

## Problemas Encontrados con `.env.dev`

### ❌ Problemas Actuales:

1. **Nombre incorrecto**: Archivo se llama `.env.dev` pero debe ser `.env.development`
2. **Usuario read-only**: `claude_ro` no puede escribir en la BD
3. **No usa branch**: Apunta a la base principal, no a una branch de desarrollo

## ✅ Solución: Configurar Branch de Desarrollo

### Paso 1: Crear Branch en Neon

1. Ve a [Neon Console](https://console.neon.tech)
2. Selecciona tu proyecto
3. En el menú lateral, haz clic en **"Branches"**
4. Haz clic en **"New Branch"**
5. Configura:
   - **Name**: `dev` o `development`
   - **Parent branch**: `main` (o la que uses como producción)
   - **Compute settings**: Puedes usar menor capacidad para dev
6. Haz clic en **"Create Branch"**

### Paso 2: Obtener Credenciales de la Branch

Una vez creada la branch:

1. Selecciona la branch **"dev"** en el dropdown de branches
2. Ve a **"Connection Details"**
3. Copia las connection strings - **IMPORTANTE**: Cada branch tiene su propio endpoint único

Ejemplo:
```
Main branch:  ep-purple-mode-xxx.region.aws.neon.tech
Dev branch:   ep-young-tree-yyy.region.aws.neon.tech  ← Endpoint diferente!
```

### Paso 3: Actualizar `.env.development`

Edita el archivo `.env.development` que ya creé con las credenciales de tu branch:

```bash
# Estas URLs vienen de la branch "dev" en Neon Console
DATABASE_URL="postgresql://[user]:[password]@[dev-branch-endpoint]/neondb?sslmode=require"
DIRECT_URL="postgresql://[user]:[password]@[dev-branch-endpoint]/neondb"
```

**IMPORTANTE**: Asegúrate de usar un usuario con permisos de **ESCRITURA** (no `claude_ro`)

### Paso 4: Verificar Configuración

Prueba la conexión:

```bash
# Generar cliente Prisma
pnpm db:generate

# Push del schema a la branch de dev
pnpm db:push:dev

# Si funciona, seed con datos de prueba
pnpm db:seed:dev

# Abrir Prisma Studio para ver los datos
pnpm db:studio:dev
```

### Paso 5 (Opcional): Eliminar `.env.dev`

Una vez que `.env.development` esté funcionando:

```bash
# Eliminar archivo obsoleto
rm .env.dev
```

## Verificar que NO estás usando la BD Principal

Para asegurarte de que estás usando la branch de dev y no la principal:

```bash
# El endpoint debe ser DIFERENTE al de producción
# Producción: ep-purple-mode-xxx
# Desarrollo: ep-young-tree-yyy (o similar, pero DISTINTO)
```

## Ventajas de Usar Branches en Neon

✅ **Datos aislados**: Los cambios en dev no afectan producción
✅ **Schema independiente**: Puedes probar migraciones sin riesgo
✅ **Reset fácil**: Puedes eliminar y recrear la branch cuando quieras
✅ **Gratis en Neon**: Las branches están incluidas en el plan free

## Flujo de Trabajo Recomendado

```bash
# 1. Desarrollo local contra branch dev
pnpm dev  # (usa .env por defecto)

# 2. Cambios en schema
# Editar prisma/schema.prisma
pnpm db:push:dev

# 3. Resetear datos de dev si es necesario
pnpm db:reset:test  # o crear uno para dev

# 4. Cuando estés listo para producción
# Crear migración formal
pnpm db:migrate:dev
# Deploy a producción
pnpm db:migrate:deploy  # (con .env.production)
```

## Troubleshooting

### Error: "permission denied"
- Verifica que NO estés usando `claude_ro` (read-only)
- Usa las credenciales de la branch dev con permisos de escritura

### Error: "database not found"
- Verifica que el nombre de la BD sea `neondb` (o el que uses)
- Verifica que el endpoint sea el de la branch dev

### Scripts no encuentran `.env.development`
- Verifica que el archivo se llame exactamente `.env.development`
- No uses `.env.dev` o `.env.develop`

## Comandos Útiles

```bash
# Ver qué archivo .env está usando cada comando
pnpm db:push        # usa .env (default)
pnpm db:push:dev    # usa .env.development
pnpm db:push:test   # usa .env.test
pnpm db:push:prod   # usa .env.production
```
