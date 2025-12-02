# 🌍 Configuración Completa de Ambientes - AgroMonitor

> **Guía paso a paso** para configurar desarrollo, testing y producción con bases de datos separadas y flujo de trabajo profesional con PRs.

---

## 📋 Índice

1. [Resumen del Sistema](#-resumen-del-sistema)
2. [Arquitectura de Ambientes](#-arquitectura-de-ambientes)
3. [Configuración de Neon (Base de Datos)](#-configuración-de-neon-base-de-datos)
4. [Variables de Entorno](#-variables-de-entorno)
5. [Comandos Disponibles](#-comandos-disponibles)
6. [Flujo de Trabajo con Git y PRs](#-flujo-de-trabajo-con-git-y-prs)
7. [CI/CD con GitHub Actions](#-cicd-con-github-actions)
8. [Guía de Uso Diario](#-guía-de-uso-diario)
9. [Solución de Problemas](#-solución-de-problemas)

---

## 📊 Resumen del Sistema

### ¿Qué es un "Ambiente"?

Un **ambiente** es una configuración completa e independiente de la aplicación. Cada ambiente tiene:
- Su propia **base de datos** (datos separados)
- Sus propias **variables de configuración**
- Su propio **propósito**

### Los 3 Ambientes de AgroMonitor

| Ambiente | Propósito | Base de Datos | Cuándo se Usa |
|----------|-----------|---------------|---------------|
| 🟢 **development** | Desarrollo local | `develop` branch | Mientras programás |
| 🟡 **test** | Pruebas automáticas | `test` branch | En cada PR y CI/CD |
| 🔴 **production** | Usuarios reales | `main` branch | App en producción |

### ¿Por qué separar ambientes?

```
❌ SIN AMBIENTES SEPARADOS:
   Desarrollás → Rompés datos de producción → Usuarios afectados

✅ CON AMBIENTES SEPARADOS:
   Desarrollás (develop) → Testeás (test) → Producción segura (main)
```

---

## 🏗️ Arquitectura de Ambientes

### Diagrama General

```
┌─────────────────────────────────────────────────────────────────┐
│                         AGROMONITOR                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │ DEVELOPMENT │    │    TEST     │    │ PRODUCTION  │        │
│   │   (Local)   │    │   (CI/CD)   │    │  (Vercel)   │        │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘        │
│          │                  │                  │                │
│          ▼                  ▼                  ▼                │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │    NEON     │    │    NEON     │    │    NEON     │        │
│   │   develop   │    │    test     │    │    main     │        │
│   │   branch    │    │   branch    │    │   branch    │        │
│   └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Estructura de Archivos

```
📁 agromonitor/
│
├── 📁 config/                          # Configuración central
│   ├── 📄 env.example.txt              # Plantilla de variables
│   ├── 📄 environments.ts              # Configuración por ambiente
│   ├── 📄 database.ts                  # Configuración de BD
│   └── 📄 index.ts                     # Exportaciones
│
├── 📁 scripts/
│   ├── 📄 check-env.ts                 # Verificar configuración
│   └── 📄 setup-env.ts                 # Setup interactivo
│
├── 📁 tests/
│   ├── 📄 setup.ts                     # Configuración de tests
│   └── 📁 config/
│       └── 📄 environments.test.ts     # Tests de ejemplo
│
├── 📁 .github/workflows/
│   └── 📄 ci.yml                       # Pipeline CI/CD
│
├── 📄 .env                             # Variables actuales (dev)
├── 📄 .env.development                 # Variables desarrollo
├── 📄 .env.test                        # Variables testing
├── 📄 .env.production                  # Variables producción
│
├── 📄 vitest.config.ts                 # Configuración de tests
└── 📄 package.json                     # Scripts npm/pnpm
```

---

## 🗄️ Configuración de Neon (Base de Datos)

### ¿Qué son los Branches de Neon?

Neon permite crear **branches** (ramas) de tu base de datos, igual que Git. Cada branch:
- Es una **copia independiente** de los datos
- Tiene su **propia URL de conexión**
- Se puede crear/eliminar sin afectar otras ramas

### Paso a Paso: Crear Branches en Neon

#### 1️⃣ Acceder a Neon Console

1. Abrí tu navegador
2. Andá a **https://console.neon.tech**
3. Iniciá sesión con tu cuenta

#### 2️⃣ Seleccionar tu Proyecto

1. En el dashboard, buscá tu proyecto **"agromonitor"**
2. Hacé click para entrar

#### 3️⃣ Ir a la Sección de Branches

1. En el menú lateral izquierdo, buscá **"Branches"**
2. Hacé click para ver los branches existentes
3. Deberías ver el branch **"main"** (creado por defecto)

#### 4️⃣ Crear Branch "develop"

1. Hacé click en el botón **"Create Branch"** (arriba a la derecha)
2. Completá el formulario:

   | Campo | Valor |
   |-------|-------|
   | **Branch name** | `develop` |
   | **Parent branch** | `main` |
   | **Include data** | ✅ Sí (para copiar datos existentes) |

3. Click en **"Create Branch"**
4. Esperá a que se cree (unos segundos)

#### 5️⃣ Crear Branch "test"

1. Repetí el proceso anterior con:

   | Campo | Valor |
   |-------|-------|
   | **Branch name** | `test` |
   | **Parent branch** | `main` |
   | **Include data** | ✅ Sí |

#### 6️⃣ Obtener las URLs de Conexión

Para cada branch, necesitás obtener la URL:

1. Hacé click en el branch (ej: `develop`)
2. En la página del branch, buscá **"Connection Details"**
3. Copiá la **Connection string** que se ve así:

```
postgresql://usuario:contraseña@ep-xxx-develop.neon.tech/agromonitor?sslmode=require
```

#### 📝 Resumen de URLs (ejemplo)

| Branch | URL de Conexión |
|--------|-----------------|
| `main` | `postgresql://user:pass@ep-xxx.neon.tech/agromonitor?sslmode=require` |
| `develop` | `postgresql://user:pass@ep-xxx-develop.neon.tech/agromonitor?sslmode=require` |
| `test` | `postgresql://user:pass@ep-xxx-test.neon.tech/agromonitor?sslmode=require` |

> ⚠️ **Nota**: Las URLs contienen contraseñas. ¡Nunca las compartas ni las subas a Git!

---

## 🔐 Variables de Entorno

### Variables Requeridas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | URL de conexión a PostgreSQL | `postgresql://user:pass@host/db` |
| `NEXTAUTH_SECRET` | Secreto para tokens JWT (mín. 32 chars) | `abc123xyz789...` |
| `NEXTAUTH_URL` | URL base de la aplicación | `http://localhost:3000` |

### Variables Opcionales

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DIRECT_URL` | URL sin pooler (para migraciones) | Igual que DATABASE_URL |
| `DEBUG_MODE` | Activar logs de debug | `false` |
| `NODE_ENV` | Ambiente actual | `development` |

### Configuración por Ambiente

#### `.env.development`
```env
NODE_ENV=development
DATABASE_URL="postgresql://...@ep-xxx-develop.neon.tech/agromonitor?sslmode=require"
NEXTAUTH_SECRET="tu-secreto-de-desarrollo"
NEXTAUTH_URL="http://localhost:3000"
DEBUG_MODE=true
```

#### `.env.test`
```env
NODE_ENV=test
DATABASE_URL="postgresql://...@ep-xxx-test.neon.tech/agromonitor?sslmode=require"
NEXTAUTH_SECRET="tu-secreto-de-testing"
NEXTAUTH_URL="http://localhost:3000"
DEBUG_MODE=true
```

#### `.env.production`
```env
NODE_ENV=production
DATABASE_URL="postgresql://...@ep-xxx.neon.tech/agromonitor?sslmode=require"
NEXTAUTH_SECRET="tu-secreto-super-seguro-de-produccion"
NEXTAUTH_URL="https://tu-dominio.com"
DEBUG_MODE=false
```

### Generar NEXTAUTH_SECRET

```bash
# En PowerShell (Windows)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

# En Linux/Mac
openssl rand -base64 32
```

### Setup Automático

```bash
# Ejecutar el asistente de configuración
pnpm env:setup

# Verificar que todo esté bien
pnpm env:check
```

---

## 🛠️ Comandos Disponibles

### Comandos de Desarrollo

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Iniciar servidor de desarrollo |
| `pnpm build` | Compilar para producción |
| `pnpm start` | Ejecutar build de producción |
| `pnpm lint` | Verificar código con ESLint |
| `pnpm type-check` | Verificar tipos TypeScript |

### Comandos de Testing

| Comando | Descripción |
|---------|-------------|
| `pnpm test` | Ejecutar tests (modo watch) |
| `pnpm test:ci` | Ejecutar tests (una vez, para CI) |

### Comandos de Base de Datos

| Comando | Descripción |
|---------|-------------|
| `pnpm db:generate` | Generar Prisma Client |
| `pnpm db:push` | Sincronizar schema (ambiente actual) |
| `pnpm db:push:dev` | Sincronizar schema (desarrollo) |
| `pnpm db:push:test` | Sincronizar schema (testing) |
| `pnpm db:push:prod` | Sincronizar schema (producción) |
| `pnpm db:seed` | Cargar datos de prueba |
| `pnpm db:seed:dev` | Cargar datos (desarrollo) |
| `pnpm db:seed:test` | Cargar datos (testing) |
| `pnpm db:studio` | Abrir Prisma Studio |
| `pnpm db:studio:dev` | Prisma Studio (desarrollo) |
| `pnpm db:studio:test` | Prisma Studio (testing) |
| `pnpm db:studio:prod` | Prisma Studio (producción) ⚠️ |
| `pnpm db:reset:test` | Resetear BD de testing |
| `pnpm db:migrate:dev` | Crear migración (desarrollo) |
| `pnpm db:migrate:deploy` | Aplicar migraciones (producción) |

### Comandos de Configuración

| Comando | Descripción |
|---------|-------------|
| `pnpm env:check` | Verificar variables de entorno |
| `pnpm env:setup` | Asistente de configuración |

---

## 🔄 Flujo de Trabajo con Git y PRs

### Estructura de Branches (Git)

```
                    main (producción)
                      │
                      │ ← PR (release)
                      │
                   develop (desarrollo)
                      │
         ┌────────────┼────────────┐
         │            │            │
    feature/A    feature/B    fix/bug-123
         │            │            │
         └────────────┴────────────┘
                      │
                      │ ← PRs individuales
                      ▼
                   develop
```

### Flujo Paso a Paso

#### 1️⃣ Crear Feature Branch

```bash
# Asegurarte de estar actualizado
git checkout develop
git pull origin develop

# Crear tu branch
git checkout -b feature/nueva-funcionalidad
```

#### 2️⃣ Desarrollar

```bash
# Iniciar servidor con BD de desarrollo
pnpm dev

# Hacer cambios...
# Commit frecuentes
git add .
git commit -m "feat: agregar nueva funcionalidad"
```

#### 3️⃣ Push y Crear PR

```bash
# Subir tu branch
git push origin feature/nueva-funcionalidad

# Ir a GitHub y crear Pull Request
# Apuntar a: develop
```

#### 4️⃣ Review y Tests (Automático)

Cuando creás el PR, GitHub Actions automáticamente:
1. Ejecuta `pnpm lint`
2. Ejecuta `pnpm type-check`
3. Ejecuta `pnpm test:ci` con la BD de test

#### 5️⃣ Merge a Develop

Después de:
- ✅ Tests pasando
- ✅ Code review aprobado
- ✅ Sin conflictos

→ Merge el PR a `develop`

#### 6️⃣ Release a Producción

```bash
# Crear PR de develop a main
# Esto dispara tests adicionales
# Después del merge → Deploy automático
```

### Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                      FLUJO DE DESARROLLO                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. DESARROLLO LOCAL                                            │
│  ┌──────────────────┐                                           │
│  │  feature/xxx     │ ← Tu código nuevo                        │
│  │  + BD develop    │                                           │
│  └────────┬─────────┘                                           │
│           │                                                      │
│           ▼                                                      │
│  2. CREAR PR → develop                                          │
│  ┌──────────────────┐                                           │
│  │  GitHub Actions  │ ← Tests automáticos                       │
│  │  + BD test       │                                           │
│  └────────┬─────────┘                                           │
│           │ ✅ Tests pasan                                      │
│           ▼                                                      │
│  3. MERGE A DEVELOP                                             │
│  ┌──────────────────┐                                           │
│  │  develop         │ ← Código integrado                        │
│  │  + BD develop    │                                           │
│  └────────┬─────────┘                                           │
│           │                                                      │
│           ▼                                                      │
│  4. CREAR PR → main                                             │
│  ┌──────────────────┐                                           │
│  │  GitHub Actions  │ ← Tests finales                           │
│  │  + BD test       │                                           │
│  └────────┬─────────┘                                           │
│           │ ✅ Tests pasan + Review                             │
│           ▼                                                      │
│  5. MERGE A MAIN → DEPLOY                                       │
│  ┌──────────────────┐                                           │
│  │  production      │ ← Usuarios reales                         │
│  │  + BD main       │                                           │
│  └──────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 CI/CD con GitHub Actions

### ¿Qué es CI/CD?

- **CI (Continuous Integration)**: Cada vez que subís código, se ejecutan tests automáticamente
- **CD (Continuous Deployment)**: Si los tests pasan, se despliega automáticamente

### Pipeline Configurado

```
┌─────────────────────────────────────────────────────────────────┐
│                      GITHUB ACTIONS PIPELINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   PUSH/PR                                                        │
│      │                                                           │
│      ▼                                                           │
│   ┌─────────┐                                                    │
│   │  LINT   │ → pnpm lint + pnpm type-check                     │
│   └────┬────┘                                                    │
│        │ ✅                                                      │
│        ▼                                                         │
│   ┌─────────┐                                                    │
│   │  TEST   │ → pnpm test:ci (BD test)                          │
│   └────┬────┘                                                    │
│        │ ✅                                                      │
│        ▼                                                         │
│   ┌─────────┐                                                    │
│   │  BUILD  │ → pnpm build (solo en push)                       │
│   └────┬────┘                                                    │
│        │ ✅                                                      │
│        ▼                                                         │
│   ┌─────────┐                                                    │
│   │ DEPLOY  │ → Solo si es main                                 │
│   └─────────┘                                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Configurar Secrets en GitHub

1. Andá a tu repositorio en GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Click en **New repository secret**
4. Agregá cada secret:

| Secret | Descripción | Valor |
|--------|-------------|-------|
| `DATABASE_URL_TEST` | URL BD de testing | `postgresql://...test...` |
| `NEXTAUTH_SECRET_TEST` | Secret para tests | Tu secret de test |
| `DATABASE_URL_PROD` | URL BD de producción | `postgresql://...main...` |
| `NEXTAUTH_SECRET_PROD` | Secret de producción | Tu secret de prod |
| `NEXTAUTH_URL_PROD` | URL de producción | `https://tu-dominio.com` |

---

## 📖 Guía de Uso Diario

### 🌅 Al Empezar el Día

```bash
# 1. Actualizar develop
git checkout develop
git pull origin develop

# 2. Crear branch para tu tarea
git checkout -b feature/lo-que-vas-a-hacer

# 3. Iniciar servidor
pnpm dev
```

### 💻 Durante el Desarrollo

```bash
# Commits frecuentes
git add .
git commit -m "tipo: descripción corta"

# Tipos de commit:
# feat:     Nueva funcionalidad
# fix:      Corrección de bug
# docs:     Documentación
# style:    Formato (no afecta código)
# refactor: Refactorización
# test:     Agregar tests
# chore:    Tareas de mantenimiento
```

### 🌙 Al Terminar

```bash
# 1. Push final
git push origin feature/lo-que-hiciste

# 2. Crear PR en GitHub
# 3. Esperar tests automáticos
# 4. Pedir review si es necesario
```

### 🔧 Comandos Frecuentes

```bash
# Ver estado de variables
pnpm env:check

# Ver datos en la BD
pnpm db:studio:dev

# Resetear BD de test (limpia todo)
pnpm db:reset:test

# Ejecutar tests localmente
pnpm test
```

---

## 🆘 Solución de Problemas

### ❌ "DATABASE_URL no está configurada"

```bash
# Verificar qué falta
pnpm env:check

# Solución: Crear archivo .env correspondiente
pnpm env:setup
```

### ❌ "Error de conexión a la base de datos"

1. Verificá que el branch de Neon esté activo
2. Comprobá que la URL tenga `?sslmode=require`
3. Revisá que no haya espacios en la URL
4. Verificá que no estés usando la URL incorrecta

### ❌ "Tests fallan en CI pero pasan localmente"

1. Verificá que los secrets de GitHub estén configurados
2. Asegurate de que `NODE_ENV=test` esté configurado
3. Revisá que uses la BD de test en CI

### ❌ "Prisma Client no está generado"

```bash
pnpm db:generate
```

### ❌ "Schema de BD desactualizado"

```bash
# Desarrollo
pnpm db:push:dev

# Testing
pnpm db:push:test
```

### ❌ "Conflictos en el PR"

```bash
# Actualizar tu branch con develop
git checkout develop
git pull origin develop
git checkout tu-branch
git merge develop

# Resolver conflictos manualmente
# Después:
git add .
git commit -m "fix: resolver conflictos con develop"
git push
```

---

## 📚 Referencias Rápidas

### Archivos Importantes

| Archivo | Propósito |
|---------|-----------|
| `config/environments.ts` | Configuración de cada ambiente |
| `config/database.ts` | Configuración de BD por ambiente |
| `.github/workflows/ci.yml` | Pipeline de CI/CD |
| `vitest.config.ts` | Configuración de tests |
| `prisma/schema.prisma` | Schema de la BD |

### URLs Útiles

| Recurso | URL |
|---------|-----|
| Neon Console | https://console.neon.tech |
| GitHub Actions | https://github.com/TU_USUARIO/agromonitor/actions |
| Vercel (deploy) | https://vercel.com/dashboard |

### Contactos

- **Errores de BD**: Revisar Neon Console
- **Errores de Deploy**: Revisar Vercel/GitHub Actions
- **Errores de Código**: Revisar logs de tests

---

## ✅ Checklist de Configuración

- [ ] Crear cuenta en Neon (si no tenés)
- [ ] Crear branch `develop` en Neon
- [ ] Crear branch `test` en Neon
- [ ] Ejecutar `pnpm env:setup`
- [ ] Verificar con `pnpm env:check`
- [ ] Ejecutar `pnpm db:push:dev`
- [ ] Ejecutar `pnpm test` para verificar
- [ ] Configurar secrets en GitHub
- [ ] Hacer un push de prueba
- [ ] Verificar que CI/CD funcione

---

*Última actualización: Noviembre 2025*

