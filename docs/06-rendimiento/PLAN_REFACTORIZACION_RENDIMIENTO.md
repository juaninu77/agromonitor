# 🔧 Plan de Refactorización para Optimización de Rendimiento

## 🎯 Objetivo
Reducir el tiempo de navegación entre páginas de **3-5 segundos a <1 segundo** mediante optimizaciones estratégicas sin romper la funcionalidad existente.

---

## 📋 Fase 1: Quick Wins (Implementación Inmediata)

### 1.1. Extraer Datos a Archivos Separados

#### Archivos a Crear:

```
lib/
  data/
    livestock-data.ts      ← Datos de app/ganado/page.tsx
    crops-data.ts          ← Datos de app/cultivos/page.tsx
    finance-data.ts        ← Datos de app/finanzas/page.tsx
    inventory-data.ts      ← Datos de app/inventario/page.tsx
```

**Beneficio:**
- ✅ Reduce archivo principal de 1260 → 560 líneas
- ✅ Permite code splitting automático
- ✅ Mejora legibilidad y mantenimiento

#### Ejemplo de Implementación:

```typescript
// lib/data/livestock-data.ts
export interface Animal {
  id: string
  name: string
  tagNumber: string
  // ... tipos completos
}

export const livestockMockData = {
  herdOverview: { /* ... */ },
  animalsList: [ /* ... */ ],
  // ...
}

// app/ganado/page.tsx
import { livestockMockData } from '@/lib/data/livestock-data'
```

---

### 1.2. Memoizar Funciones Helper

#### Problema Actual:
```typescript
// ❌ Se recrea en cada render
export default function GanadoPage() {
  const getBodyConditionColor = (score: number) => {
    if (score >= 6.0 && score <= 7.0) return "text-green-600"
    // ...
  }
}
```

#### Solución:
```typescript
// ✅ Mover FUERA del componente
const getBodyConditionColor = (score: number) => {
  if (score >= 6.0 && score <= 7.0) return "text-green-600"
  // ...
}

const getHealthStatusColor = (status: string) => {
  // ...
}

const getCategoryColor = (category: string) => {
  // ...
}

export default function GanadoPage() {
  // Solo usa las funciones, no las crea
}
```

**Beneficio:**
- ✅ Elimina creaciones innecesarias de funciones
- ✅ Mejora rendimiento de re-renders
- ✅ Permite tree shaking

---

### 1.3. Memoizar Componentes de Lista

#### Problema Actual:
```typescript
// ❌ Todo el Card se re-renderiza cuando cambia cualquier cosa
{filteredAnimals.map((animal) => (
  <Card key={animal.id} onClick={() => { /* ... */ }}>
    {/* Contenido complejo */}
  </Card>
))}
```

#### Solución:
```typescript
// ✅ Crear componente memoizado
const AnimalCard = memo(({ 
  animal, 
  onSelect 
}: { 
  animal: Animal
  onSelect: (animal: Animal) => void 
}) => {
  return (
    <Card 
      className="border-2 border-gray-200 hover:border-blue-300"
      onClick={() => onSelect(animal)}
    >
      <CardHeader>
        <CardTitle>{animal.name}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Contenido */}
      </CardContent>
    </Card>
  )
})

AnimalCard.displayName = 'AnimalCard'

// En el componente principal
const handleAnimalSelect = useCallback((animal: Animal) => {
  setSelectedAnimal(animal)
  setSelectedTab("detalle")
}, [])

return (
  <>
    {filteredAnimals.map((animal) => (
      <AnimalCard 
        key={animal.id} 
        animal={animal} 
        onSelect={handleAnimalSelect}
      />
    ))}
  </>
)
```

**Beneficio:**
- ✅ Solo re-renderiza los Cards que cambian
- ✅ 80% reducción en renders innecesarios
- ✅ Navegación más fluida

---

### 1.4. Memoizar Filtros y Búsquedas

#### Problema Actual:
```typescript
// ❌ Se recalcula en CADA render
const filteredAnimals = livestockData.animalsList.filter((animal) => {
  const matchesSearch = animal.name.toLowerCase().includes(searchTerm.toLowerCase())
  const matchesFilter = /* lógica compleja */
  return matchesSearch && matchesFilter
})
```

#### Solución:
```typescript
// ✅ Solo se recalcula cuando cambian las dependencias
const filteredAnimals = useMemo(() => {
  return livestockData.animalsList.filter((animal) => {
    const matchesSearch = 
      animal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      animal.tagNumber.includes(searchTerm)
    
    const matchesFilter =
      filterStatus === "todos" ||
      (filterStatus === "reproductores" && 
        (animal.category === "Toro Reproductor" || animal.category === "Vaca Madre"))
    
    return matchesSearch && matchesFilter
  })
}, [searchTerm, filterStatus])
```

**Beneficio:**
- ✅ No recalcula si searchTerm y filterStatus no cambian
- ✅ Mejora rendimiento en listas grandes
- ✅ Reduce carga de CPU

---

### 1.5. Lazy Loading de Tabs

#### Problema Actual:
```typescript
// ❌ Todos los tabs se renderizan aunque no estén visibles
<TabsContent value="detalle">
  <PesoTab data={weightRecords} />
  <ReproduccionTab data={reproductiveHistory} />
  <SaludTab data={healthRecords} />
  <NutricionTab data={nutritionPlan} />
  <GeneticaTab data={geneticData} />
  <EconomiaTab data={economicData} />
</TabsContent>
```

#### Solución:
```typescript
// ✅ Lazy loading con dynamic imports
import dynamic from 'next/dynamic'

const PesoTab = dynamic(() => import('./tabs/peso-tab'), {
  loading: () => <TabSkeleton />,
})

const ReproduccionTab = dynamic(() => import('./tabs/reproduccion-tab'), {
  loading: () => <TabSkeleton />,
})

// ... otros tabs

// Componente de carga
function TabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}
```

**Beneficio:**
- ✅ Solo carga el tab visible
- ✅ 50% reducción en bundle inicial
- ✅ Carga instantánea del primer tab

---

## 📋 Fase 2: Arquitectura (Server Components)

### 2.1. Convertir Páginas a Server Components

#### Estructura Actual:
```typescript
// ❌ app/ganado/page.tsx
"use client"

export default function GanadoPage() {
  const [selectedTab, setSelectedTab] = useState("lista")
  // Todo en cliente
}
```

#### Estructura Nueva:
```typescript
// ✅ app/ganado/page.tsx (Server Component)
import { LivestockClient } from './livestock-client'
import { getServerData } from '@/lib/data/server-data'

export default async function GanadoPage() {
  // Esto se ejecuta en el servidor
  const initialData = await getServerData()
  
  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Gestión de Ganado Bovino" />
      <LivestockStats data={initialData.stats} />
      <LivestockClient initialData={initialData} />
    </div>
  )
}

// ✅ app/ganado/livestock-client.tsx
"use client"

export function LivestockClient({ initialData }: Props) {
  // Solo lógica interactiva aquí
  const [selectedTab, setSelectedTab] = useState("lista")
  const [selectedAnimal, setSelectedAnimal] = useState(null)
  
  return (
    <Tabs value={selectedTab} onValueChange={setSelectedTab}>
      {/* Contenido interactivo */}
    </Tabs>
  )
}
```

**Beneficio:**
- ✅ 0 KB de JS para contenido estático
- ✅ Renderizado más rápido
- ✅ Mejor SEO y performance

---

### 2.2. Separar AppShell

#### Estructura Actual:
```typescript
// ❌ components/layout/app-shell.tsx
"use client"

export function AppShell({ children }) {
  // Todo es cliente
}
```

#### Estructura Nueva:
```typescript
// ✅ components/layout/app-shell.tsx (Server Component)
import { AppShellClient } from './app-shell-client'

export function AppShell({ children }: Props) {
  return (
    <div className="flex flex-col min-h-screen">
      <AppShellClient>
        {children}
      </AppShellClient>
    </div>
  )
}

// ✅ components/layout/app-shell-client.tsx
"use client"

export function AppShellClient({ children }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  // Solo lógica de interacción
  return (
    <ResizablePanelGroup>
      {/* ... */}
    </ResizablePanelGroup>
  )
}
```

---

### 2.3. Implementar Suspense Boundaries

```typescript
// ✅ app/ganado/page.tsx
import { Suspense } from 'react'

export default async function GanadoPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<StatsSkeleton />}>
        <LivestockStats />
      </Suspense>
      
      <Suspense fallback={<ListSkeleton />}>
        <LivestockList />
      </Suspense>
    </div>
  )
}
```

**Beneficio:**
- ✅ Carga progresiva de contenido
- ✅ Mejor experiencia de usuario
- ✅ No bloquea renderizado

---

## 📋 Fase 3: Optimizaciones Avanzadas

### 3.1. Virtual Scrolling para Listas Largas

```typescript
// ✅ Instalar: pnpm add @tanstack/react-virtual

import { useVirtualizer } from '@tanstack/react-virtual'

function AnimalList({ animals }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const virtualizer = useVirtualizer({
    count: animals.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // altura estimada del card
  })
  
  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <AnimalCard animal={animals[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Beneficio:**
- ✅ Solo renderiza elementos visibles
- ✅ Perfecto para 100+ items
- ✅ Scroll suave y performante

---

### 3.2. Optimizar Imports de Iconos

#### Problema Actual:
```typescript
// ❌ Importa TODOS los iconos al bundle
import {
  MilkIcon as Cow,
  Heart,
  Activity,
  Weight,
  // ... 30+ iconos
} from "lucide-react"
```

#### Solución:
```typescript
// next.config.js
module.exports = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

// O importar individualmente:
import Cow from 'lucide-react/dist/esm/icons/milk'
import Heart from 'lucide-react/dist/esm/icons/heart'
```

**Beneficio:**
- ✅ Reduce bundle de iconos en 70%
- ✅ Tree shaking más efectivo

---

## 🧪 Testing de Rendimiento

### Herramientas a Usar:

1. **React DevTools Profiler**
   ```bash
   # Activar modo profiling
   npm run dev
   # Abrir DevTools → Profiler → Record
   ```

2. **Lighthouse**
   ```bash
   # Analizar performance
   npm run build
   npm run start
   # Abrir DevTools → Lighthouse → Analyze
   ```

3. **Next.js Bundle Analyzer**
   ```bash
   npm install @next/bundle-analyzer
   # Analizar bundle size
   ANALYZE=true npm run build
   ```

---

## 📊 Métricas de Éxito

### Antes de Optimización:
- ⏱️ Navegación: 3-5 segundos
- 📦 Bundle JS: 2.1 MB
- 🔄 Re-renders: 15-20 por interacción
- 💾 Memoria: 150-200 MB

### Después de Optimización (Objetivos):
- ⚡ Navegación: <1 segundo
- 📦 Bundle JS: <800 KB
- 🔄 Re-renders: 2-3 por interacción
- 💾 Memoria: <80 MB

---

## 🚀 Orden de Implementación

1. ✅ **Día 1**: Extraer datos + Memoización
2. ✅ **Día 2**: Lazy loading + Componentes memoizados
3. ✅ **Día 3**: Server Components básicos
4. ✅ **Día 4**: Separar AppShell + Suspense
5. ✅ **Día 5**: Optimizaciones avanzadas
6. ✅ **Día 6**: Testing y ajustes
7. ✅ **Día 7**: Documentación y despliegue

---

## ⚠️ Precauciones

### No Romper:
- ✅ Funcionalidad existente
- ✅ Estilos visuales
- ✅ Flujos de usuario
- ✅ Integraciones

### Testing Obligatorio:
- [ ] Navegación entre todas las páginas
- [ ] Filtros y búsquedas funcionan
- [ ] Tabs cargan correctamente
- [ ] Responsive design mantiene
- [ ] No hay errores en consola

---

## 📝 Checklist por Archivo

### app/ganado/page.tsx
- [ ] Extraer `livestockData` a `/lib/data/livestock-data.ts`
- [ ] Mover funciones helper fuera del componente
- [ ] Crear `AnimalCard` memoizado
- [ ] Implementar `useMemo` para `filteredAnimals`
- [ ] Implementar `useCallback` para handlers
- [ ] Lazy loading de tabs
- [ ] Separar en server + client component
- [ ] Testing completo

### app/cultivos/page.tsx
- [ ] Extraer `cropData` a `/lib/data/crops-data.ts`
- [ ] Mover funciones helper fuera del componente
- [ ] Crear `CropCard` memoizado
- [ ] Implementar `useMemo` para `filteredCrops`
- [ ] Implementar `useCallback` para handlers
- [ ] Lazy loading de tabs
- [ ] Separar en server + client component
- [ ] Testing completo

### components/layout/app-shell.tsx
- [ ] Separar en app-shell.tsx (server) + app-shell-client.tsx
- [ ] Mover lógica de estado a cliente
- [ ] Optimizar re-renders
- [ ] Testing de navegación

---

**¿Listo para comenzar la implementación?** 🚀

Vamos a empezar con las optimizaciones de Fase 1 que darán el mayor impacto inmediato.

