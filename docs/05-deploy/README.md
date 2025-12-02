# 🚀 05 - Deploy

Documentación sobre despliegue en producción.

## 📄 Documentos

| Documento | Descripción |
|-----------|-------------|
| [GUIA_VERCEL_NEON_PASO_A_PASO.md](./GUIA_VERCEL_NEON_PASO_A_PASO.md) | Deploy completo |

## 🏗️ Stack de Producción

| Servicio | Uso |
|----------|-----|
| **Vercel** | Hosting de la aplicación Next.js |
| **Neon** | Base de datos PostgreSQL serverless |
| **GitHub Actions** | CI/CD automático |

## 📋 Checklist de Deploy

- [ ] Variables de entorno configuradas en Vercel
- [ ] Base de datos de producción en Neon (branch `main`)
- [ ] Secrets de GitHub configurados
- [ ] Dominio configurado (opcional)

## ⚡ Comandos

```bash
pnpm build          # Build de producción
pnpm db:migrate:deploy  # Aplicar migraciones
```

---

[← Volver al índice](../README.md)

