# 🚀 Guía Paso a Paso: Vercel + Neon - Desde Cero hasta Operativo

## 📋 Índice

1. [Paso 1: Crear Proyecto en Vercel](#paso-1-crear-proyecto-en-vercel)
2. [Paso 2: Conectar Neon desde Vercel](#paso-2-conectar-neon-desde-vercel)
3. [Paso 3: Configurar Variables de Entorno](#paso-3-configurar-variables-de-entorno)
4. [Paso 4: Configurar Base de Datos Localmente](#paso-4-configurar-base-de-datos-localmente)
5. [Paso 5: Crear Tablas en la Base de Datos](#paso-5-crear-tablas-en-la-base-de-datos)
6. [Paso 6: Importar Datos del Excel](#paso-6-importar-datos-del-excel)
7. [Paso 7: Verificar que Todo Funciona](#paso-7-verificar-que-todo-funciona)
8. [Paso 8: Desplegar a Vercel](#paso-8-desplegar-a-vercel)

---

## Paso 1: Crear Proyecto en Vercel

### 1.1: Crear cuenta en Vercel (si no tienes)

1. Ve a [https://vercel.com](https://vercel.com)
2. Haz clic en **"Sign Up"**
3. Elige **"Continue with GitHub"** (recomendado) o tu método preferido
4. Completa el registro

### 1.2: Conectar tu repositorio

1. En el dashboard de Vercel, haz clic en **"Add New..."** → **"Project"**
2. Si tu proyecto está en GitHub:
   - Conecta tu cuenta de GitHub si no lo has hecho
   - Busca el repositorio `agromonitor`
   - Haz clic en **"Import"**
3. Si tu proyecto NO está en GitHub:
   - Primero súbelo a GitHub
   - Luego sigue los pasos anteriores

### 1.3: Configurar proyecto (NO despliegues aún)

1. En la pantalla de configuración:
   - **Framework Preset**: Debería detectar "Next.js" automáticamente
   - **Root Directory**: Deja en blanco (o `./` si está en la raíz)
   - **Build Command**: `pnpm build` (o `npm run build`)
   - **Output Directory**: `.next` (debería estar automático)
   - **Install Command**: `pnpm install` (o `npm install`)

2. **NO hagas clic en "Deploy" todavía** - primero necesitamos configurar Neon

---

## Paso 2: Conectar Neon desde Vercel

### 2.1: Crear base de datos Neon desde Vercel

1. En la pantalla de configuración del proyecto de Vercel, busca la sección **"Environment Variables"** o **"Integrations"**
2. Busca **"Neon"** en las integraciones disponibles
3. Haz clic en **"Add Integration"** → **"Neon"**
4. Si es la primera vez:
   - Te pedirá autorizar Vercel para acceder a Neon
   - Haz clic en **"Authorize"**
   - Inicia sesión en Neon (o crea cuenta si no tienes)

### 2.2: Crear proyecto Neon

1. Una vez autorizado, verás opciones:
   - **"Create a new Neon project"** (recomendado)
   - O conectar un proyecto existente
2. Haz clic en **"Create a new Neon project"**
3. Configura el proyecto:
   - **Project Name**: `agromonitor` (o el nombre que prefieras)
   - **Region**: Elige la más cercana (ej: `us-east-1`, `eu-west-1`)
   - **PostgreSQL Version**: `15` o superior (recomendado)
4. Haz clic en **"Create Project"**

### 2.3: Obtener credenciales

Una vez creado el proyecto, Vercel automáticamente:
- ✅ Creará las variables de entorno `DATABASE_URL` y `DIRECT_URL`
- ✅ Las configurará en tu proyecto de Vercel

**IMPORTANTE**: Anota estas URLs porque las necesitarás localmente también.

---

## Paso 3: Configurar Variables de Entorno

### 3.1: Obtener las URLs de Neon

1. En Vercel, ve a tu proyecto → **Settings** → **Environment Variables**
2. Busca `DATABASE_URL` y `DIRECT_URL`
3. Haz clic en cada una para ver su valor
4. **Copia ambas URLs** (las necesitarás para desarrollo local)

### 3.2: Configurar archivo .env local

1. En tu proyecto local, crea un archivo `.env` en la raíz:

```bash
# Windows (en la terminal del proyecto)
type nul > .env

# Linux/Mac
touch .env
```

2. Abre el archivo `.env` y pega las URLs:

```env
# Connection pooling URL (para Prisma en producción)
DATABASE_URL="postgresql://usuario:password@host/database?sslmode=require"

# Direct URL (para migraciones)
DIRECT_URL="postgresql://usuario:password@host/database?sslmode=require"
```

⚠️ **IMPORTANTE**: 
- Reemplaza las URLs con las que copiaste de Vercel
- No dejes espacios al inicio o final
- Mantén las comillas

### 3.3: Verificar que .env está en .gitignore

Abre `.gitignore` y verifica que tenga:

```gitignore
.env
.env*.local
.env.production
```

Si no está, agrégalo (ya debería estar configurado).

---

## Paso 4: Configurar Base de Datos Localmente

### 4.1: Instalar dependencias (si no lo has hecho)

```bash
pnpm install
```

### 4.2: Elegir schema

Tienes dos opciones:

#### Opción A: Schema Básico (Actual)
- Usa `prisma/schema.prisma` que ya existe
- Más simple, menos tablas

#### Opción B: Schema Expandido (Recomendado) ⭐
- Usa `prisma/schema-expanded.prisma`
- Incluye TODAS las tablas necesarias para tu Excel

**Recomendación**: Usa el **Schema Expandido**.

**Para usar el Schema Expandido**:

```bash
# Windows
copy prisma\schema-expanded.prisma prisma\schema.prisma

# Linux/Mac
cp prisma/schema-expanded.prisma prisma/schema.prisma
```

⚠️ **ADVERTENCIA**: Esto reemplazará tu schema actual. Si tienes datos importantes, haz backup primero.

### 4.3: Generar cliente de Prisma

```bash
pnpm db:generate
```

**Resultado esperado**:
```
✔ Generated Prisma Client (X.XX s)
```

Si hay errores, revísalos y corrígelos antes de continuar.

---

## Paso 5: Crear Tablas en la Base de Datos

### 5.1: Crear backup (por seguridad)

```bash
# Windows
scripts\backup-db.bat

# Linux/Mac
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
```

**Nota**: Si es la primera vez y la base de datos está vacía, el backup puede estar vacío, pero es bueno tener el script funcionando.

### 5.2: Crear tablas en Neon

```bash
pnpm db:push
```

**Resultado esperado**:
```
✔ Your database is now in sync with your Prisma schema.

✔ Generated Prisma Client (X.XX s)
```

**Si hay errores**:
- Verifica que `DATABASE_URL` y `DIRECT_URL` estén correctas en `.env`
- Verifica que no haya errores de sintaxis en `prisma/schema.prisma`
- Verifica tu conexión a internet

### 5.3: Verificar que las tablas se crearon

Abre Prisma Studio para ver tus tablas:

```bash
pnpm db:studio
```

Se abrirá una ventana del navegador en `http://localhost:5555`

**Verifica que veas tablas como**:
- ✅ `Bovino`
- ✅ `Ovino`
- ✅ `Campo`
- ✅ `StockAlimento`
- ✅ `CategoriaAnimal`
- ✅ `Rodeo`
- etc.

Si no ves las tablas, revisa los errores del paso anterior.

---

## Paso 6: Importar Datos del Excel

### 6.1: Importar Excel a JSON

```bash
pnpm import:excel
```

**Resultado esperado**:
```
✅ Datos importados exitosamente
   Archivos creados en prisma/seed-data/
```

**Verifica que se crearon archivos**:
- `prisma/seed-data/bovinos.json`
- `prisma/seed-data/ovinos.json`
- `prisma/seed-data/campos.json`
- `prisma/seed-data/stock-alimentos.json`
- etc.

### 6.2: Crear backup antes de cargar datos

```bash
# Windows
scripts\backup-db.bat

# Linux/Mac
./scripts/backup-db.sh
```

### 6.3: Cargar datos a la base de datos

```bash
pnpm db:seed
```

**Resultado esperado**:
```
✅ Datos cargados exitosamente
   - X Campos
   - X Bovinos
   - X Ovinos
   - X Stock de Alimentos
   ...
```

### 6.4: Verificar datos cargados

En Prisma Studio (si aún está abierto, refresca la página):

1. Haz clic en la tabla `Bovino`
2. Deberías ver registros (ej: 176 bovinos)
3. Haz clic en la tabla `Ovino`
4. Deberías ver registros (ej: 262 ovinos)
5. Verifica otras tablas también

---

## Paso 7: Verificar que Todo Funciona

### 7.1: Probar API localmente

Inicia el servidor de desarrollo:

```bash
pnpm dev
```

Abre tu navegador en `http://localhost:3000`

### 7.2: Probar endpoints de API

Abre en tu navegador:
- `http://localhost:3000/api/ganado/bovinos` - Debería mostrar tus bovinos
- `http://localhost:3000/api/ganado/ovinos` - Debería mostrar tus ovinos

**Resultado esperado**: JSON con datos de tus animales.

### 7.3: Probar protecciones de seguridad

Pide a la IA en Cursor:

```
"Elimina la tabla de prueba"
```

**Resultado esperado**: La IA debe preguntarte antes de ejecutar.

Si ejecuta directamente sin preguntar, verifica que `.cursor/rules/seguridad-db.md` existe y reinicia Cursor.

---

## Paso 8: Desplegar a Vercel

### 8.1: Verificar que las variables de entorno están en Vercel

1. Ve a tu proyecto en Vercel
2. Ve a **Settings** → **Environment Variables**
3. Verifica que existan:
   - ✅ `DATABASE_URL`
   - ✅ `DIRECT_URL`

Si no están, agrégalas manualmente copiando desde Neon Dashboard.

### 8.2: Hacer commit y push de cambios

```bash
# Verificar cambios
git status

# Agregar cambios
git add .

# Hacer commit
git commit -m "Configurar base de datos Neon y schema expandido"

# Push a GitHub
git push
```

### 8.3: Desplegar en Vercel

**Opción A: Despliegue automático**
- Si conectaste GitHub, Vercel despliega automáticamente cuando haces push
- Ve a tu proyecto en Vercel y espera a que termine el despliegue

**Opción B: Despliegue manual**
1. En Vercel, ve a tu proyecto
2. Haz clic en **"Deploy"** o **"Redeploy"**
3. Espera a que termine

### 8.4: Verificar despliegue

1. Una vez terminado el despliegue, haz clic en la URL de tu proyecto (ej: `agromonitor.vercel.app`)
2. Verifica que la aplicación carga correctamente
3. Prueba los endpoints:
   - `https://tu-proyecto.vercel.app/api/ganado/bovinos`
   - `https://tu-proyecto.vercel.app/api/ganado/ovinos`

---

## ✅ Checklist Final

Marca cada paso cuando lo completes:

### Configuración Inicial
- [ ] Cuenta de Vercel creada
- [ ] Proyecto conectado a GitHub
- [ ] Integración Neon configurada en Vercel
- [ ] Proyecto Neon creado

### Configuración Local
- [ ] Archivo `.env` creado con `DATABASE_URL` y `DIRECT_URL`
- [ ] Schema elegido (básico o expandido)
- [ ] Cliente de Prisma generado (`pnpm db:generate`)
- [ ] Tablas creadas en Neon (`pnpm db:push`)
- [ ] Tablas verificadas en Prisma Studio

### Importación de Datos
- [ ] Datos del Excel importados (`pnpm import:excel`)
- [ ] Datos cargados a la base de datos (`pnpm db:seed`)
- [ ] Datos verificados en Prisma Studio

### Verificación
- [ ] API funciona localmente (`pnpm dev`)
- [ ] Endpoints responden correctamente
- [ ] Protecciones de seguridad funcionan
- [ ] Aplicación desplegada en Vercel
- [ ] Aplicación funciona en producción

---

## 🆘 Solución de Problemas

### Error: "DATABASE_URL no está configurada"

**Solución**:
1. Verifica que el archivo `.env` existe en la raíz del proyecto
2. Verifica que tiene `DATABASE_URL` y `DIRECT_URL`
3. Verifica que no hay espacios al inicio o final
4. Reinicia la terminal después de crear `.env`

### Error: "Connection refused" o "Timeout"

**Solución**:
1. Verifica que las URLs en `.env` sean correctas
2. Verifica que el proyecto en Neon esté activo (ve a Neon Dashboard)
3. Verifica tu conexión a internet
4. Verifica que las URLs no tengan caracteres especiales mal escapados

### Error al ejecutar `pnpm db:push`

**Solución**:
1. Verifica que `DATABASE_URL` y `DIRECT_URL` estén configuradas
2. Verifica que el schema de Prisma no tenga errores:
   ```bash
   pnpm db:generate
   ```
3. Si hay errores de sintaxis, corrígelos primero

### Error: "pg_dump no está instalado" (al hacer backup)

**Solución**:
- Esto es solo para backups locales
- Puedes saltarte este paso si no tienes PostgreSQL instalado
- Los backups en Neon Dashboard funcionan automáticamente

### La aplicación no carga en Vercel

**Solución**:
1. Verifica los logs de despliegue en Vercel
2. Verifica que las variables de entorno estén configuradas en Vercel
3. Verifica que el build no tenga errores
4. Revisa la consola del navegador para errores

---

## 📞 Recursos de Ayuda

- **Vercel Docs**: [https://vercel.com/docs](https://vercel.com/docs)
- **Neon Docs**: [https://neon.tech/docs](https://neon.tech/docs)
- **Prisma Docs**: [https://www.prisma.io/docs](https://www.prisma.io/docs)
- **Neon Dashboard**: [https://console.neon.tech](https://console.neon.tech)
- **Vercel Dashboard**: [https://vercel.com/dashboard](https://vercel.com/dashboard)

---

## 🎉 ¡Listo!

Una vez completados todos los pasos, tu sistema estará:

- ✅ Base de datos Neon configurada y funcionando
- ✅ Todas las tablas creadas según tu Excel
- ✅ Datos importados y cargados
- ✅ Protecciones de seguridad activas
- ✅ Desplegado en Vercel y funcionando

**¡Felicidades! Tu sistema AgroMonitor está operativo.** 🚀

