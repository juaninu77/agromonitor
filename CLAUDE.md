# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AgroMonitor is a comprehensive ERP system for managing agricultural operations, built with Next.js 15, React 19, TypeScript, Prisma, and PostgreSQL. The system is entirely in Spanish and follows a multi-tenant architecture with role-based access control (RBAC).

**Version:** 2.0.0 (Complete refactor - Nov 2025)

## Common Commands

### Development
```bash
pnpm dev                # Start development server on localhost:3000
pnpm dev:test           # Start dev server with NODE_ENV=test
pnpm build              # Production build (includes prisma generate)
pnpm start              # Start production server
pnpm lint               # Run ESLint
pnpm type-check         # TypeScript type checking
```

### Testing
```bash
pnpm test               # Run tests with Vitest
pnpm test:ci            # Run tests in CI mode (no watch)
```

### Database
```bash
pnpm db:generate        # Generate Prisma Client
pnpm db:push            # Push schema changes to database
pnpm db:push:dev        # Push using .env.development
pnpm db:push:test       # Push using .env.test
pnpm db:seed            # Seed database with test data
pnpm db:seed:dev        # Seed using .env.development
pnpm db:studio          # Open Prisma Studio
pnpm db:reset:test      # Reset test database and reseed
pnpm import:excel       # Import data from Excel files
```

### Environment
```bash
pnpm env:check          # Validate environment variables
pnpm env:setup          # Setup environment files
```

## High-Level Architecture

### Multi-Tenant Structure

The application uses a multi-tenant architecture where:
- **Organizacion** (Organization) is the top-level entity
- **Membresia** (Membership) links Users to Organizations with specific roles
- **Establecimiento** (Farm/Ranch) belongs to an Organization
- All data is scoped to Organizations via foreign keys

### Authentication & Authorization

- **NextAuth v5** with JWT-based sessions
- Auto-repair mechanism for corrupted JWT tokens (see `auth.config.ts`)
- Protected routes via middleware in `auth.config.ts`
- Role hierarchy: `admin` > `encargado` > `vet` > `operario`
- Session data includes: `user.id`, `user.email`, `user.nombre`, `user.apellido`, `user.rol`

### Database Architecture (Event Sourcing Hybrid)

The Prisma schema (`prisma/schema.prisma`) implements a **hybrid event-sourcing model**:

**Core Entities:**
- `Animal` - Individual animal records with basic attributes
- `Lote` (Herd/Group) - Groups of animals for batch operations
- `Sector` - Physical locations (paddocks, corrals, feedlots, handling facilities)
- `Establecimiento` - Farm/Ranch entities

**Event Tables (evt_*):**
- `EvtPesada` - Weight measurements
- `EvtSanidad` - Health/vaccination events
- `EvtMovimiento` - Animal movements between sectors
- `EvtServicio` - Breeding services (mating, AI)
- `EvtTacto` - Pregnancy checks
- `EvtParicion` - Births
- `EvtDestete` - Weaning
- `EvtBaja` - Sales/deaths/exits
- `EvtAlimentacion` - Feeding events
- `EvtPastoreo` - Grazing events

**Key Architectural Decisions:**
1. Animal state is **derived from events**, not stored redundantly
2. Events can apply to individual animals OR entire lotes (batch operations)
3. `AnimalAttr` table provides EAV (Entity-Attribute-Value) extensibility
4. `UbicacionHist` and `AnimalLoteHist` track temporal state changes
5. Genealogy is separate (`Genealogia` table) with support for external parents

### API Routes Structure

API routes follow a RESTful pattern under `/api`:
- `/api/auth/*` - NextAuth endpoints
- `/api/ganado/bovinos` - Cattle/livestock management
- `/api/organizaciones` - Organization CRUD
- `/api/establecimientos` - Farm/ranch management
- `/api/razas` - Breed catalog
- `/api/categorias` - Category catalog (age/sex groups)
- `/api/tareas` - Task management
- `/api/notificaciones` - Notifications
- `/api/manga` - Livestock handling sessions (RFID reading)

**API Patterns:**
- All routes require authentication (check `session?.user?.id`)
- Use `prisma` client imported from `@/lib/prisma`
- Support pagination via `page` and `limit` query params
- Support filtering via query parameters
- Return `{ error: "..." }` with appropriate status codes

### App Router Structure

The app uses Next.js App Router with route groups:
- `/app/(app)/*` - Authenticated pages (wrapped in AppShell layout)
- `/app/(auth)/*` - Authentication pages (login, register)

**Main Modules:**
- `/ganado` - Livestock management
- `/cultivos` - Crop management
- `/finanzas` - Financial management
- `/inventario` - Inventory management
- `/tareas` - Task management (Kanban board)
- `/flota` - Fleet/machinery management
- `/mercado` - Market prices
- `/mapa` - Geographic visualization
- `/iot` - IoT sensor integration
- `/manga` - Livestock handling workspace (RFID)
- `/configuracion` - Settings and catalogs

### Layout & UI Components

**AppShell Pattern:**
- `components/layout/app-shell.tsx` - Main layout with resizable sidebar
- Uses `react-resizable-panels` for collapsible sidebar
- Sidebar state persisted in cookies
- `components/layout/ticker.tsx` - Top ticker bar for alerts
- `components/configuracion/onboarding-guard.tsx` - Ensures org setup

**UI Library:**
- All base components in `components/ui/*` (shadcn/ui)
- Custom components in module-specific folders
- Icons from `lucide-react`
- Charts via `recharts`

### Centralized Utilities (`lib/utils/`)

**CRITICAL:** Always import utilities from `@/lib/utils` (re-exported):

```typescript
// ✅ CORRECT
import { formatCurrency, formatDate, getEstadoSaludColor } from '@/lib/utils'

// ❌ WRONG - Don't import directly from subdirectories
import { formatCurrency } from '@/lib/utils/formatters'
```

**Available Utilities:**
- `formatters.ts` - `formatCurrency()`, `formatDate()`, `formatUnit()`, `formatPercentage()`
- `validators.ts` - `isValidEmail()`, `isValidPeso()`, `isValidCuit()`, `isValidCUIL()`
- `calculations.ts` - `calcularGDP()`, `calcularRendimiento()`, `calcularEdad()`, `calcularIMC()`
- `styles.ts` - `getEstadoSaludColor()`, `getPrioridadBadge()`, `getEstadoTareaVariant()`

### Typed Constants (`lib/constants/estados.ts`)

Use typed constants instead of magic strings:

```typescript
import { ESTADOS_SALUD, PRIORIDADES, ESTADOS_TAREA } from '@/lib/constants/estados'

// ✅ CORRECT
const estado = ESTADOS_SALUD.SALUDABLE

// ❌ WRONG
const estado = "Saludable"
```

### Form Handling Pattern

Standard pattern for forms:
1. Define schema with `zod` in `lib/validations/`
2. Use `react-hook-form` with `zodResolver`
3. Wrap in `<Form>` component from `@/components/ui/form`
4. Use `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`

Example:
```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { animalSchema } from "@/lib/validations/animal-schema"

const form = useForm({
  resolver: zodResolver(animalSchema),
  defaultValues: { ... }
})
```

### Naming Conventions

**STRICT CONVENTIONS - Follow these exactly:**

- **Files:** `kebab-case` (e.g., `animal-dialog.tsx`, `ganado-data.ts`)
- **Components:** `PascalCase` (e.g., `AnimalCard`, `RegisterDialog`)
- **Functions:** `camelCase` (e.g., `calcularPromedio`, `validarPeso`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `ESTADOS_SALUD`, `MAX_PESO`)
- **Types/Interfaces:** `PascalCase` (e.g., `AnimalFormData`, `Usuario`)
- **API Routes:** `route.ts` (Next.js convention)
- **Database tables:** `snake_case` (Prisma maps with `@@map()`)

### Import Order

Organize imports in this exact order:

```typescript
// 1. React
import { useState, useEffect } from 'react'

// 2. Next.js
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// 3. Third-party libraries
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'

// 4. UI Components
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

// 5. Custom components
import { AnimalCard } from '@/components/ganado/animal-card'

// 6. Lib utilities
import { formatCurrency, calcularEdad } from '@/lib/utils'

// 7. Types
import type { Animal } from '@/lib/types'

// 8. Constants
import { ESTADOS_SALUD } from '@/lib/constants/estados'
```

## Critical Implementation Notes

### Database Queries

1. **Always use Prisma Client** from `@/lib/prisma`
2. **Include relations explicitly** - Don't rely on default includes
3. **Use proper indexes** - All foreign keys have indexes in schema
4. **Transaction support** - Use `prisma.$transaction()` for multi-step operations

Example:
```typescript
const animales = await prisma.animal.findMany({
  where: { especieId, estadoVital: 'activo' },
  include: {
    raza: true,
    categoria: true,
    ubicacionHist: {
      where: { hasta: null },
      include: { sector: true }
    }
  },
  orderBy: { caravanaVisual: 'asc' }
})
```

### Server vs Client Components

- **Default to Server Components** unless you need interactivity
- Mark Client Components with `"use client"` directive
- Server Components can directly query database
- Client Components need API routes for data fetching

### Environment Variables

Required variables (see `.env.example` or run `pnpm env:check`):
- `DATABASE_URL` - PostgreSQL connection string (Neon/Vercel)
- `DIRECT_URL` - Direct database URL (for migrations)
- `NEXTAUTH_SECRET` - Auth secret (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL` - App URL (http://localhost:3000 in dev)

### PWA Configuration

The app is a Progressive Web App (PWA):
- Service worker generated in `/public`
- Configured via `next-pwa` in `next.config.mjs`
- Disabled in development mode

### Testing Patterns

- Tests use Vitest (configured in `vitest.config.ts`)
- Test files: `*.test.ts` or `*.spec.ts`
- Setup file: `tests/setup.ts`
- Run single test: `pnpm test <filename>`
- Navigation performance tests excluded (requires Playwright)

## Common Gotchas

1. **UUID Validation:** All IDs must be valid UUIDs. Auth config includes auto-repair for corrupted tokens.
2. **Spanish Locale:** All dates, numbers, currency use `es-AR` locale
3. **Prisma Generate:** Always run `pnpm db:generate` after schema changes
4. **Role-Based Access:** Check user role before allowing destructive operations
5. **Event Ordering:** Events have timestamps - order matters for derived state
6. **Batch Operations:** Events can be individual (`animalId`) OR batch (`loteId`) - never both
7. **Sector Types:** Unified model - check `tipo` field ('potrero' | 'corral' | 'manga' | 'feedlot')

## Migration Strategy

When modifying the database schema:
1. Edit `prisma/schema.prisma`
2. Run `pnpm db:generate` to update client
3. Run `pnpm db:push` for development (or `db:migrate:dev` for production)
4. Update seed data if needed (`prisma/seed.ts`)
5. Update TypeScript types (`lib/types.ts`) if needed

## Refactoring History

This codebase underwent a major refactor in v2.0.0 (Nov 2025):
- Eliminated duplicate routes
- Standardized all code to Spanish
- Centralized utilities (formatters, validators, calculators, styles)
- Created typed constants for all states
- Cleaned navigation (removed dead links)
- Improved accessibility and performance

Refer to `REFACTOR_CHANGELOG.md` for complete details.
