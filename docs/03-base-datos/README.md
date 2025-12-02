# 🗄️ 03 - Base de Datos

Documentación sobre PostgreSQL, Prisma y estructura de datos.

## 📄 Documentos

| Documento | Descripción |
|-----------|-------------|
| [DATABASE_STRUCTURE.md](./DATABASE_STRUCTURE.md) | Estructura del schema |
| [PLAN_MIGRACION_SCHEMA_UNIFICADO.md](./PLAN_MIGRACION_SCHEMA_UNIFICADO.md) | Plan de migración |
| [PRUEBAS_PROTECCIONES.md](./PRUEBAS_PROTECCIONES.md) | Testing de BD |
| [SEGURIDAD_BASE_DATOS.md](./SEGURIDAD_BASE_DATOS.md) | Guía de seguridad |

## 📊 Schema Principal

```
prisma/
├── schema.prisma           # Schema activo
├── schema-multi-tenant.prisma  # Con multi-tenancy
└── seed.ts                 # Datos de prueba
```

## ⚡ Comandos Clave

```bash
pnpm db:generate    # Generar Prisma Client
pnpm db:push        # Sincronizar schema
pnpm db:studio      # Abrir Prisma Studio
pnpm db:seed        # Cargar datos de prueba
```

---

[← Volver al índice](../README.md)

