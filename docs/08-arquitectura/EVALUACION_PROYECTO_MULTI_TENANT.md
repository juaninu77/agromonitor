# 🔍 Evaluación del Proyecto AgroMonitor ERP

## 📋 Objetivo del Sistema

Un **ERP para actividad agropecuaria en Argentina** que sea:
- ✅ **Escalable**: Múltiples usuarios y campos
- ✅ **Multi-tenant**: Datos aislados por usuario/organización
- ✅ **Normativa Argentina**: CUIG, RENSPA, SENASA
- ✅ **Registro Genealógico**: Trazabilidad completa de linaje
- ✅ **Flexible**: Adaptable a diferentes tipos de producción

---

## 📊 Estado Actual

### ✅ Lo que ESTÁ Bien Implementado

| Componente | Estado | Notas |
|------------|--------|-------|
| **UI Completa** | ✅ 100% | 9 módulos funcionales |
| **Diseño Responsive** | ✅ | Mobile-first |
| **Componentes Reutilizables** | ✅ | shadcn/ui bien implementado |
| **Estructura de Proyecto** | ✅ | Next.js 15 App Router |
| **Schema Básico Ganado** | ✅ | Bovinos, Ovinos, Campos |
| **Identificación CUIG** | ✅ | Implementado en Bovino |
| **Relación Padre/Madre** | ⚠️ Parcial | Existe pero necesita mejoras |
| **APIs de Ejemplo** | ✅ | GET/POST bovinos y ovinos |

### 🔴 Lo que FALTA para Multi-Tenancy

| Componente | Estado | Prioridad |
|------------|--------|-----------|
| **Sistema de Autenticación** | ❌ No existe | 🔴 CRÍTICO |
| **Modelo de Organización** | ❌ No existe | 🔴 CRÍTICO |
| **Aislamiento de Datos** | ❌ No existe | 🔴 CRÍTICO |
| **Selector de Campo** | ❌ No existe | 🟡 ALTO |
| **Roles y Permisos** | ❌ No existe | 🟡 ALTO |
| **Registro de Usuario** | ❌ No existe | 🟡 ALTO |
| **Middleware de Tenant** | ❌ No existe | 🟡 ALTO |

---

## 🏗️ Arquitectura Propuesta: Multi-Tenant

### Modelo de Datos Multi-Tenant

```
┌─────────────────────────────────────────────────────────┐
│                      NIVEL GLOBAL                        │
│                                                          │
│  ┌──────────┐     ┌──────────────┐                      │
│  │ Usuario  │────▶│  Membresía   │                      │
│  └──────────┘     └──────────────┘                      │
│       │                  │                               │
│       ▼                  ▼                               │
│  ┌──────────────────────────────────────┐               │
│  │         Organización/Empresa          │               │
│  │  (Puede tener múltiples campos)       │               │
│  └──────────────────────────────────────┘               │
│                      │                                   │
└──────────────────────│───────────────────────────────────┘
                       │
┌──────────────────────│───────────────────────────────────┐
│                      ▼      NIVEL TENANT                 │
│              ┌──────────────┐                            │
│              │    Campo     │ (campoActivo)              │
│              └──────────────┘                            │
│                      │                                   │
│   ┌──────────────────┼──────────────────┐               │
│   │                  │                  │               │
│   ▼                  ▼                  ▼               │
│ Bovinos          Ovinos            Cultivos             │
│ Alimentos        Tareas            Finanzas             │
│ Movimientos      Sanitario         IoT                  │
│ Engorde          Reproducción      Mercado              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Modelos de Base de Datos Propuestos

```prisma
// ========================================
// AUTENTICACIÓN Y MULTI-TENANCY
// ========================================

model Usuario {
  id                String    @id @default(cuid())
  email             String    @unique
  passwordHash      String    // bcrypt hash
  nombre            String
  apellido          String
  telefono          String?
  avatar            String?
  emailVerificado   DateTime?
  esActivo          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relaciones
  membresias        Membresia[]
  preferencias      UsuarioPreferencias?
  sessions          Session[]
  
  @@index([email])
}

model Session {
  id            String   @id @default(cuid())
  sessionToken  String   @unique
  usuarioId     String
  usuario       Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  expires       DateTime
  
  // Campo activo seleccionado
  campoActivoId String?
  
  @@index([usuarioId])
}

model Organizacion {
  id                String    @id @default(cuid())
  nombre            String
  cuit              String?   @unique  // CUIT argentino
  renspa            String?   // Número RENSPA
  direccion         String?
  telefono          String?
  email             String?
  logoUrl           String?
  plan              String    @default("free") // 'free' | 'pro' | 'enterprise'
  esActiva          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relaciones
  miembros          Membresia[]
  campos            Campo[]
  
  @@index([cuit])
  @@index([renspa])
}

model Membresia {
  id              String       @id @default(cuid())
  usuarioId       String
  usuario         Usuario      @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  organizacionId  String
  organizacion    Organizacion @relation(fields: [organizacionId], references: [id], onDelete: Cascade)
  rol             String       // 'propietario' | 'admin' | 'supervisor' | 'operario' | 'veterinario'
  esActiva        Boolean      @default(true)
  invitadoPor     String?
  invitadoEn      DateTime?
  aceptadoEn      DateTime?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  @@unique([usuarioId, organizacionId])
  @@index([usuarioId])
  @@index([organizacionId])
}

// Campo ahora pertenece a una Organización
model Campo {
  id                String       @id @default(cuid())
  organizacionId    String
  organizacion      Organizacion @relation(fields: [organizacionId], references: [id], onDelete: Cascade)
  nombre            String
  hectareas         Float
  tipo              String       // 'propio' | 'arrendado' | 'compartido'
  renspa            String?      // RENSPA específico del campo
  ubicacionLat      Float?
  ubicacionLng      Float?
  ubicacionProvincia String?
  ubicacionPartido  String?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
  
  // Relaciones
  bovinos           Bovino[]
  ovinos            Ovino[]
  // ... resto de relaciones
  
  @@unique([organizacionId, nombre])
  @@index([organizacionId])
  @@index([renspa])
}
```

---

## 🇦🇷 Normativa Argentina para Ganado

### 1. CUIG (Código Único de Identificación Ganadera)

```typescript
// El CUIG tiene formato: XX-XXXX-XXXX-X (provincia-establecimiento-animal-dígito verificador)
// Ejemplo: 06-1234-5678-9

interface CUIG {
  provincia: string;        // 2 dígitos
  establecimiento: string;  // 4 dígitos
  animal: string;          // 4 dígitos
  digitoVerificador: string; // 1 dígito
}
```

### 2. RENSPA (Registro Nacional Sanitario de Productores Agropecuarios)

```typescript
// El RENSPA identifica al establecimiento agropecuario
// Formato: XX.XXX.X.XXXXX/XX

interface RENSPA {
  provincia: string;
  partido: string;
  departamento: string;
  numeroEstablecimiento: string;
  localidad: string;
}
```

### 3. DTA (Documento de Tránsito Animal)

```prisma
model DocumentoTransito {
  id                String    @id @default(cuid())
  numero            String    @unique  // Número DTA
  tipo              String    // 'DTA' | 'DT-e' (electrónico)
  
  // Origen
  renspaOrigen      String
  campoOrigenId     String
  campoOrigen       Campo     @relation("DTAOrigen", fields: [campoOrigenId], references: [id])
  
  // Destino
  renspaDestino     String
  destinoNombre     String?
  destinoDireccion  String?
  
  // Detalles
  fechaEmision      DateTime
  fechaVencimiento  DateTime
  cantidadAnimales  Int
  especieAnimales   String    // 'bovino' | 'ovino'
  categorias        Json      // Detalle por categoría
  motivo            String    // 'venta' | 'traslado' | 'faena' | 'exposición'
  
  // Estado
  estado            String    @default("pendiente") // 'pendiente' | 'en_transito' | 'recibido' | 'cancelado'
  
  // Transporte
  transportista     String?
  patenteCamion     String?
  patenteAcoplado   String?
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([renspaOrigen])
  @@index([renspaDestino])
  @@index([fechaEmision])
}
```

---

## 🧬 Registro Genealógico

### Modelo de Genealogía Completo

```prisma
model Bovino {
  id                  String    @id @default(cuid())
  
  // Identificación
  cuig                String?   @unique
  numero              String
  caravana            String?   // Número de caravana física
  tatuaje             String?   // Número de tatuaje
  chip                String?   // Número de chip electrónico
  
  // Genealogía
  padreId             String?
  padre               Bovino?   @relation("BovinoPadre", fields: [padreId], references: [id])
  madreId             String?
  madre               Bovino?   @relation("BovinoMadre", fields: [madreId], references: [id])
  abueloPaternoId     String?   // Opcional: para genealogía extendida
  abuelaMaternaId     String?
  
  // Relaciones inversas
  hijosPadre          Bovino[]  @relation("BovinoPadre")
  hijosMadre          Bovino[]  @relation("BovinoMadre")
  
  // Genética
  registroGenealogico String?   // Número de registro en asociación de criadores
  razaPura            Boolean   @default(false)
  porcentajeRaza      Json?     // { "angus": 75, "hereford": 25 }
  
  // Valores Genéticos (DEP)
  valoresGeneticos    ValoresGeneticos?
  
  // ... resto de campos
}

model ValoresGeneticos {
  id                  String    @id @default(cuid())
  bovinoId            String    @unique
  bovino              Bovino    @relation(fields: [bovinoId], references: [id])
  
  // DEP (Diferencia Esperada de Progenie)
  pesoNacimiento      Float?    // DEP peso al nacer
  pesoDestete         Float?    // DEP peso al destete
  peso18Meses         Float?    // DEP peso a los 18 meses
  circunferenciaEscrotal Float? // DEP CE (solo machos)
  facilidadParto      Float?    // DEP facilidad de parto
  habilidadMaterna    Float?    // DEP habilidad materna
  areaOjoLomo         Float?    // DEP área de ojo de lomo
  marmoleado          Float?    // DEP marbling
  
  // Precisión de los DEP
  precisionPN         Float?
  precisionPD         Float?
  precisionP18        Float?
  
  // Fuente y fecha
  fuente              String?   // Asociación de criadores
  fechaEvaluacion     DateTime?
  
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

model ArbolGenealogico {
  id                  String    @id @default(cuid())
  animalId            String
  animalTipo          String    // 'bovino' | 'ovino'
  generaciones        Int       // Cuántas generaciones hacia atrás
  arbol               Json      // Árbol completo en JSON
  coeficienteConsanguinidad Float?
  calculadoEn         DateTime  @default(now())
  
  @@unique([animalId, animalTipo])
}
```

### Funciones de Genealogía

```typescript
// lib/utils/genealogy.ts

/**
 * Construye el árbol genealógico de un animal
 */
export async function construirArbolGenealogico(
  animalId: string, 
  generaciones: number = 4
): Promise<ArbolGenealogico> {
  // Implementación recursiva
}

/**
 * Calcula el coeficiente de consanguinidad
 */
export function calcularConsanguinidad(arbol: ArbolGenealogico): number {
  // Algoritmo de Wright
}

/**
 * Encuentra ancestros comunes entre dos animales
 */
export function encontrarAncestrosComunes(
  animal1Id: string, 
  animal2Id: string
): string[] {
  // Para evitar cruzas consanguíneas
}

/**
 * Genera reporte de progenie de un reproductor
 */
export async function generarReporteProgenie(
  reproductorId: string
): Promise<ReporteProgenie> {
  // Lista de crías con estadísticas
}
```

---

## 🔐 Sistema de Autenticación

### Opción Recomendada: NextAuth.js v5

```typescript
// auth.config.ts
import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export default {
  providers: [
    Credentials({
      async authorize(credentials) {
        const user = await prisma.usuario.findUnique({
          where: { email: credentials.email },
          include: {
            membresias: {
              include: { organizacion: true },
              where: { esActiva: true }
            }
          }
        })
        
        if (!user) return null
        
        const passwordMatch = await bcrypt.compare(
          credentials.password, 
          user.passwordHash
        )
        
        if (!passwordMatch) return null
        
        return {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          organizaciones: user.membresias.map(m => ({
            id: m.organizacion.id,
            nombre: m.organizacion.nombre,
            rol: m.rol
          }))
        }
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.organizaciones = user.organizaciones
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id
      session.user.organizaciones = token.organizaciones
      return session
    }
  }
} satisfies NextAuthConfig
```

### Middleware de Protección

```typescript
// middleware.ts
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isPublicRoute = ['/login', '/register', '/'].includes(req.nextUrl.pathname)
  
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  // Inyectar organizacionId y campoId en headers
  if (isLoggedIn && req.auth?.organizacionActiva) {
    const headers = new Headers(req.headers)
    headers.set('x-organizacion-id', req.auth.organizacionActiva)
    headers.set('x-campo-id', req.auth.campoActivo || '')
    
    return NextResponse.next({ headers })
  }
  
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)']
}
```

---

## 📱 Selector de Campo

### Componente UI

```typescript
// components/layout/campo-selector.tsx
"use client"

import { useCampoActivo } from '@/lib/hooks/use-campo-activo'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function CampoSelector() {
  const { campos, campoActivo, setCampoActivo, loading } = useCampoActivo()
  
  if (loading) return <Skeleton className="w-48 h-10" />
  
  return (
    <Select value={campoActivo?.id} onValueChange={setCampoActivo}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Seleccionar campo" />
      </SelectTrigger>
      <SelectContent>
        {campos.map(campo => (
          <SelectItem key={campo.id} value={campo.id}>
            🌾 {campo.nombre} ({campo.hectareas} ha)
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

### Hook de Campo Activo

```typescript
// lib/hooks/use-campo-activo.ts
"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CampoStore {
  campoActivo: Campo | null
  campos: Campo[]
  setCampoActivo: (campoId: string) => void
  setCampos: (campos: Campo[]) => void
}

export const useCampoStore = create<CampoStore>()(
  persist(
    (set, get) => ({
      campoActivo: null,
      campos: [],
      setCampoActivo: (campoId) => {
        const campo = get().campos.find(c => c.id === campoId)
        set({ campoActivo: campo })
      },
      setCampos: (campos) => set({ campos })
    }),
    { name: 'campo-activo' }
  )
)
```

---

## 🗓️ Plan de Implementación

### Fase 1: Autenticación Básica (1-2 semanas)

1. **Instalar dependencias**
   ```bash
   pnpm add next-auth@beta bcryptjs
   pnpm add -D @types/bcryptjs
   ```

2. **Crear modelos de autenticación**
   - Usuario (con passwordHash)
   - Session
   - Organizacion
   - Membresia

3. **Implementar registro/login**
   - Página `/register`
   - Página `/login`
   - API routes de auth

4. **Proteger rutas**
   - Middleware de autenticación
   - Redirección a login

### Fase 2: Multi-Tenancy (1-2 semanas)

1. **Agregar organizacionId a modelos**
   - Migración de datos existentes
   - Crear organización default

2. **Implementar selector de campo**
   - Componente en header
   - Persistencia en session

3. **Filtrado automático**
   - Prisma middleware
   - API routes filtradas

### Fase 3: Normativa Argentina (1 semana)

1. **Validación de CUIG**
2. **Modelo de RENSPA**
3. **Documentos de tránsito**

### Fase 4: Genealogía Avanzada (1-2 semanas)

1. **Árbol genealógico**
2. **Cálculo de consanguinidad**
3. **Reportes de progenie**
4. **Valores genéticos (DEP)**

---

## 📊 Resumen de Brechas

### Crítico (Bloquea Multi-Tenancy)

| Brecha | Esfuerzo | Impacto |
|--------|----------|---------|
| Sistema de autenticación | 2 semanas | 🔴 CRÍTICO |
| Modelo de organización | 1 semana | 🔴 CRÍTICO |
| Selector de campo | 3 días | 🔴 CRÍTICO |
| Filtrado por tenant | 1 semana | 🔴 CRÍTICO |

### Alto (Funcionalidad Core)

| Brecha | Esfuerzo | Impacto |
|--------|----------|---------|
| Registro de usuario | 3 días | 🟡 ALTO |
| Roles y permisos | 1 semana | 🟡 ALTO |
| Invitaciones a equipo | 3 días | 🟡 ALTO |
| Documentos de tránsito | 1 semana | 🟡 ALTO |

### Medio (Mejoras)

| Brecha | Esfuerzo | Impacto |
|--------|----------|---------|
| Árbol genealógico visual | 1 semana | 🟢 MEDIO |
| Valores genéticos | 1 semana | 🟢 MEDIO |
| Exportación a SENASA | 2 semanas | 🟢 MEDIO |

---

## ✅ Conclusión

El proyecto AgroMonitor tiene una **UI muy completa** pero necesita trabajo significativo para ser un **ERP multi-tenant escalable**:

### Lo Positivo:
- ✅ UI moderna y funcional
- ✅ Estructura de proyecto sólida
- ✅ Schema de datos bien pensado para ganado
- ✅ Ya considera normativa argentina (CUIG)
- ✅ Ya tiene relaciones padre/madre

### Lo que Necesita:
- ❌ Sistema de autenticación completo
- ❌ Modelo de organización/empresa
- ❌ Selector de campo activo
- ❌ Aislamiento de datos por tenant
- ❌ Registros de SENASA/RENSPA

### Timeline Estimado:
- **Mínimo viable multi-tenant**: 4-6 semanas
- **Versión completa con genealogía**: 8-10 semanas
- **Con integración SENASA**: 12-14 semanas

---

**Fecha de evaluación**: Noviembre 2025  
**Estado**: 📊 EVALUACIÓN COMPLETADA

