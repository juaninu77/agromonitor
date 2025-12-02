# 🔒 Seguridad de Base de Datos - Protección contra IA

## ⚠️ IMPORTANTE: Reglas de Seguridad

Este documento establece reglas **OBLIGATORIAS** para proteger tu base de datos de comandos destructivos de la IA.

---

## 📚 ¿Qué es Drizzle ORM? (Explicación Simple)

**Drizzle ORM** es una herramienta similar a **Prisma** (que es lo que TÚ usas).

### Comparación Simple:

| Característica | Prisma (Lo que usas) | Drizzle ORM |
|----------------|---------------------|-------------|
| **¿Qué es?** | Herramienta para trabajar con bases de datos | Herramienta para trabajar con bases de datos |
| **Lenguaje** | TypeScript/JavaScript | TypeScript/JavaScript |
| **Base de datos** | PostgreSQL, MySQL, etc. | PostgreSQL, MySQL, etc. |
| **Diferencia** | Más fácil de usar, más popular | Más ligero, más control |

**En resumen**: Son dos herramientas que hacen lo mismo (conectar tu código con la base de datos), pero con estilos diferentes. Tu proyecto usa **Prisma**, así que no necesitas Drizzle.

---

## 🛡️ MEDIDAS DE SEGURIDAD CRÍTICAS

### 1. **NUNCA permitir comandos destructivos sin confirmación**

#### ❌ COMANDOS PROHIBIDOS (La IA NO debe ejecutarlos automáticamente):

```bash
# NUNCA ejecutar estos sin tu autorización explícita:
DROP DATABASE
DROP TABLE
TRUNCATE TABLE
DELETE FROM (sin WHERE específico)
ALTER TABLE DROP COLUMN
DROP SCHEMA
```

#### ✅ COMANDOS PERMITIDOS (Solo lectura o creación):

```bash
# Estos son seguros:
SELECT (consultas de lectura)
CREATE TABLE (crear nuevas tablas)
ALTER TABLE ADD COLUMN (agregar columnas)
INSERT INTO (agregar datos nuevos)
UPDATE (con WHERE específico y confirmación)
```

---

### 2. **Sistema de Backups Automáticos**

#### Crear script de backup diario:

```bash
# scripts/backup-db.sh (o .bat en Windows)
#!/bin/bash
# Backup diario de la base de datos Neon

# Obtener fecha
DATE=$(date +%Y%m%d_%H%M%S)

# Crear backup usando pg_dump
pg_dump $DATABASE_URL > backups/backup_$DATE.sql

# Mantener solo los últimos 7 backups
ls -t backups/backup_*.sql | tail -n +8 | xargs rm -f

echo "Backup creado: backup_$DATE.sql"
```

#### Configurar en Neon Dashboard:

1. Ve a tu proyecto en [Neon.tech](https://neon.tech)
2. Ve a **Settings** → **Backups**
3. Activa **Point-in-time recovery** (si está disponible)
4. Configura backups automáticos diarios

---

### 3. **Variables de Entorno Protegidas**

#### NUNCA compartir estas variables:

```env
# .env (NUNCA subir a GitHub)
DATABASE_URL="postgresql://..."  # ⚠️ SECRETO
DIRECT_URL="postgresql://..."    # ⚠️ SECRETO
```

#### Crear `.env.example` (sin valores reales):

```env
# .env.example (SÍ se puede subir a GitHub)
DATABASE_URL="postgresql://usuario:password@host/database"
DIRECT_URL="postgresql://usuario:password@host/database"
```

#### Agregar a `.gitignore`:

```gitignore
# .gitignore
.env
.env.local
.env.production
backups/
*.sql
```

---

### 4. **Reglas para Cursor/IA**

#### Crear archivo de reglas: `.cursor/rules/seguridad-db.md`

```markdown
# REGLAS DE SEGURIDAD - BASE DE DATOS

## ⚠️ PROHIBICIONES ABSOLUTAS

1. **NUNCA ejecutar comandos DROP sin confirmación explícita del usuario**
2. **NUNCA ejecutar TRUNCATE sin confirmación explícita**
3. **NUNCA ejecutar DELETE sin WHERE específico y confirmación**
4. **NUNCA modificar el archivo .env sin preguntar primero**
5. **NUNCA ejecutar migraciones destructivas sin backup previo**

## ✅ PROTOCOLO OBLIGATORIO

Antes de ejecutar CUALQUIER comando que modifique datos:

1. **Mostrar el comando SQL que se va a ejecutar**
2. **Explicar qué va a hacer**
3. **Preguntar explícitamente: "¿Estás seguro de ejecutar esto?"**
4. **Esperar confirmación del usuario**
5. **Solo entonces ejecutar**

## 📋 COMANDOS SEGUROS (Siempre permitidos)

- SELECT (solo lectura)
- CREATE TABLE (crear nuevas tablas)
- ALTER TABLE ADD COLUMN (agregar columnas)
- INSERT INTO (agregar datos nuevos)

## 🚨 COMANDOS QUE REQUIEREN CONFIRMACIÓN

- DROP TABLE
- DROP COLUMN
- TRUNCATE
- DELETE (sin WHERE específico)
- UPDATE (masivo)
- ALTER TABLE (modificaciones destructivas)

## 💾 BACKUP ANTES DE CAMBIOS IMPORTANTES

Antes de ejecutar migraciones o cambios importantes:
1. Crear backup automático
2. Mostrar mensaje: "Backup creado en backups/backup_YYYYMMDD.sql"
3. Proceder con el cambio
```

---

### 5. **Configuración de Prisma con Protecciones**

#### Modificar `lib/prisma.ts` para agregar validaciones:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Función para validar que no se ejecuten comandos destructivos
function validateQuery(query: string) {
  const dangerousPatterns = [
    /DROP\s+(DATABASE|TABLE|SCHEMA)/i,
    /TRUNCATE/i,
    /DELETE\s+FROM\s+\w+\s*(?!WHERE)/i, // DELETE sin WHERE
  ]
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(query)) {
      throw new Error(`⚠️ COMANDO PELIGROSO DETECTADO: ${query}`)
    }
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    // Agregar middleware de seguridad
    errorFormat: 'pretty',
  })

// Middleware para interceptar queries peligrosas
prisma.$use(async (params, next) => {
  // Validar queries peligrosas
  if (params.action === 'deleteMany' && !params.args.where) {
    throw new Error('⚠️ DELETE sin WHERE no permitido. Usa deleteMany con where específico.')
  }
  
  if (params.action === 'updateMany' && !params.args.where) {
    throw new Error('⚠️ UPDATE sin WHERE no permitido. Usa updateMany con where específico.')
  }
  
  return next(params)
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

---

### 6. **Scripts de Seguridad**

#### Crear `scripts/check-db-safety.ts`:

```typescript
// scripts/check-db-safety.ts
// Script para verificar seguridad antes de ejecutar migraciones

import { readFileSync } from 'fs'
import { join } from 'path'

const migrationFile = process.argv[2]

if (!migrationFile) {
  console.error('❌ Debes especificar un archivo de migración')
  process.exit(1)
}

const content = readFileSync(join(process.cwd(), migrationFile), 'utf-8')

const dangerousPatterns = [
  { pattern: /DROP\s+(DATABASE|TABLE|SCHEMA)/i, name: 'DROP DATABASE/TABLE/SCHEMA' },
  { pattern: /TRUNCATE/i, name: 'TRUNCATE' },
  { pattern: /DELETE\s+FROM/i, name: 'DELETE' },
]

let hasDangerous = false

for (const { pattern, name } of dangerousPatterns) {
  if (pattern.test(content)) {
    console.error(`⚠️ COMANDO PELIGROSO DETECTADO: ${name}`)
    hasDangerous = true
  }
}

if (hasDangerous) {
  console.error('❌ La migración contiene comandos peligrosos. Revisa antes de ejecutar.')
  process.exit(1)
} else {
  console.log('✅ La migración parece segura.')
}
```

---

### 7. **Checklist Antes de Ejecutar Comandos de IA**

#### ✅ Siempre verificar:

- [ ] ¿El comando modifica datos existentes?
- [ ] ¿Hay un backup reciente?
- [ ] ¿Entiendo exactamente qué va a hacer?
- [ ] ¿Puedo revertir el cambio si algo sale mal?
- [ ] ¿Estoy en el ambiente correcto? (dev vs producción)

#### 🚨 Señales de peligro:

- La IA quiere ejecutar `DROP` algo
- La IA quiere ejecutar `TRUNCATE`
- La IA quiere ejecutar `DELETE` sin `WHERE`
- La IA quiere modificar `.env`
- La IA quiere ejecutar migraciones sin mostrarte el SQL primero

---

### 8. **Configuración de Neon para Protección**

#### En Neon Dashboard:

1. **Activar Point-in-Time Recovery**:
   - Ve a Settings → Backups
   - Activa si está disponible
   - Te permite restaurar a cualquier momento

2. **Crear Branch de Desarrollo**:
   - Crea un branch separado para pruebas
   - Ejecuta comandos peligrosos solo en el branch de prueba
   - Si funciona, promueve a producción

3. **Limitar Permisos**:
   - Usa un usuario con permisos limitados para desarrollo
   - Solo el usuario admin puede hacer DROP/TRUNCATE

---

## 📝 Comandos Seguros para tu Proyecto

### ✅ Comandos que puedes ejecutar sin miedo:

```bash
# Generar cliente de Prisma (solo código, no toca DB)
pnpm db:generate

# Ver datos (solo lectura)
pnpm db:studio

# Crear nuevas tablas (seguro)
pnpm db:push

# Agregar datos nuevos (seguro)
pnpm db:seed
```

### ⚠️ Comandos que requieren cuidado:

```bash
# Migraciones (revisar SQL primero)
prisma migrate dev

# Resetear base de datos (SOLO en desarrollo)
prisma migrate reset  # ⚠️ BORRA TODO
```

---

## 🆘 Plan de Recuperación si Algo Sale Mal

### Si la IA ejecutó algo destructivo:

1. **NO ENTRES EN PÁNICO**
2. **Detén cualquier proceso en ejecución**
3. **Ve a Neon Dashboard** → **Backups**
4. **Restaura desde el backup más reciente**
5. **Verifica que los datos estén correctos**

### Comandos de emergencia:

```bash
# Ver backups disponibles en Neon
# (Debes hacerlo desde el dashboard de Neon)

# Restaurar desde backup local
psql $DATABASE_URL < backups/backup_YYYYMMDD.sql
```

---

## ✅ Resumen de Protecciones

1. ✅ **Backups automáticos** configurados
2. ✅ **Reglas para IA** en `.cursor/rules/`
3. ✅ **Validaciones en código** (middleware de Prisma)
4. ✅ **Variables de entorno** protegidas
5. ✅ **Checklist** antes de ejecutar comandos
6. ✅ **Point-in-time recovery** en Neon (si disponible)

---

## 📞 Contacto de Emergencia

Si algo sale mal:
1. Ve a [Neon Dashboard](https://console.neon.tech)
2. Ve a **Support** → **Create Ticket**
3. Explica qué pasó y cuándo
4. Pueden ayudarte a restaurar desde backups

---

**Recuerda**: Es mejor ser cauteloso y preguntar dos veces que perder datos. 🛡️

