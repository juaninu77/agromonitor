import type { LucideIcon } from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  label?: string
  badge?: number
}

export type KpiCardData = {
  title: string
  value: string
  change: string
  changeType: "increase" | "decrease"
  description: string
  icon: LucideIcon
  trend?: number[]
  target?: string
}

export type AlertData = {
  id: string
  title: string
  description: string
  timestamp: string
  type: "alert" | "warn" | "info" | "success"
  read: boolean
  priority: "low" | "medium" | "high" | "critical"
  category: string
  actionRequired?: boolean
}

export type Company = {
  id: string
  name: string
  logo: string
}

export type Vehicle = {
  id: string
  name: string
  type: "tractor" | "harvester" | "truck" | "sprayer"
  status: "active" | "inactive" | "maintenance" | "emergency"
  location: string
  coordinates?: { lat: number; lng: number }
  fuelLevel: number
  lastMaintenance: string
  nextMaintenance: string
  hoursWorked: number
  maxHours: number
  driver: string
  issues: string[]
  efficiency?: number
  costPerHour?: number
}

export type BiblicalVerse = {
  text: string
  reference: string
}

export type Task = {
  id: string
  title: string
  description: string
  priority: "low" | "medium" | "high" | "urgent"
  status: "pending" | "in-progress" | "completed" | "overdue"
  assignedTo: string
  dueDate: string
  category: string
  location?: string
  estimatedHours?: number
  completedAt?: string
}

export type WeatherData = {
  temperature: number
  condition: string
  humidity: number
  windSpeed: number
  windDirection: string
  visibility: number
  uvIndex: number
  pressure: number
  forecast: {
    day: string
    high: number
    low: number
    condition: string
    precipitation: number
  }[]
}

export type InventoryItem = {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  minStock: number
  maxStock: number
  cost: number
  supplier: string
  lastRestocked: string
  location: string
  expiryDate?: string
}

export type FinancialData = {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  cashFlow: number
  monthlyData: {
    month: string
    revenue: number
    expenses: number
    profit: number
  }[]
}

export type Notification = {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  timestamp: string
  read: boolean
  actionUrl?: string
  actionText?: string
}

export type Widget = {
  id: string
  title: string
  type: "kpi" | "chart" | "list" | "map" | "weather" | "tasks"
  size: "small" | "medium" | "large"
  position: { x: number; y: number }
  data?: any
  settings?: any
}

export type MapLayer = {
  id: string
  name: string
  visible: boolean
  color: string
  icon: LucideIcon
}

export type MapZone = {
  id: string
  name: string
  type: "potrero" | "cultivo" | "infraestructura" | "agua"
  coordinates: { lat: number; lng: number }[]
  center: { lat: number; lng: number }
  area: number // hectáreas
  status: "bueno" | "regular" | "malo" | "critico"
  details: {
    ganado?: number
    cultivo?: string
    estado?: string
    ultimaInspeccion?: string
    responsable?: string
  }
}

export type MapMarker = {
  id: string
  name: string
  type: "vehiculo" | "sensor" | "infraestructura" | "alerta" | "agua"
  coordinates: { lat: number; lng: number }
  status: "activo" | "inactivo" | "alerta" | "mantenimiento"
  details: any
  icon: LucideIcon
}

export type WeatherStation = {
  id: string
  name: string
  coordinates: { lat: number; lng: number }
  temperature: number
  humidity: number
  windSpeed: number
  rainfall: number
  soilMoisture: number
  lastUpdate: string
}

// ============================================
// TIPOS PARA GESTIÓN DE GANADO - Schema v3
// ============================================
// Basados en el nuevo modelo de datos con Event Sourcing

export type Sexo = 'M' | 'F'
export type OrigenAnimal = 'cria_propia' | 'compra' | 'transferencia' | 'donacion'
export type EstadoCastracion = 'entero' | 'castrado' | 'criptorquido'
export type Denticion = 'DL' | '2D' | '4D' | '6D' | 'BL' | 'MD'

// Animal principal (bovino u ovino)
export type Animal = {
  id: string
  especieId: string
  razaId: string
  categoriaId: string
  sexo: Sexo
  cuig?: string                    // CUIG oficial (bovinos)
  caravanaVisual?: string          // Número de caravana visual
  caravanaRfid?: string            // RFID electrónico
  otroId?: string                  // Nombre o identificador alternativo
  fechaNacimiento?: string
  origen: OrigenAnimal
  colorManto?: string
  estadoCastracion?: EstadoCastracion
  denticion?: Denticion
  esCabana: boolean
  registroCabana?: string
  notas?: string
  createdAt: string
  updatedAt: string
  // Relaciones expandidas
  especie?: Especie
  raza?: Raza
  categoria?: Categoria
  loteActual?: Lote
  sectorActual?: Sector
  ultimoPeso?: EvtPesada
}

export type Especie = {
  id: string
  nombre: 'bovino' | 'ovino'
  descripcion?: string
}

export type Raza = {
  id: string
  especieId: string
  nombre: string
  descripcion?: string
  especie?: Especie
}

export type Categoria = {
  id: string
  especieId: string
  nombre: string
  sexo: Sexo
  edadMinMeses?: number
  edadMaxMeses?: number
  descripcion?: string
  especie?: Especie
}

// Evento de pesada
export type EvtPesada = {
  id: string
  animalId: string
  fecha: string
  pesoKg: number
  cc?: number                      // Condición corporal 1-9
  gdpKg?: number                   // Ganancia diaria calculada
  metodo?: string
  observaciones?: string
}

// Evento de sanidad
export type EvtSanidad = {
  id: string
  animalId?: string
  loteId?: string
  cantidadAnimales?: number
  fecha: string
  productoId: string
  producto?: Producto
  dosis?: number
  unidad?: string
  via?: string
  motivo?: string
  carenciaDias?: number
  aplicador?: string
  veterinario?: string
  observaciones?: string
}

// Producto sanitario
export type Producto = {
  id: string
  nombre: string
  tipo: string
  principioActivo?: string
  laboratorio?: string
  retiroDias?: number
}

// Lote/Rodeo
export type Lote = {
  id: string
  nombre: string
  tipo: 'reproductivo' | 'recria' | 'engorde' | 'descarte' | 'cuarentena'
  especieId: string
  establecimientoId: string
  objetivo?: string
  createdAt: string
  especie?: Especie
  establecimiento?: Establecimiento
  cantidadAnimales?: number
}

// Sector (potrero, corral, etc.)
export type Sector = {
  id: string
  establecimientoId: string
  nombre: string
  tipo: 'potrero' | 'corral' | 'manga' | 'bañadero' | 'deposito'
  superficieHa?: number
  uso?: string
  capacidad?: number
  tieneAgua?: boolean
  tieneSombra?: boolean
  tieneBalanza?: boolean
  establecimiento?: Establecimiento
}

// Establecimiento/Campo
export type Establecimiento = {
  id: string
  organizacionId: string
  nombre: string
  ubicacion?: string
  renspa?: string
  provincia?: string
  localidad?: string
  hectareas?: number
  sectores?: Sector[]
}

// Genealogía
export type Genealogia = {
  id: string
  animalId: string
  padreId?: string
  madreId?: string
  padreExterno?: string
  madreExterno?: string
  padre?: Animal
  madre?: Animal
}

// Torada (temporada de servicio)
export type Torada = {
  id: string
  nombre: string
  loteId: string
  fechaInicio: string
  fechaFin?: string
  tipo: 'natural' | 'ia' | 'te'
  cantidadHembras?: number
  cantidadMachos?: number
  porcentajeToros?: number
}

// Evento de servicio
export type EvtServicio = {
  id: string
  hembraId: string
  machoId?: string
  toradaId?: string
  fecha: string
  tipo: 'natural' | 'ia' | 'te'
  pajuela?: string
  inseminador?: string
  observaciones?: string
}

// Evento de tacto
export type EvtTacto = {
  id: string
  hembraId: string
  fecha: string
  resultado: 'preñada' | 'vacia' | 'dudosa' | 'absorbio'
  mesesGest?: number
  fechaProbableParto?: string
  metodo?: string
  veterinario?: string
  observaciones?: string
}

// Evento de parición
export type EvtParicion = {
  id: string
  madreId: string
  criaId?: string
  fecha: string
  tipoParto?: string
  dificultadParto?: number
  pesoNacimientoKg?: number
  viabilidadCria?: string
  observaciones?: string
}

// Evento de destete
export type EvtDestete = {
  id: string
  criaId: string
  madreId?: string
  fecha: string
  pesoKg?: number
  edad_dias?: number
  observaciones?: string
}

// Evento de baja
export type EvtBaja = {
  id: string
  animalId: string
  fecha: string
  motivo: 'venta' | 'muerte' | 'faena' | 'robo' | 'transferencia' | 'otro'
  detalle?: string
  clienteId?: string
  documentoTransitoId?: string
  precioVenta?: number
  pesoVenta?: number
  observaciones?: string
}

// Dieta
export type Dieta = {
  id: string
  nombre: string
  objetivo?: string
  msObjetivoKg?: number
  proteinaPct?: number
  energiaMcal?: number
  componentes?: DietaComponente[]
}

export type DietaComponente = {
  id: string
  dietaId: string
  insumo: string
  proporcionPct: number
}

// Plan de alimentación
export type PlanAlimentacion = {
  id: string
  loteId: string
  dietaId: string
  desde: string
  hasta?: string
  msDiaPlanKg?: number
  dieta?: Dieta
}

// Forraje
export type Forraje = {
  id: string
  nombre: string
  tipo: 'perenne' | 'anual'
  clase: 'pastura' | 'verdeo' | 'cultivo'
}

// ============================================
// TIPOS AUXILIARES PARA UI
// ============================================

// Resumen de rodeo para dashboard
export type HerdOverview = {
  totalAnimales: number
  vacasMadres: number
  toros: number
  novillos: number
  vaquillonas: number
  terneros: number
  pesoPromedio: number
  gdpPromedio: number
  tasaParicion: number
  tasaMortalidad: number
  ccPromedio: number
}

// Animal con datos expandidos para UI
export type AnimalConDetalles = Animal & {
  edad?: string
  pesoActual?: number
  ccActual?: number
  gdpActual?: number
  ubicacion?: string
  lote?: string
  valorMercado?: number
  alertas?: string[]
  estadoSalud?: 'Saludable' | 'Atención' | 'Crítico'
}

// Filtros de búsqueda
export type FiltrosGanado = {
  especie?: string
  categoria?: string
  lote?: string
  sector?: string
  estado?: string
  busqueda?: string
}

// ============================================
// TIPOS LEGACY MANTENIDOS POR COMPATIBILIDAD
// ============================================
// Estos tipos se mantienen para compatibilidad con componentes existentes
// que aún no han sido migrados al nuevo schema

export type HistorialEvento = {
  id: string
  tipo: 'nacimiento' | 'compra' | 'venta' | 'movimiento' | 'sanitario' | 'muerte' | 'esquila' | 'encaste' | 'destete' | 'peso'
  fecha: string
  descripcion: string
  precio?: number
  peso?: number
  destino?: string
  origen?: string
  operario?: string
  veterinario?: string
  producto?: string
  dosis?: string
  observaciones?: string
}
