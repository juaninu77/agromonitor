# 🏗️ 08 - Arquitectura

Documentación sobre el diseño y arquitectura del sistema.

## 📄 Documentos

| Documento | Descripción |
|-----------|-------------|
| [EVALUACION_PROYECTO_MULTI_TENANT.md](./EVALUACION_PROYECTO_MULTI_TENANT.md) | Roadmap multi-tenant |

## 🎯 Arquitectura Multi-Tenant

```
┌─────────────────────────────────────────┐
│              APLICACIÓN                  │
├─────────────────────────────────────────┤
│                                          │
│   Usuario → Organización → Campo(s)     │
│                                          │
│   Cada Campo tiene:                     │
│   - Bovinos                             │
│   - Ovinos                              │
│   - Cultivos                            │
│   - Registros sanitarios                │
│   - Stock de alimentos                  │
│                                          │
└─────────────────────────────────────────┘
```

## 📊 Modelos Principales

| Modelo | Descripción |
|--------|-------------|
| `Usuario` | Cuenta de usuario |
| `Organizacion` | Empresa/establecimiento |
| `Membresia` | Relación usuario-organización |
| `Campo` | Unidad productiva |
| `Bovino/Ovino` | Ganado |

---

[← Volver al índice](../README.md)

