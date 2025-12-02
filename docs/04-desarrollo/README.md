# 💻 04 - Desarrollo

Documentación para desarrolladores: APIs, ORM y patrones.

## 📄 Documentos

| Documento | Descripción |
|-----------|-------------|
| [EJEMPLOS_API.md](./EJEMPLOS_API.md) | Ejemplos de uso de las APIs |
| [EXPLICACION_ORMS.md](./EXPLICACION_ORMS.md) | Prisma y ORMs explicados |

## 🔗 APIs Disponibles

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/bovinos` | GET/POST | Gestión de bovinos |
| `/api/ovinos` | GET/POST | Gestión de ovinos |
| `/api/organizaciones` | GET | Organizaciones del usuario |
| `/api/auth/register` | POST | Registro de usuarios |

## 📁 Estructura de APIs

```
app/api/
├── auth/
│   ├── [...nextauth]/route.ts
│   └── register/route.ts
├── bovinos/
│   └── route.ts
├── organizaciones/
│   └── route.ts
└── ...
```

---

[← Volver al índice](../README.md)

