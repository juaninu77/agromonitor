# ⚙️ 02 - Ambientes (Dev/Test/Prod)

Configuración de ambientes de desarrollo, testing y producción.

## 📄 Documentos

| Documento | Descripción |
|-----------|-------------|
| [CONFIGURACION_AMBIENTES_COMPLETA.md](./CONFIGURACION_AMBIENTES_COMPLETA.md) | ⭐ **Guía maestra** - Todo sobre ambientes |
| [CREAR_BRANCHES_NEON.md](./CREAR_BRANCHES_NEON.md) | Tutorial visual para Neon |
| [GUIA_AMBIENTES.md](./GUIA_AMBIENTES.md) | Referencia técnica |

## 🎯 Resumen de Ambientes

| Ambiente | BD Branch | Uso |
|----------|-----------|-----|
| `development` | `develop` | Desarrollo local |
| `test` | `test` | Tests automáticos |
| `production` | `main` | Usuarios reales |

## ⚡ Comandos Clave

```bash
pnpm env:setup      # Configurar ambientes
pnpm env:check      # Verificar configuración
pnpm db:push:dev    # Sync BD desarrollo
pnpm db:push:test   # Sync BD testing
```

---

[← Volver al índice](../README.md)

