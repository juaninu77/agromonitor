# 🔒 REGLAS DE SEGURIDAD - BASE DE DATOS

## ⚠️ PROHIBICIONES ABSOLUTAS PARA LA IA

**NUNCA ejecutar estos comandos sin confirmación EXPLÍCITA del usuario:**

1. ❌ `DROP DATABASE`
2. ❌ `DROP TABLE`
3. ❌ `DROP SCHEMA`
4. ❌ `TRUNCATE TABLE`
5. ❌ `DELETE FROM tabla` (sin WHERE específico)
6. ❌ `ALTER TABLE DROP COLUMN`
7. ❌ `prisma migrate reset` (sin confirmación)
8. ❌ Modificar archivo `.env` sin preguntar
9. ❌ Ejecutar migraciones destructivas sin backup

---

## ✅ PROTOCOLO OBLIGATORIO ANTES DE EJECUTAR

**Antes de ejecutar CUALQUIER comando que modifique la base de datos:**

1. **Mostrar el comando SQL/Prisma que se va a ejecutar**
2. **Explicar claramente qué va a hacer**
3. **Preguntar explícitamente**: "¿Estás seguro de ejecutar esto? (Sí/No)"
4. **Esperar confirmación explícita del usuario**
5. **Solo entonces ejecutar**

---

## 📋 COMANDOS SEGUROS (Siempre permitidos sin confirmación)

- ✅ `SELECT` (consultas de solo lectura)
- ✅ `CREATE TABLE` (crear nuevas tablas)
- ✅ `ALTER TABLE ADD COLUMN` (agregar columnas nuevas)
- ✅ `INSERT INTO` (agregar datos nuevos)
- ✅ `prisma generate` (generar cliente, no toca DB)
- ✅ `prisma studio` (solo visualización)

---

## 🚨 COMANDOS QUE REQUIEREN CONFIRMACIÓN EXPLÍCITA

**Antes de ejecutar, DEBES:**

1. Mostrar el comando completo
2. Explicar qué hará
3. Preguntar: "¿Estás seguro? Esto modificará/eliminará datos."

### Lista de comandos que requieren confirmación:

- `DROP TABLE`
- `DROP COLUMN`
- `TRUNCATE`
- `DELETE` (sin WHERE específico o con WHERE amplio)
- `UPDATE` (masivo, sin WHERE específico)
- `ALTER TABLE` (modificaciones destructivas)
- `prisma migrate reset`
- `prisma db push --force-reset`
- Cualquier comando que contenga `DROP`, `TRUNCATE`, o `DELETE` sin WHERE

---

## 💾 PROTOCOLO DE BACKUP

**Antes de ejecutar migraciones o cambios importantes:**

1. **Crear backup automático**:
   ```bash
   # Mostrar al usuario cómo crear backup
   pg_dump $DATABASE_URL > backups/backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Confirmar que el backup se creó**:
   ```
   ✅ Backup creado en backups/backup_YYYYMMDD_HHMMSS.sql
   ```

3. **Solo entonces proceder con el cambio**

---

## 🔍 VALIDACIONES OBLIGATORIAS

**Antes de ejecutar cualquier comando SQL/Prisma:**

1. ✅ Verificar que no contenga palabras peligrosas sin confirmación
2. ✅ Verificar que tenga WHERE específico si es DELETE/UPDATE
3. ✅ Verificar que el usuario entiende qué va a pasar
4. ✅ Verificar que hay backup si es un cambio importante

---

## 📝 EJEMPLOS DE COMUNICACIÓN CORRECTA

### ✅ Ejemplo CORRECTO:

```
Usuario: "Elimina la tabla de prueba"

IA: 
⚠️ ATENCIÓN: Voy a ejecutar un comando destructivo.

Comando que se ejecutará:
DROP TABLE prueba;

⚠️ ESTO ELIMINARÁ PERMANENTEMENTE la tabla "prueba" y todos sus datos.

¿Estás completamente seguro de que quieres ejecutar esto? 
Responde "SÍ, eliminar" para confirmar, o "NO" para cancelar.
```

### ❌ Ejemplo INCORRECTO:

```
Usuario: "Elimina la tabla de prueba"

IA: [Ejecuta directamente DROP TABLE prueba] ❌ MALO
```

---

## 🛡️ PROTECCIONES ADICIONALES

**Si el usuario pide algo peligroso:**

1. **Explicar el riesgo** claramente
2. **Sugerir alternativas más seguras**:
   - En lugar de DROP TABLE → Renombrar la tabla primero
   - En lugar de DELETE sin WHERE → Mostrar cuántos registros se eliminarían
   - En lugar de TRUNCATE → Usar DELETE con WHERE específico

3. **Ofrecer crear backup primero**

---

## 📋 CHECKLIST ANTES DE EJECUTAR

**Siempre verificar:**

- [ ] ¿El comando modifica o elimina datos existentes?
- [ ] ¿Hay un backup reciente disponible?
- [ ] ¿El usuario entiende exactamente qué va a pasar?
- [ ] ¿Puedo revertir el cambio si algo sale mal?
- [ ] ¿Estoy en el ambiente correcto? (dev vs producción)

**Si alguna respuesta es NO o INCIERTA → NO EJECUTAR sin confirmación explícita**

---

## 🚨 SEÑALES DE PELIGRO

**Si detectas estas señales, DETENTE y pregunta:**

- El usuario pide "eliminar", "borrar", "resetear", "limpiar"
- El comando contiene `DROP`, `TRUNCATE`, `DELETE` sin WHERE
- El usuario quiere modificar `.env` o credenciales
- El usuario quiere ejecutar migraciones sin ver el SQL primero
- El usuario parece confundido sobre qué va a pasar

---

## ✅ REGLA DE ORO

**"Es mejor preguntar dos veces y ser cauteloso, que ejecutar algo destructivo y perder datos."**

Cuando tengas dudas, SIEMPRE pregunta primero. El usuario preferirá confirmar dos veces antes que perder información importante.

---

## 📞 EN CASO DE EMERGENCIA

Si accidentalmente ejecutaste algo destructivo:

1. **Detén cualquier proceso en ejecución inmediatamente**
2. **Informa al usuario** qué pasó exactamente
3. **Guía al usuario** para restaurar desde backup:
   - Ve a Neon Dashboard → Backups
   - Restaura desde el backup más reciente
   - Verifica que los datos estén correctos

---

**Recuerda**: Tu trabajo es ayudar, no causar problemas. La seguridad de los datos es PRIORITARIA sobre la velocidad de ejecución.

