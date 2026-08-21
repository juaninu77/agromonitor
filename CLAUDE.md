# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AgroMonitor is an ERP system for managing agricultural operations (livestock, crops, finances, inventory), built with Next.js 15 (App Router), React 19, TypeScript, Prisma, and PostgreSQL (Neon/Vercel). The system is entirely in Spanish (es-AR locale) and follows a multi-tenant architecture with role-based access control.

**Also read the Cursor rules — they are binding for this repo:**
- `.cursor/rules/seguridad-db.md` — Database safety rules (see "Database Safety" below)
- `.cursor/rules/baston-xrs2i.md` — Source of truth for RFID/EID reading and the `manga` module

## Common Commands

### Development
```bash
pnpm dev                # Start development server on localhost:3000
pnpm dev:test           # Start dev server with NODE_ENV=test
pnpm build              # Production build (includes prisma generate)
pnpm lint               # Run ESLint
pnpm type-check         # TypeScript type checking (tsc --noEmit)
```

### Testing
```bash
pnpm test               # Run tests with Vitest (watch mode)
pnpm test:ci            # Run tests once (CI mode)
pnpm test <filename>    # Run a single test file
```
Tests live in `tests/` and alongside code as `*.test.ts` / `*.spec.ts`. Setup file: `tests/setup.ts`. `tests/navigation-performance.test.ts` is excluded (requires Playwright).

### Database
```bash
pnpm db:generate        # Generate Prisma Client (also runs on postinstall)
pnpm db:push            # Push schema changes to database
pnpm db:push:dev        # Push using .env.development (also :test, :prod variants)
pnpm db:migrate:dev     # Create/apply migration (dev)
pnpm db:migrate:deploy  # Apply migrations (production)
pnpm db:seed            # Seed database (prisma/seed.ts; also :dev, :test variants)
pnpm db:studio          # Open Prisma Studio
pnpm db:reset:test      # Force-reset test database and reseed
pnpm db:check-safety    # Check migration safety
pnpm db:backup          # Backup database (scripts/backup-db.sh|.bat)
pnpm import:excel       # Import data from Excel files
```

### Environment
```bash
pnpm env:check          # Validate environment variables
pnpm env:setup          # Setup environment files
```

Required variables: `DATABASE_URL`, `DIRECT_URL` (migrations), `NEXTAUTH_SECRET`, `NEXTAUTH_URL`. Per-environment files (`.env.development`, `.env.test`, `.env.production`) are used via `dotenv-cli` in the scripts above.

## Database Safety (MANDATORY)

From `.cursor/rules/seguridad-db.md` — **never execute destructive database operations without explicit user confirmation**:

- Prohibited without confirmation: `DROP DATABASE/TABLE/SCHEMA/COLUMN`, `TRUNCATE`, `DELETE`/`UPDATE` without a specific WHERE, `prisma migrate reset`, `prisma db push --force-reset`, editing `.env` files.
- Before any data-modifying command: show the exact command, explain what it does, ask for explicit confirmation, and wait for it.
- Before migrations or important changes: create a backup first (`pg_dump` / `pnpm db:backup`).
- Always safe: `SELECT`, `prisma generate`, `prisma studio`, adding new tables/columns, inserting new data.

## High-Level Architecture

### Multi-Tenant Structure

- **Organizacion** (Organization) is the top-level entity
- **Membresia** (Membership) links Usuarios to Organizations with specific roles
- **Establecimiento** (Farm/Ranch) belongs to an Organization
- All data is scoped to Organizations/Establecimientos via foreign keys
- Client-side tenant state lives in `lib/context/tenant-context.tsx`

### Authentication & Authorization

- **NextAuth v5** (beta) with JWT-based sessions; config in `auth.ts` / `auth.config.ts`, route protection in `middleware.ts`
- Auto-repair mechanism for corrupted JWT tokens (see `auth.config.ts`); all IDs must be valid UUIDs
- Role hierarchy: `admin` > `encargado` > `vet` > `operario`
- Session data includes: `user.id`, `user.email`, `user.nombre`, `user.apellido`, `user.rol`

### API Route Pattern (`withAuth`)

API routes under `/app/api/*` should use the `withAuth()` wrapper from `lib/api/with-auth.ts` instead of checking sessions manually:

```typescript
import { withAuth } from "@/lib/api/with-auth"

export const POST = withAuth(
  async (request, { userId, userRole, establecimientoIds }) => {
    // establecimientoIds = all farms the user can access (tenant scoping)
    // ...
  },
  { roles: ["admin", "encargado"] } // optional role restriction → 403
)
```

It returns 401 when unauthenticated, 403 when the role check fails, and resolves the user's accessible `establecimientoIds` from active Membresias. **Always filter queries by `establecimientoIds`** — never return cross-tenant data.

For mutations on sensitive tables, record an audit entry with `logAudit()` from `lib/api/audit-log.ts` (writes to the `AuditLog` model; failures are swallowed so it never breaks the main operation).

Other API conventions: pagination via `page`/`limit` query params, filtering via query params, errors as `{ error: "..." }` with appropriate status codes.

### Database Architecture (Event Sourcing Hybrid)

The Prisma schema (`prisma/schema.prisma` — the other `schema-*.prisma` files are historical backups, do not edit them) implements a **hybrid event-sourcing model**:

**Core Entities:**
- `Animal` - Individual animal records (identified by `caravanaVisual` and/or RFID EID `caravanaRfid`)
- `Lote` (Herd/Group), `Torada` (breeding groups)
- `Sector` - Unified physical locations; check `tipo` field (`'potrero' | 'corral' | 'manga' | 'feedlot'`)
- `Establecimiento` - Farm/Ranch entities
- Catalogs: `Especie`, `Raza`, `Categoria`, `Forraje`, `Producto`, `Proveedor`, `Cliente`

**Event Tables (Evt*):** `EvtPesada` (weighing), `EvtSanidad` (health), `EvtMovimiento`, `EvtServicio` (breeding), `EvtTacto` (pregnancy check), `EvtParicion` (birth), `EvtDestete` (weaning), `EvtBaja` (exit/sale/death), `EvtAlimentacion`, `EvtPastoreo`

**Supporting models:** `Genealogia` (genealogy, supports external parents), `AnimalAttr` (EAV extensibility), `UbicacionHist` / `AnimalLoteHist` (temporal state), `Dieta` / `PlanAlimentacion`, `MedicionPotrero`, `MovimientoStock` (inventory), `DocumentoTransito`, `AuditLog`, `SesionManga` / `SesionMangaItem` (RFID handling sessions), `Tarea`, `Notificacion`

**Key Architectural Decisions:**
1. Animal state is **derived from events**, not stored redundantly
2. Events can apply to individual animals (`animalId`) OR entire lotes (`loteId`) - **never both**
3. Events have timestamps - order matters for derived state
4. Use `prisma.$transaction()` for multi-step operations; always import the client from `@/lib/prisma`
5. Include relations explicitly in queries - don't rely on default includes

### Manga Module (RFID Livestock Handling) — Offline-First

The `/manga` module reads electronic ear tags (EID) with a **Tru-Test XRS2i** wand. Full rules in `.cursor/rules/baston-xrs2i.md` and `docs/GUIA_XRS2i_INTEGRACION.md`. Key facts:

- **Offline-first:** the device running the app is the primary store (IndexedDB, DB name `agromonitor-manga`); the wand is only the EID source. Wand memory + CSV import are the safety net, not the primary store.
- **Two connection modes**, both valid: **HID (Bluetooth keyboard)** — EID is "typed" into the focused input; the only option on mobile — and **Web Serial** (desktop Chrome/Edge only), implemented in `lib/hardware/serial-reader.ts` (streaming, reconnection with backoff; open the port once and keep it open).
- **Always normalize EIDs** with `normalizeEID()` from `lib/hardware/eid.ts` (ISO 11784/11785, 15-16 digits; tolerates spaces/separators). Every input path (HID, serial, CSV) must interpret EIDs identically.
- `lib/hardware/` layer: `eid.ts` (normalization), `serial-reader.ts` (Web Serial), `herd-cache.ts` (IndexedDB herd cache for offline EID→animal lookup), `offline-queue.ts` (pending writes, synced later), `csv-parser.ts` (Datamars/Data Link CSV import; `EID` column is the key, dedupe by EID+timestamp against live captures).
- Scan mode UX: fixed input focus, dedupe of double reads (~3s), sound/vibration feedback.
- UI components in `app/(app)/manga/components/` (workspace, reader-connect, action-panel, session config/summary, sync-status, CSV upload).

### App Router Structure

Route groups: `/app/(app)/*` (authenticated, wrapped in AppShell layout) and `/app/(auth)/*` (login, register).

**Main Modules:** `/ganado` (livestock), `/sanidad` (health), `/reproduccion` (breeding), `/manga` (RFID handling), `/potreros` (paddocks), `/ventas` (sales), `/cultivos`, `/finanzas`, `/inventario`, `/tareas` (Kanban), `/flota`, `/mercado`, `/mapa`, `/iot`, `/configuracion`. Navigation is defined in `lib/config/navigation.ts`.

### Server vs Client Components & Data Fetching

- **Default to Server Components** unless you need interactivity; mark Client Components with `"use client"`
- Server Components can query the database directly; Client Components fetch via API routes
- **TanStack Query (`@tanstack/react-query`)** is used for client-side data fetching/caching (see `lib/hooks/use-ganado-query.ts`); providers in `components/providers`
- Reusable hooks in `lib/hooks/` (`use-permissions`, `use-filtered-data`, etc.)

### Layout & UI Components

- `components/layout/app-shell.tsx` - Main layout with resizable sidebar (`react-resizable-panels`, state persisted in cookies)
- `components/configuracion/onboarding-guard.tsx` - Ensures org setup
- Base components in `components/ui/*` (shadcn/ui + Radix), icons from `lucide-react`, charts via `recharts`, toasts via `sonner`
- Exports: Excel via `xlsx` (`lib/utils/export-excel.ts`), PDF via `jspdf` (`lib/utils/export-pdf.ts`)

### Centralized Utilities (`lib/utils/`)

**CRITICAL:** Always import utilities from `@/lib/utils` (re-exported):

```typescript
// ✅ CORRECT
import { formatCurrency, formatDate, getEstadoSaludColor } from '@/lib/utils'

// ❌ WRONG - Don't import directly from subdirectories
import { formatCurrency } from '@/lib/utils/formatters'
```

- `formatters.ts` - `formatCurrency()`, `formatDate()`, `formatUnit()`, `formatPercentage()`
- `validators.ts` - `isValidEmail()`, `isValidPeso()`, `isValidCuit()`, `isValidCUIL()`
- `calculations.ts` - `calcularGDP()`, `calcularRendimiento()`, `calcularEdad()`, `calcularIMC()`
- `styles.ts` - `getEstadoSaludColor()`, `getPrioridadBadge()`, `getEstadoTareaVariant()`
- Domain helpers: `livestock-helpers.ts`, `crops-helpers.ts`

### Typed Constants (`lib/constants/`)

Use typed constants instead of magic strings — `estados.ts` (states), `ganado.ts`, `alimentacion.ts`, `campos.ts`:

```typescript
import { ESTADOS_SALUD, PRIORIDADES, ESTADOS_TAREA } from '@/lib/constants/estados'

// ✅ CORRECT
const estado = ESTADOS_SALUD.SALUDABLE

// ❌ WRONG
const estado = "Saludable"
```

### Form Handling Pattern

1. Define schema with `zod` in `lib/validations/` (e.g. `animal-schema.ts`, `sanidad-schema.ts`, `reproduccion-schema.ts`, `ventas-schema.ts`)
2. Use `react-hook-form` with `zodResolver`
3. Wrap in `<Form>` component from `@/components/ui/form` with `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`

### Naming Conventions

**STRICT CONVENTIONS - Follow these exactly:**

- **Files:** `kebab-case` (e.g., `animal-dialog.tsx`, `herd-cache.ts`)
- **Components:** `PascalCase` (e.g., `AnimalCard`, `MangaWorkspace`)
- **Functions:** `camelCase` (e.g., `calcularPromedio`, `normalizeEID`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `ESTADOS_SALUD`, `MAX_PESO`)
- **Types/Interfaces:** `PascalCase` (e.g., `AnimalFormData`, `PendingItem`)
- **Database tables:** `snake_case` (Prisma maps with `@@map()`)

### Import Order

Organize imports in this order: 1. React → 2. Next.js → 3. Third-party libraries → 4. UI components (`@/components/ui/*`) → 5. Custom components → 6. Lib utilities (`@/lib/utils`) → 7. Types → 8. Constants.

## Common Gotchas

1. **UUID Validation:** All IDs must be valid UUIDs. Auth config includes auto-repair for corrupted tokens.
2. **Spanish Locale:** All dates, numbers, currency use `es-AR` locale; code, comments, and UI text are in Spanish.
3. **Prisma Generate:** Always run `pnpm db:generate` after schema changes.
4. **Role-Based Access:** Restrict destructive operations by role via `withAuth({ roles: [...] })`.
5. **Tenant Scoping:** Every query in an API route must filter by the caller's `establecimientoIds`.
6. **Batch Operations:** Events reference `animalId` OR `loteId` - never both.
7. **Sector Types:** Unified model - check `tipo` field (`'potrero' | 'corral' | 'manga' | 'feedlot'`).
8. **EID Normalization:** Never compare raw EID strings; always pass through `normalizeEID()` first.
9. **PWA:** Configured via `next-pwa` in `next.config.mjs`; service worker generated in `/public`, disabled in development.

## Migration Strategy

When modifying the database schema:
1. Edit `prisma/schema.prisma` (only this file — the other `schema-*.prisma` files are backups)
2. Run `pnpm db:generate` to update the client
3. Run `pnpm db:push` for development (or `pnpm db:migrate:dev` / `db:migrate:deploy` for migrations) — respecting the Database Safety rules above
4. Update seed data if needed (`prisma/seed.ts`)
5. Update TypeScript types (`lib/types.ts`) if needed

## Documentation

Extended docs live in `docs/` (numbered by topic: inicio, ambientes, base-datos, desarrollo, deploy, rendimiento, análisis, arquitectura, modelo-datos). Notable references: `docs/GUIA_XRS2i_INTEGRACION.md` (RFID wand integration), `REFACTOR_CHANGELOG.md` (v2.0.0 refactor history), `PRISMA_VS_NEON.md`.
