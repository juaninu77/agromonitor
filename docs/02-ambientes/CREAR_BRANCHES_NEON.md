# 🗄️ Crear Branches en Neon - Guía Rápida

> Guía visual paso a paso para crear los branches de base de datos

---

## 📋 Resumen

Necesitás crear **2 branches adicionales** en Neon:

| Branch | Propósito | URL Ejemplo |
|--------|-----------|-------------|
| `main` | Producción (ya existe) | `ep-xxx.neon.tech` |
| `develop` | **CREAR** - Desarrollo | `ep-xxx-develop.neon.tech` |
| `test` | **CREAR** - Testing | `ep-xxx-test.neon.tech` |

---

## 🚀 Paso a Paso

### Paso 1: Acceder a Neon

1. Abrí tu navegador
2. Andá a: **https://console.neon.tech**
3. Iniciá sesión

### Paso 2: Seleccionar Proyecto

```
┌─────────────────────────────────────────────┐
│              NEON DASHBOARD                  │
├─────────────────────────────────────────────┤
│                                              │
│   📁 Projects                                │
│   ├── 🔵 agromonitor  ← Click acá           │
│   └── ...                                    │
│                                              │
└─────────────────────────────────────────────┘
```

### Paso 3: Ir a Branches

```
┌─────────────────────────────────────────────┐
│              PROYECTO: agromonitor          │
├──────────┬──────────────────────────────────┤
│          │                                   │
│ Overview │                                   │
│ Tables   │                                   │
│ SQL      │                                   │
│ Branches │ ← Click acá                       │
│ Roles    │                                   │
│ Settings │                                   │
│          │                                   │
└──────────┴──────────────────────────────────┘
```

### Paso 4: Ver Branches Existentes

```
┌─────────────────────────────────────────────┐
│              BRANCHES                        │
├─────────────────────────────────────────────┤
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ 🌿 main (default)                    │   │
│  │    Created: ...                       │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [+ Create Branch] ← Click acá              │
│                                              │
└─────────────────────────────────────────────┘
```

### Paso 5: Crear Branch "develop"

```
┌─────────────────────────────────────────────┐
│           CREATE NEW BRANCH                  │
├─────────────────────────────────────────────┤
│                                              │
│  Branch name:                                │
│  ┌────────────────────────────────────┐     │
│  │ develop                             │     │
│  └────────────────────────────────────┘     │
│                                              │
│  Parent branch:                              │
│  ┌────────────────────────────────────┐     │
│  │ main                          ▼    │     │
│  └────────────────────────────────────┘     │
│                                              │
│  ☑️ Include data up to current point        │
│                                              │
│  [Create Branch]                             │
│                                              │
└─────────────────────────────────────────────┘
```

**Valores a ingresar:**
- **Branch name**: `develop`
- **Parent branch**: `main`
- **Include data**: ✅ Sí

### Paso 6: Crear Branch "test"

Repetí el paso anterior con:
- **Branch name**: `test`
- **Parent branch**: `main`
- **Include data**: ✅ Sí

### Paso 7: Obtener URLs de Conexión

Para cada branch:

1. Click en el nombre del branch
2. Buscá "Connection Details"
3. Copiá la "Connection string"

```
┌─────────────────────────────────────────────┐
│           BRANCH: develop                    │
├─────────────────────────────────────────────┤
│                                              │
│  Connection Details                          │
│  ─────────────────                           │
│                                              │
│  Connection string:                          │
│  ┌────────────────────────────────────────┐ │
│  │ postgresql://user:pass@ep-xxx-develop. │ │
│  │ neon.tech/agromonitor?sslmode=require  │ │
│  └────────────────────────────────────────┘ │
│                                   [📋 Copy]  │
│                                              │
└─────────────────────────────────────────────┘
```

---

## 📝 Después de Crear los Branches

### 1. Ejecutar Setup de Ambientes

```bash
pnpm env:setup
```

Cuando te pida las URLs, pegá las que copiaste de Neon.

### 2. Verificar Configuración

```bash
pnpm env:check
```

### 3. Sincronizar Schemas

```bash
# Desarrollo
pnpm db:push:dev

# Testing
pnpm db:push:test
```

### 4. Cargar Datos de Prueba

```bash
pnpm db:seed:dev
```

---

## ✅ Checklist Final

- [ ] Branch `develop` creado en Neon
- [ ] Branch `test` creado en Neon
- [ ] URL de `develop` copiada
- [ ] URL de `test` copiada
- [ ] `pnpm env:setup` ejecutado
- [ ] `pnpm env:check` sin errores
- [ ] `pnpm db:push:dev` exitoso
- [ ] `pnpm db:push:test` exitoso

---

## 🆘 Problemas Comunes

### "No puedo crear branches"

- Verificá tu plan de Neon (el plan gratuito permite varios branches)
- Verificá los permisos de tu usuario

### "La URL no funciona"

- Asegurate de incluir `?sslmode=require` al final
- Verificá que no haya espacios

### "Error de conexión"

- Esperá unos segundos después de crear el branch
- El branch puede tardar en activarse

---

## 📚 Más Información

- [CONFIGURACION_AMBIENTES_COMPLETA.md](./CONFIGURACION_AMBIENTES_COMPLETA.md) - Guía completa
- [GUIA_AMBIENTES.md](./GUIA_AMBIENTES.md) - Referencia rápida

