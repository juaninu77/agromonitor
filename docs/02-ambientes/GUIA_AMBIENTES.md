# 🌍 Guía de Ambientes - AgroMonitor

Esta guía explica cómo configurar y trabajar con los diferentes ambientes del proyecto.

## 📋 Índice

1. [Ambientes Disponibles](#ambientes-disponibles)
2. [Configuración Inicial](#configuración-inicial)
3. [Base de Datos por Ambiente](#base-de-datos-por-ambiente)
4. [Variables de Entorno](#variables-de-entorno)
5. [Comandos por Ambiente](#comandos-por-ambiente)
6. [Flujo de Trabajo con PRs](#flujo-de-trabajo-con-prs)
7. [CI/CD](#cicd)

---

## 🎯 Ambientes Disponibles

| Ambiente | Propósito | Branch BD | URL |
|----------|-----------|-----------|-----|
| **development** | Desarrollo local | `develop` | http://localhost:3000 |
| **test** | Pruebas automatizadas | `test` | http://localhost:3000 |
| **production** | Producción | `main` | https://tu-dominio.com |

---

## ⚙️ Configuración Inicial

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Configurar ambientes automáticamente

```bash
pnpm env:setup
```

Este script te guiará para crear los archivos:
- `.env.development`
- `.env.test`
- `.env.production`

### 3. Configurar manualmente (alternativa)

Copia `config/env.example.txt` y renómbralo según el ambiente:

```bash
# Windows
copy config\env.example.txt .env.development
copy config\env.example.txt .env.test
copy config\env.example.txt .env.production

# Linux/Mac
cp config/env.example.txt .env.development
cp config/env.example.txt .env.test
cp config/env.example.txt .env.production
```

### 4. Verificar configuración

```bash
pnpm env:check
```

---

## 🗄️ Base de Datos por Ambiente

### Estructura en Neon

Usamos **branches de Neon** para separar los datos de cada ambiente:

```
📦 Proyecto Neon: agromonitor
├── 🌿 main (Producción)
│   └── Datos reales de usuarios
├── 🌱 develop (Desarrollo)
│   └── Datos de prueba para desarrollo
└── 🧪 test (Testing)
    └── Se reinicia en cada suite de tests
```

### Crear branches en Neon

1. Ve a [console.neon.tech](https://console.neon.tech)
2. Selecciona tu proyecto
3. En el menú lateral → "Branches"
4. Click "Create Branch"
5. Crea:
   - `develop` (desde `main`)
   - `test` (desde `main`)

### URLs de conexión

Cada branch tiene su propia URL de conexión. Ejemplo:

```env
# Desarrollo (branch: develop)
DATABASE_URL="postgresql://user:pass@ep-xxx-develop.neon.tech/agromonitor?sslmode=require"

# Test (branch: test)
DATABASE_URL="postgresql://user:pass@ep-xxx-test.neon.tech/agromonitor?sslmode=require"

# Producción (branch: main)
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/agromonitor?sslmode=require"
```

---

## 🔐 Variables de Entorno

### Variables Requeridas

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de conexión a PostgreSQL |
| `NEXTAUTH_SECRET` | Secreto para JWT (mínimo 32 caracteres) |
| `NEXTAUTH_URL` | URL base de la aplicación |

### Variables Opcionales

| Variable | Descripción |
|----------|-------------|
| `DIRECT_URL` | URL sin pooler para migraciones |
| `DEBUG_MODE` | Habilitar logs de debug |
| `WEATHER_API_KEY` | API del clima |
| `MARKET_API_KEY` | API de precios |

### Generar NEXTAUTH_SECRET

```bash
# Linux/Mac
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

---

## 🛠️ Comandos por Ambiente

### Desarrollo

```bash
# Iniciar servidor de desarrollo
pnpm dev

# Base de datos
pnpm db:push:dev      # Sincronizar schema
pnpm db:seed:dev      # Cargar datos de prueba
pnpm db:studio:dev    # Abrir Prisma Studio
```

### Testing

```bash
# Ejecutar tests
pnpm test             # Watch mode
pnpm test:ci          # CI/CD (una sola ejecución)

# Base de datos de test
pnpm db:push:test     # Sincronizar schema
pnpm db:seed:test     # Cargar datos de prueba
pnpm db:reset:test    # Resetear completamente
```

### Producción

```bash
# Build
pnpm build:prod

# Migraciones (solo deploy, no genera nuevas)
pnpm db:migrate:deploy

# Studio (¡CUIDADO! Datos reales)
pnpm db:studio:prod
```

---

## 🔄 Flujo de Trabajo con PRs

### Estructura de Branches (Git)

```
main (producción)
└── develop (desarrollo)
    ├── feature/nueva-funcionalidad
    ├── fix/correccion-bug
    └── refactor/mejoras
```

### Proceso de un PR

```mermaid
graph LR
    A[Feature Branch] --> B[PR a develop]
    B --> C{Tests Pasan?}
    C -->|Sí| D[Merge a develop]
    C -->|No| A
    D --> E[PR a main]
    E --> F[Review + Tests]
    F --> G[Merge a main]
    G --> H[Deploy Automático]
```

### Pasos Detallados

#### 1. Crear feature branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/mi-nueva-funcionalidad
```

#### 2. Desarrollar con ambiente local

```bash
# Usar base de datos de desarrollo
pnpm dev
```

#### 3. Crear PR a develop

```bash
git push origin feature/mi-nueva-funcionalidad
# Crear PR en GitHub/GitLab apuntando a develop
```

#### 4. Tests automáticos en CI

El CI ejecuta:
- `pnpm lint`
- `pnpm type-check`
- `pnpm test:ci` (usa base de datos de test)

#### 5. Merge a develop

Después de aprobación y tests pasando.

#### 6. PR de develop a main

Para releases a producción.

---

## 🚀 CI/CD

### GitHub Actions (ejemplo)

Crea `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_ENV: test

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 9
          
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          
      - run: pnpm install
      
      - run: pnpm lint
      
      - run: pnpm type-check
      
      - run: pnpm test:ci
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_TEST }}
          NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET_TEST }}
          NEXTAUTH_URL: http://localhost:3000

  build:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 9
          
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          
      - run: pnpm install
      
      - run: pnpm build:prod
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_PROD }}
          NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET_PROD }}
          NEXTAUTH_URL: ${{ secrets.NEXTAUTH_URL_PROD }}
```

### Secrets de GitHub

Configura en tu repositorio (Settings → Secrets):

| Secret | Ambiente |
|--------|----------|
| `DATABASE_URL_TEST` | Test |
| `NEXTAUTH_SECRET_TEST` | Test |
| `DATABASE_URL_PROD` | Producción |
| `NEXTAUTH_SECRET_PROD` | Producción |
| `NEXTAUTH_URL_PROD` | Producción |

---

## 📝 Resumen de Archivos

```
📁 agromonitor/
├── 📄 .env                    # Enlace simbólico o copia de .env.development
├── 📄 .env.development        # Variables para desarrollo
├── 📄 .env.test               # Variables para testing
├── 📄 .env.production         # Variables para producción (NO commitear)
├── 📁 config/
│   ├── 📄 env.example.txt     # Plantilla de referencia
│   ├── 📄 environments.ts     # Configuración de ambientes
│   ├── 📄 database.ts         # Configuración de BD
│   └── 📄 index.ts            # Exportaciones
└── 📁 scripts/
    ├── 📄 check-env.ts        # Verificar configuración
    └── 📄 setup-env.ts        # Setup interactivo
```

---

## ⚠️ Importante

1. **NUNCA** commitear archivos `.env*` con credenciales reales
2. Agrega a `.gitignore`:
   ```
   .env
   .env.development
   .env.test
   .env.production
   .env*.local
   ```
3. Usa **secrets** en CI/CD para las credenciales
4. Cada desarrollador debe configurar sus propios archivos `.env`

---

## 🆘 Solución de Problemas

### "DATABASE_URL no está configurada"

```bash
pnpm env:check
# Verifica qué variables faltan
```

### "Error de conexión a la base de datos"

1. Verifica que el branch de Neon esté activo
2. Comprueba que la URL tenga `?sslmode=require`
3. Revisa que no haya espacios en la URL

### "Tests fallan en CI pero pasan localmente"

1. Verifica que los secrets de GitHub estén configurados
2. Asegúrate de usar la base de datos de test en CI
3. Revisa que `NODE_ENV=test` esté configurado

