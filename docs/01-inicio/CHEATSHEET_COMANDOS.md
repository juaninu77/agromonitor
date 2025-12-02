# 📋 Cheatsheet de Comandos - AgroMonitor

> Referencia rápida de todos los comandos disponibles

---

## 🚀 Desarrollo

```bash
# Iniciar servidor de desarrollo
pnpm dev

# Build para producción
pnpm build

# Ejecutar build de producción
pnpm start
```

---

## 🧪 Testing

```bash
# Tests en modo watch (desarrollo)
pnpm test

# Tests una sola ejecución (CI/CD)
pnpm test:ci
```

---

## 🔍 Código

```bash
# Verificar ESLint
pnpm lint

# Verificar tipos TypeScript
pnpm type-check
```

---

## 🗄️ Base de Datos

### General

```bash
# Generar Prisma Client
pnpm db:generate

# Sincronizar schema (ambiente actual)
pnpm db:push

# Cargar datos de prueba
pnpm db:seed

# Abrir Prisma Studio
pnpm db:studio
```

### Por Ambiente

| Ambiente | Sincronizar | Seed | Studio |
|----------|-------------|------|--------|
| Desarrollo | `pnpm db:push:dev` | `pnpm db:seed:dev` | `pnpm db:studio:dev` |
| Testing | `pnpm db:push:test` | `pnpm db:seed:test` | `pnpm db:studio:test` |
| Producción | `pnpm db:push:prod` | - | `pnpm db:studio:prod` ⚠️ |

### Migraciones

```bash
# Crear migración (desarrollo)
pnpm db:migrate:dev

# Aplicar migraciones (producción)
pnpm db:migrate:deploy

# Resetear BD de testing (¡BORRA TODO!)
pnpm db:reset:test
```

---

## ⚙️ Configuración

```bash
# Verificar variables de entorno
pnpm env:check

# Asistente de configuración
pnpm env:setup
```

---

## 🔄 Git Workflow

### Empezar Feature

```bash
git checkout develop
git pull origin develop
git checkout -b feature/nombre-feature
```

### Commit

```bash
git add .
git commit -m "tipo: descripción"

# Tipos: feat, fix, docs, style, refactor, test, chore
```

### Push y PR

```bash
git push origin feature/nombre-feature
# Crear PR en GitHub → develop
```

### Actualizar con Develop

```bash
git checkout develop
git pull
git checkout feature/nombre-feature
git merge develop
```

---

## 📊 Tabla Resumen

| Tarea | Comando |
|-------|---------|
| Iniciar dev | `pnpm dev` |
| Tests | `pnpm test` |
| Lint | `pnpm lint` |
| Types | `pnpm type-check` |
| Ver BD | `pnpm db:studio:dev` |
| Sync BD | `pnpm db:push:dev` |
| Verificar env | `pnpm env:check` |

---

## 🆘 Problemas Comunes

| Problema | Solución |
|----------|----------|
| "Cannot find module" | `pnpm install` |
| "Prisma Client not generated" | `pnpm db:generate` |
| "DATABASE_URL not set" | `pnpm env:setup` |
| "Schema out of sync" | `pnpm db:push:dev` |
| Puerto ocupado | El servidor usa otro puerto automáticamente |

---

## 🔗 Documentación

- [Guía Completa de Ambientes](./CONFIGURACION_AMBIENTES_COMPLETA.md)
- [Crear Branches en Neon](./CREAR_BRANCHES_NEON.md)
- [Referencia de Ambientes](./GUIA_AMBIENTES.md)

