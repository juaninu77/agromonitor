# AgroMonitor ERP

Sistema ERP completo para la gestión integral de emprendimientos agropecuarios.

## Descripción

AgroMonitor es una plataforma web moderna diseñada para facilitar la administración de operaciones agropecuarias, incluyendo:

- 🐄 **Gestión de Ganado:** Control de inventario, salud, reproducción y trazabilidad
- 🌾 **Cultivos:** Planificación, seguimiento agronómico y rendimientos
- 💰 **Finanzas:** Ingresos, gastos, flujo de caja y análisis financiero
- 📦 **Inventario:** Stock de insumos, maquinaria y productos
- 📊 **Mercado:** Precios actuales de productos, insumos y maquinaria
- ✅ **Tareas:** Gestión de actividades diarias con tablero Kanban
- 🚜 **Flota:** Control de maquinaria y vehículos
- 📡 **IoT:** Integración con sensores y dispositivos
- 🗺️ **Mapas:** Visualización geográfica de zonas y parcelas

## Versión Actual

**Versión:** 2.0.0 (Refactorización Completa - 2025-11-11)

### Cambios Principales en v2.0.0

- ✅ Eliminación de rutas duplicadas
- ✅ Estandarización completa al español
- ✅ Utilidades centralizadas (formatters, validators, calculators, styles)
- ✅ Constantes tipadas para todos los estados
- ✅ Navegación limpia sin enlaces muertos
- ✅ Documentación completa del código
- ✅ Mejoras en accesibilidad y performance

Ver [REFACTOR_CHANGELOG.md](./REFACTOR_CHANGELOG.md) para detalles completos.

## Tecnologías

- **Framework:** Next.js 15 (App Router)
- **UI:** React 19, TypeScript, Tailwind CSS
- **Componentes:** shadcn/ui, Radix UI
- **Gráficos:** Recharts
- **Iconos:** Lucide React
- **Estilos:** Tailwind CSS con CSS Variables
- **Formularios:** React Hook Form + Zod
- **Fechas:** date-fns

## 🚀 Inicio Rápido

### Configuración de Base de Datos (Vercel + Neon)

**¿Primera vez configurando?** Sigue la guía paso a paso:

👉 **[Guía Completa: Vercel + Neon Paso a Paso](docs/GUIA_VERCEL_NEON_PASO_A_PASO.md)**

**Resumen rápido:**
1. Crea proyecto en Vercel y conecta Neon
2. Configura `.env` con las URLs de Neon
3. Ejecuta `pnpm db:generate` y `pnpm db:push`
4. Importa datos: `pnpm import:excel` y `pnpm db:seed`
5. Despliega: `git push` (Vercel despliega automáticamente)

---

## Instalación

### Prerrequisitos

- Node.js >= 18.0.0
- pnpm >= 9.0.0

### Pasos

1. Clonar el repositorio:
```bash
git clone [url-del-repositorio]
cd agromonitor
```

2. Instalar dependencias:
```bash
pnpm install
```

3. Iniciar servidor de desarrollo:
```bash
pnpm dev
```

4. Abrir navegador en [http://localhost:3000](http://localhost:3000)

## Scripts Disponibles

- `pnpm dev` - Inicia servidor de desarrollo
- `pnpm build` - Crea build de producción
- `pnpm start` - Inicia servidor de producción
- `pnpm lint` - Ejecuta ESLint
- `pnpm type-check` - Verifica tipos TypeScript

## Estructura del Proyecto

```
agromonitor/
├── app/                      # Páginas Next.js (App Router)
│   ├── ganado/              # Módulo de ganado
│   ├── cultivos/            # Módulo de cultivos
│   ├── finanzas/            # Módulo financiero
│   ├── inventario/          # Módulo de inventario
│   ├── mercado/             # Precios de mercado
│   ├── tareas/              # Gestión de tareas
│   ├── flota/               # Gestión de flota
│   ├── iot/                 # IoT y sensores
│   ├── mapa/                # Visualización de mapas
│   ├── layout.tsx           # Layout principal
│   ├── page.tsx             # Dashboard principal
│   └── globals.css          # Estilos globales
├── components/              # Componentes React
│   ├── dashboard/           # Componentes del dashboard
│   ├── layout/              # Layout y navegación
│   ├── shared/              # Componentes compartidos
│   └── ui/                  # Componentes UI base (shadcn)
├── lib/                     # Lógica y utilidades
│   ├── constants/           # Constantes y enums
│   │   └── estados.ts       # Estados tipados
│   ├── utils/               # Funciones de utilidad
│   │   ├── formatters.ts    # Formateo de datos
│   │   ├── styles.ts        # Utilidades de estilos
│   │   ├── validators.ts    # Validaciones
│   │   └── calculations.ts  # Cálculos agropecuarios
│   ├── types.ts             # Definiciones TypeScript
│   ├── mocks.ts             # Datos mock
│   └── utils.ts             # Re-exportaciones
├── public/                  # Archivos estáticos
├── docs/                    # Documentación
├── REFACTOR_CHANGELOG.md    # Registro detallado de cambios
├── README.md                # Este archivo
├── package.json             # Configuración del proyecto
├── tsconfig.json            # Configuración TypeScript
├── tailwind.config.ts       # Configuración Tailwind
└── next.config.mjs          # Configuración Next.js
```

## Módulos Principales

### 🐄 Ganado
- Registro individual de animales
- Control de peso y salud
- Seguimiento reproductivo
- Vacunaciones y tratamientos
- Trazabilidad completa

### 🌾 Cultivos
- Planificación de siembra
- Seguimiento fenológico
- Control de aplicaciones
- Análisis de rendimiento
- Gestión por lote

### 💰 Finanzas
- Registro de ingresos y egresos
- Flujo de caja
- Análisis de rentabilidad
- Reportes financieros
- Proyecciones

### 📦 Inventario
- Control de stock
- Alertas de stock mínimo
- Movimientos de inventario
- Categorización
- Valorización

### 📊 Mercado
- Precios de productos agropecuarios
- Precios de insumos
- Valores de maquinaria
- Tendencias de mercado
- Actualizaciones simuladas

### ✅ Tareas
- Tablero Kanban
- Vista de lista
- Prioridades y fechas
- Asignación de responsables
- Seguimiento de progreso

## Utilidades Disponibles

### Formatters
```typescript
import { formatCurrency, formatDate, formatUnit } from '@/lib/utils'

formatCurrency(25000) // "$25.000"
formatDate(new Date(), 'long') // "11 de noviembre de 2025"
formatUnit(450, 'kg') // "450 kg"
```

### Validators
```typescript
import { isValidEmail, isValidPeso, isValidCuit } from '@/lib/utils'

isValidEmail("usuario@example.com") // true
isValidPeso(450, 'vacuno') // true
isValidCuit("20-12345678-9") // valida con dígito verificador
```

### Calculations
```typescript
import { calcularGDP, calcularRendimiento, calcularEdad } from '@/lib/utils'

calcularGDP(200, 250, 50) // 1 kg/día
calcularRendimiento(10000, 10) // 1000 kg/ha
calcularEdad(new Date('2020-01-01')) // edad en años
```

### Styles
```typescript
import { getEstadoSaludColor, getPrioridadBadge } from '@/lib/utils'

getEstadoSaludColor("Saludable") // "text-status-ok"
getPrioridadBadge("Alta") // "bg-red-100 text-red-800 border-red-200"
```

## Convenciones de Código

### Naming
- **Archivos:** kebab-case (ej: `ganado-data.ts`)
- **Componentes:** PascalCase (ej: `AnimalCard`)
- **Funciones:** camelCase (ej: `calcularPromedio`)
- **Constantes:** UPPER_SNAKE_CASE (ej: `ESTADOS_SALUD`)
- **Types/Interfaces:** PascalCase (ej: `AnimalFormData`)

### Imports
```typescript
// 1. React
import { useState, useEffect } from 'react'

// 2. Next.js
import Link from 'next/link'

// 3. Third party
import { zodResolver } from '@hookform/resolvers/zod'

// 4. Components
import { Button } from '@/components/ui/button'

// 5. Lib
import { formatCurrency } from '@/lib/utils'

// 6. Types
import type { AnimalIndividual } from '@/lib/types'
```

### Comentarios
- JSDoc para funciones exportadas
- Comentarios inline para lógica compleja
- TODO/FIXME para items pendientes

## Rutas Disponibles

| Ruta | Descripción |
|------|-------------|
| `/` | Dashboard principal |
| `/ganado` | Gestión de ganado |
| `/cultivos` | Gestión de cultivos |
| `/finanzas` | Módulo financiero |
| `/inventario` | Control de inventario |
| `/mercado` | Precios de mercado |
| `/tareas` | Gestión de tareas |
| `/flota` | Gestión de flota |
| `/iot` | IoT y sensores |
| `/mapa` | Visualización de mapas |

## Contribuir

### Agregar un Nuevo Módulo

1. Crear carpeta en `app/nombre-modulo/`
2. Crear `page.tsx` con el componente principal
3. Agregar ruta en `lib/mocks.ts` → `navItems`
4. Crear tipos específicos si es necesario
5. Crear datos mock si es necesario
6. Documentar en este README

### Agregar Utilidades

1. Agregar función en el archivo correspondiente en `lib/utils/`
2. Documentar con JSDoc
3. Exportar desde `lib/utils.ts`
4. Agregar ejemplos en este README

## Licencia

Privado - Todos los derechos reservados

## Contacto

**AgroMonitor Team**

Para consultas, sugerencias o reportar problemas, crear un issue en el repositorio.

---

**Última actualización:** 2025-11-11
**Versión:** 2.0.0
