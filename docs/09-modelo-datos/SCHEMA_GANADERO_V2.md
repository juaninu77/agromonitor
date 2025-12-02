# 🐄 Schema Ganadero v2 - Documentación

## Resumen del Modelo

Este schema implementa un modelo ganadero completo con:

- ✅ **Event Sourcing** - Historial completo de cada acción
- ✅ **Catálogos normalizados** - Razas, categorías, estados
- ✅ **Ciclo reproductivo completo** - Servicio → Tacto → Parto → Destete
- ✅ **Alimentación híbrida** - Por lote con excepciones individuales
- ✅ **Soporte RFID** - Identificación electrónica
- ✅ **Soporte Cabaña** - DEPs y valores genéticos
- ✅ **Multi-tenancy** - Ya implementado

---

## Estructura de Entidades

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORGANIZACIÓN                              │
│  (Multi-tenant: cada organización tiene sus propios datos)      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   CATÁLOGOS  │    │   MAESTROS   │    │   TERCEROS   │       │
│  ├──────────────┤    ├──────────────┤    ├──────────────┤       │
│  │ • Raza       │    │ • Campo      │    │ • Proveedor  │       │
│  │ • Categoria  │    │ • Potrero    │    │ • Cliente    │       │
│  │ • EstadoFis  │    │ • Corral     │    │              │       │
│  │ • CausaBaja  │    │ • Rodeo      │    │              │       │
│  │ • MotivoMov  │    │              │    │              │       │
│  │ • Producto   │    │              │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      ANIMALES                             │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  BOVINO                           OVINO                   │   │
│  │  ────────                         ─────                   │   │
│  │  • Identificación múltiple        • IDV + RFID            │   │
│  │  • Genealogía completa            • Categorías            │   │
│  │  • Estado reproductivo            • Estado físico         │   │
│  │  • Snapshots (peso, CC)           • Snapshots             │   │
│  │  • Valores genéticos              │                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      EVENTOS                              │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  • EventoPesada      • EventoServicio    • EventoDestete │   │
│  │  • EventoSanidad     • EventoTacto       • EventoVentaBaja│   │
│  │  • EventoMovimiento  • EventoParto       • EventoAliment │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Identificación del Animal (Bovino)

```
┌─────────────────────────────────────────────────────────────┐
│                    IDENTIFICACIÓN                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  CUIG: "076.123.0.12345/00"     ← Oficial SENASA            │
│  Caravana Visual: "1234"        ← Número visible            │
│  Caravana RFID: "982000123456"  ← Chip electrónico          │
│  Número Interno: "V-234"        ← Tu numeración             │
│  Marca Fuego: "ABC"             ← Si la usás                │
│  Nombre/Apodo: "La Negra"       ← Para reproductores        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Ciclo Reproductivo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                CICLO REPRODUCTIVO                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TORADA (Temporada de servicio)                              │
│  ├── Fecha inicio/fin                                        │
│  ├── Tipo: natural / IA / mixto                             │
│  └── Rodeo asignado                                          │
│         │                                                    │
│         ▼                                                    │
│  SERVICIO (EventoServicio)                                   │
│  ├── Hembra + Macho/Semen                                   │
│  ├── Fecha servicio                                          │
│  ├── Tipo: natural / IA / IATF                              │
│  └── Datos del toro/semen                                   │
│         │                                                    │
│         ▼  (60-90 días después)                             │
│  TACTO (EventoTacto)                                        │
│  ├── Resultado: preñada / vacía / dudosa                    │
│  ├── Meses de gestación                                      │
│  └── Fecha probable parto                                    │
│         │                                                    │
│         ▼  (9 meses desde servicio)                         │
│  PARTO (EventoParto)                                        │
│  ├── Tipo: normal / asistido / cesárea                      │
│  ├── Dificultad: 1-5                                        │
│  ├── Peso cría                                               │
│  ├── Nacido vivo: sí/no                                     │
│  └── → Crea nuevo Animal (la cría)                          │
│         │                                                    │
│         ▼  (6-8 meses después)                              │
│  DESTETE (EventoDestete)                                    │
│  ├── Peso al destete                                        │
│  ├── Edad en días                                           │
│  └── Método: tradicional / precoz / hiperprecoz             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Alimentación Híbrida

```
┌─────────────────────────────────────────────────────────────┐
│                    ALIMENTACIÓN                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  DIETA (Receta)                                              │
│  ├── Nombre: "Engorde Intensivo"                            │
│  ├── Objetivo: engorde                                       │
│  ├── MS objetivo: 12 kg/día                                  │
│  ├── Proteína: 14%                                          │
│  └── Componentes:                                            │
│      ├── Maíz molido: 40%                                   │
│      ├── Expeller soja: 20%                                 │
│      ├── Heno alfalfa: 35%                                  │
│      └── Núcleo vitamínico: 5%                              │
│                                                              │
│  PLAN ALIMENTACIÓN (Asignación)                             │
│  ├── Rodeo: "Engorde Lote 1"                                │
│  ├── Dieta: "Engorde Intensivo"                             │
│  ├── Fecha inicio/fin                                        │
│  └── MS día planificado: 11 kg/animal                       │
│                                                              │
│  EVENTO ALIMENTACIÓN (Registro diario)                      │
│  ├── Fecha: 2024-12-01                                      │
│  ├── Rodeo: "Engorde Lote 1"                                │
│  ├── Animales: 45                                            │
│  ├── kg MS Total: 500 kg                                    │
│  ├── kg MS/animal: 11.1 kg                                  │
│  └── Desvío: +1% vs plan                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Snapshots vs Eventos

### ¿Por qué ambos?

| Dato | Snapshot (en Animal) | Evento (tabla separada) |
|------|---------------------|------------------------|
| **Peso** | `pesoActual` | `EventoPesada` |
| **CC** | `ccActual` | En `EventoPesada` |
| **Ubicación** | `potreroId` | `EventoMovimiento` |
| **Sanidad** | `estadoSanitario` | `EventoSanidad` |

**Razón:**
- **Snapshot**: Para queries rápidas ("¿cuántos animales pesan más de 400kg?")
- **Evento**: Para historial completo ("¿cómo evolucionó el peso de este animal?")

### Actualización automática

Cuando se crea un evento, se actualiza el snapshot:

```
EventoPesada(peso: 450, cc: 6) 
   ↓ Trigger
Bovino.pesoActual = 450
Bovino.fechaUltimoPeso = hoy
Bovino.ccActual = 6
```

---

## Archivo del Schema

El schema completo está en:

```
prisma/schema-ganadero-v2.prisma
```

### Para probarlo:

```bash
# Ver diferencias con el schema actual
npx prisma format --schema=prisma/schema-ganadero-v2.prisma

# Cuando esté listo para migrar:
# 1. Respaldar schema actual
cp prisma/schema.prisma prisma/schema-backup.prisma

# 2. Reemplazar
cp prisma/schema-ganadero-v2.prisma prisma/schema.prisma

# 3. Generar migración
npx prisma migrate dev --name "modelo_ganadero_v2"
```

---

## Próximos Pasos

1. **Revisar** el schema y confirmar que está correcto
2. **Crear seed** con catálogos base (razas, categorías)
3. **Migrar** datos existentes al nuevo modelo
4. **Actualizar** APIs para usar los nuevos modelos
5. **Actualizar** UI para mostrar los nuevos campos

---

*Creado: Diciembre 2025*
*Proyecto: AgroMonitor ERP*

