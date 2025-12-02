# 🚀 Guía Completa de Configuración - AgroMonitor ERP

## 📋 Índice

1. [Configuración de Base de Datos Neon](#1-configuración-de-base-de-datos-neon)
2. [Configuración de Backups](#2-configuración-de-backups)
3. [Creación de Base de Datos](#3-creación-de-base-de-datos)
4. [Pruebas de Protecciones](#4-pruebas-de-protecciones)
5. [Importación de Datos del Excel](#5-importación-de-datos-del-excel)

---

## 1. Configuración de Base de Datos Neon

### Paso 1.1: Crear cuenta en Neon

1. Ve a [https://neon.tech](https://neon.tech)
2. Crea una cuenta gratuita (si no tienes una)
3. Inicia sesión

### Paso 1.2: Crear proyecto

1. En el dashboard, haz clic en **"Create Project"**
2. Elige un nombre: `agromonitor` (o el que prefieras)
3. Selecciona la región más cercana
4. Elige **PostgreSQL 15** o superior
5. Haz clic en **"Create Project"**

### Paso 1.3: Obtener credenciales

1. Una vez creado el proyecto, ve a **"Connection Details"**
2. Copia el **"Pooled connection string"** (empieza con `postgresql://`)
3. También copia el **"Direct connection string"**

### Paso 1.4: Configurar variables de entorno

1. Crea un archivo `.env` en la raíz del proyecto:

```bash
# Windows
copy .env.example .env

# Linux/Mac
cp .env.example .env
```

2. Edita `.env` y pega tus credenciales:

```env
# Connection pooling URL (para Prisma en producción)
DATABASE_URL="postgresql://usuario:password@host/database?sslmode=require"

# Direct URL (para migraciones)
DIRECT_URL="postgresql://usuario:password@host/database?sslmode=require"
```

⚠️ **IMPORTANTE**: Nunca subas el archivo `.env` a GitHub. Ya está en `.gitignore`.

---

## 2. Configuración de Backups

### Paso 2.1: Activar backups en Neon Dashboard

1. Ve a tu proyecto en [Neon Dashboard](https://console.neon.tech)
2. Ve a **Settings** → **Backups**
3. Activa **Point-in-Time Recovery** (si está disponible en tu plan)
4. Configura backups automáticos diarios

### Paso 2.2: Instalar herramientas de PostgreSQL (para backups locales)

#### Windows:

1. Descarga PostgreSQL desde [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
2. Instala solo las **"Command Line Tools"** (no necesitas el servidor completo)
3. Asegúrate de que `pg_dump` esté en tu PATH

#### Linux/Mac:

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# Mac (con Homebrew)
brew install postgresql
```

### Paso 2.3: Probar script de backup

#### Windows:

```bash
scripts\backup-db.bat
```

#### Linux/Mac:

```bash
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
```

Deberías ver:
```
✅ Backup creado exitosamente
   Archivo: backups/backup_YYYYMMDD_HHMMSS.sql
   Tamaño: XX KB
✅ Backup completado
```

---

## 3. Creación de Base de Datos

### Paso 3.1: Elegir schema

Tienes dos opciones:

#### Opción A: Schema Básico (Actual)
- Usa `prisma/schema.prisma`
- Incluye modelos básicos ya implementados
- Más simple, menos tablas

#### Opción B: Schema Expandido (Recomendado)
- Usa `prisma/schema-expanded.prisma`
- Incluye TODAS las tablas del análisis comparativo
- Soporta todos los datos del Excel

**Recomendación**: Usa el **Schema Expandido** para tener todas las funcionalidades.

### Paso 3.2: Copiar schema expandido (si eliges Opción B)

```bash
# Windows
copy prisma\schema-expanded.prisma prisma\schema.prisma

# Linux/Mac
cp prisma/schema-expanded.prisma prisma/schema.prisma
```

⚠️ **IMPORTANTE**: Esto reemplazará tu schema actual. Asegúrate de tener un backup primero.

### Paso 3.3: Generar cliente de Prisma

```bash
pnpm db:generate
```

Esto crea el código TypeScript para trabajar con tu base de datos.

### Paso 3.4: Crear tablas en la base de datos

⚠️ **ANTES DE EJECUTAR**: Crea un backup primero:

```bash
# Windows
scripts\backup-db.bat

# Linux/Mac
./scripts/backup-db.sh
```

Luego ejecuta:

```bash
pnpm db:push
```

Este comando:
- ✅ Crea todas las tablas en Neon
- ✅ No elimina datos existentes (si los hay)
- ✅ Agrega nuevas tablas y columnas

### Paso 3.5: Verificar que las tablas se crearon

Abre Prisma Studio para ver tus tablas:

```bash
pnpm db:studio
```

Se abrirá una interfaz web en `http://localhost:5555` donde puedes ver todas tus tablas.

---

## 4. Pruebas de Protecciones

### Paso 4.1: Verificar que las reglas de seguridad están activas

Las reglas están en `.cursor/rules/seguridad-db.md`. Cursor las lee automáticamente.

### Paso 4.2: Probar protección contra comandos destructivos

**Prueba 1**: Pedir a la IA que elimine una tabla

```
Tú: "Elimina la tabla de prueba"
```

**Resultado esperado**:
```
⚠️ ATENCIÓN: Voy a ejecutar un comando destructivo.

Comando que se ejecutará:
DROP TABLE prueba;

⚠️ ESTO ELIMINARÁ PERMANENTEMENTE la tabla "prueba" y todos sus datos.

¿Estás completamente seguro de que quieres ejecutar esto? 
Responde "SÍ, eliminar" para confirmar, o "NO" para cancelar.
```

**Prueba 2**: Pedir a la IA que ejecute TRUNCATE

```
Tú: "Limpia todos los datos de la tabla animales"
```

**Resultado esperado**: La IA debe preguntar antes de ejecutar.

### Paso 4.3: Probar script de validación de migraciones

Crea un archivo de prueba `test-migration.sql`:

```sql
-- Este archivo contiene comandos peligrosos
DROP TABLE prueba;
TRUNCATE TABLE animales;
DELETE FROM bovinos;
```

Ejecuta el validador:

```bash
tsx scripts/check-migration-safety.ts test-migration.sql
```

**Resultado esperado**:
```
🚨 COMANDOS PELIGROSOS DETECTADOS:

  🔴 DROP TABLE [HIGH]
     Elimina una tabla y todos sus datos permanentemente
     Línea: 2

  🟠 TRUNCATE TABLE [HIGH]
     Elimina todos los datos de una tabla
     Línea: 3

❌ Esta migración NO es segura para ejecutar automáticamente.
```

---

## 5. Importación de Datos del Excel

### Paso 5.1: Preparar datos del Excel

Tu archivo `sample-data/Administracion 24_25.xlsx` ya está en el proyecto.

### Paso 5.2: Ejecutar script de importación

```bash
pnpm import:excel
```

Este script:
- ✅ Lee todas las hojas del Excel
- ✅ Convierte los datos a formato JSON
- ✅ Guarda los archivos en `prisma/seed-data/`

### Paso 5.3: Revisar datos importados

Revisa los archivos JSON generados en `prisma/seed-data/`:
- `bovinos.json`
- `ovinos.json`
- `campos.json`
- `stock-alimentos.json`
- etc.

### Paso 5.4: Cargar datos a la base de datos

⚠️ **ANTES DE EJECUTAR**: Crea un backup:

```bash
scripts\backup-db.bat  # Windows
# o
./scripts/backup-db.sh  # Linux/Mac
```

Luego ejecuta:

```bash
pnpm db:seed
```

Este comando carga todos los datos del Excel a tu base de datos Neon.

### Paso 5.5: Verificar datos cargados

Abre Prisma Studio:

```bash
pnpm db:studio
```

Verifica que:
- ✅ Hay registros en la tabla `Bovino`
- ✅ Hay registros en la tabla `Ovino`
- ✅ Hay registros en la tabla `Campo`
- ✅ Hay registros en la tabla `StockAlimento`

---

## ✅ Checklist Final

- [ ] Base de datos Neon creada y configurada
- [ ] Variables de entorno configuradas en `.env`
- [ ] Backups automáticos activados en Neon Dashboard
- [ ] Script de backup local probado y funcionando
- [ ] Schema de Prisma elegido y configurado
- [ ] Cliente de Prisma generado (`pnpm db:generate`)
- [ ] Tablas creadas en la base de datos (`pnpm db:push`)
- [ ] Reglas de seguridad verificadas (`.cursor/rules/seguridad-db.md`)
- [ ] Protecciones probadas (IA pregunta antes de comandos destructivos)
- [ ] Datos del Excel importados (`pnpm import:excel`)
- [ ] Datos cargados a la base de datos (`pnpm db:seed`)
- [ ] Datos verificados en Prisma Studio

---

## 🆘 Solución de Problemas

### Error: "DATABASE_URL no está configurada"

**Solución**: Verifica que el archivo `.env` existe y tiene las variables correctas.

### Error: "pg_dump no está instalado"

**Solución**: Instala las herramientas de PostgreSQL (ver Paso 2.2).

### Error: "Connection refused" o "Timeout"

**Solución**: 
1. Verifica que las URLs en `.env` sean correctas
2. Verifica que no haya espacios al inicio o final
3. Verifica tu conexión a internet
4. Verifica que el proyecto en Neon esté activo

### Error al ejecutar `pnpm db:push`

**Solución**:
1. Verifica que `DATABASE_URL` y `DIRECT_URL` estén configuradas
2. Verifica que el schema de Prisma no tenga errores de sintaxis
3. Crea un backup antes de intentar de nuevo

### La IA ejecuta comandos destructivos sin preguntar

**Solución**:
1. Verifica que el archivo `.cursor/rules/seguridad-db.md` existe
2. Reinicia Cursor
3. Verifica que las reglas estén correctamente formateadas

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs de error
2. Consulta la documentación de [Neon](https://neon.tech/docs)
3. Consulta la documentación de [Prisma](https://www.prisma.io/docs)

---

**¡Listo! Tu sistema está configurado y protegido.** 🎉

