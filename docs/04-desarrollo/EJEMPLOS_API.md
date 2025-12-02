# Ejemplos de Uso de la API

## APIs Creadas

Se han creado las siguientes API routes de ejemplo:

- `GET /api/ganado/bovinos` - Obtener bovinos (con filtros)
- `POST /api/ganado/bovinos` - Crear nuevo bovino
- `GET /api/ganado/ovinos` - Obtener ovinos (con filtros)
- `POST /api/ganado/ovinos` - Crear nuevo ovino

---

## 📖 Ejemplos desde el Frontend

### 1. Obtener todos los bovinos

```typescript
// app/ganado/bovinos/page.tsx
'use client'

import { useEffect, useState } from 'react'

export default function BovinosPage() {
  const [bovinos, setBovinos] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBovinos() {
      try {
        const res = await fetch('/api/ganado/bovinos')
        const data = await res.json()

        if (data.success) {
          setBovinos(data.data)
          setStats(data.stats)
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBovinos()
  }, [])

  if (loading) return <div>Cargando...</div>

  return (
    <div>
      <h1>Bovinos</h1>
      <p>Total: {stats?.total}</p>
      <p>Vacas: {stats?.porCategoria.vacas}</p>
      <p>Toros: {stats?.porCategoria.toros}</p>

      <ul>
        {bovinos.map((bovino) => (
          <li key={bovino.id}>
            {bovino.numero} - {bovino.categoria} - {bovino.campo.nombre}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### 2. Filtrar bovinos por campo

```typescript
const res = await fetch('/api/ganado/bovinos?campo=Chacra Alberto')
```

### 3. Filtrar por categoría y estado

```typescript
const res = await fetch('/api/ganado/bovinos?categoria=vaca&estado=activo')
```

### 4. Crear nuevo bovino

```typescript
async function crearBovino() {
  const nuevoBovino = {
    numero: '1234',
    cuig: 'XX-1234',
    categoria: 'vaca',
    raza: 'Angus Negro',
    peso: 450,
    fechaNacimiento: '2020-01-15',
    campoId: 'campo-1', // ID del campo
    estado: 'activo'
  }

  const res = await fetch('/api/ganado/bovinos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(nuevoBovino)
  })

  const data = await res.json()

  if (data.success) {
    console.log('Bovino creado:', data.data)
  }
}
```

### 5. Obtener ovinos por color de marca

```typescript
const res = await fetch('/api/ganado/ovinos?color=rojo')
const data = await res.json()

console.log('Ovinos rojos:', data.data)
console.log('Total:', data.stats.total)
```

---

## 🔍 Búsqueda Avanzada con Prisma

### En tus API routes puedes hacer consultas más complejas:

```typescript
// Buscar bovinos con peso mayor a 400kg
const bovinos = await prisma.bovino.findMany({
  where: {
    peso: { gte: 400 },
    estado: 'activo'
  }
})

// Buscar ovinos nacidos en un año específico
const ovinos = await prisma.ovino.findMany({
  where: {
    anioNacimiento: 2023
  }
})

// Buscar animales de un campo específico con condición corporal
const animales = await prisma.bovino.findMany({
  where: {
    campo: { nombre: 'Chacra Alberto' },
    condicionCorporal: { gte: 6, lte: 7 }
  },
  include: {
    campo: true
  }
})

// Contar animales por categoría
const count = await prisma.bovino.groupBy({
  by: ['categoria'],
  _count: true
})
```

---

## 🔐 Ejemplo con Server Components (Next.js 15)

```typescript
// app/ganado/bovinos/page.tsx (Server Component)
import { prisma } from '@/lib/prisma'

export default async function BovinosPage() {
  // Consulta directa en el servidor
  const bovinos = await prisma.bovino.findMany({
    where: { estado: 'activo' },
    include: { campo: true },
    orderBy: { numero: 'asc' }
  })

  const stats = {
    total: bovinos.length,
    vacas: bovinos.filter(b => b.categoria === 'vaca').length,
    toros: bovinos.filter(b => b.categoria === 'toro').length
  }

  return (
    <div>
      <h1>Bovinos - {stats.total} animales</h1>
      {/* ... */}
    </div>
  )
}
```

---

## 💡 Tips

- Usa **Server Components** cuando puedas (más rápido, menos JS en cliente)
- Usa **Client Components** solo cuando necesites interactividad
- Implementa **React Query** o **SWR** para caché y actualización automática

