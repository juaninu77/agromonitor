/**
 * Datos simulados para la gestión de ganado bovino
 * Extraído para optimización de rendimiento
 */

export interface Animal {
  id: string
  name: string
  tagNumber: string
  breed: string
  birthDate: string
  age: string
  weight: number
  bodyConditionScore: number
  category: string
  dailyGain: number
  reproductiveStatus: string
  offspring: number
  expectedProgeny: number
  healthStatus: string
  lastVaccination: string
  nextVaccination: string
  geneticValue: number
  location: string
  alerts: string[]
  marketValue: number
  feedEfficiency: number
}

export interface WeightRecord {
  date: string
  weight: number
  gain: number
  bodyCondition: number
}

export interface ReproductiveEvent {
  event: string
  date: string
  details: string
  outcome: string
}

export interface HealthRecord {
  date: string
  type: string
  treatment: string
  veterinarian: string
  notes: string
  cost: number
}

export interface RationIngredient {
  ingredient: string
  amount: number
  percentage: number
}

export interface NutritionPlan {
  dailyDryMatter: number
  crudeProtein: number
  metabolizableEnergy: number
  neutralDetergentFiber: number
  calcium: number
  phosphorus: number
  feedEfficiency: number
  feedCost: number
  ration: RationIngredient[]
}

export interface GeneticData {
  pedigree: {
    sire: string
    dam: string
    maternalGrandSire: string
  }
  breedingValues: {
    birthWeight: string
    weaningWeight: string
    yearlingWeight: string
    matureWeight: string
    marbling: string
    ribeye: string
    backfat: string
    maternalMilk: string
  }
  genomicReliability: number
}

export interface LivestockData {
  herdOverview: {
    totalAnimals: number
    breedingCows: number
    bulls: number
    steers: number
    heifers: number
    calves: number
    averageWeight: number
    averageDailyGain: number
    calvingRate: number
    mortalityRate: number
    averageBodyCondition: number
  }
  animalsList: Animal[]
  selectedAnimal: Animal
  weightRecords: WeightRecord[]
  reproductiveHistory: ReproductiveEvent[]
  healthRecords: HealthRecord[]
  nutritionPlan: NutritionPlan
  geneticData: GeneticData
}

// Datos simulados para ganado de carne
export const livestockData: LivestockData = {
  herdOverview: {
    totalAnimals: 485,
    breedingCows: 180,
    bulls: 12,
    steers: 145,
    heifers: 98,
    calves: 50,
    averageWeight: 520,
    averageDailyGain: 1.2,
    calvingRate: 92.5,
    mortalityRate: 1.8,
    averageBodyCondition: 6.5, // Escala 1-9 para carne
  },
  animalsList: [
    {
      id: "BEEF-001",
      name: "Toro Campeón",
      tagNumber: "T-2456",
      breed: "Angus Negro",
      birthDate: "2020-03-15",
      age: "4 años 3 meses",
      weight: 850,
      bodyConditionScore: 7.5,
      category: "Toro Reproductor",
      dailyGain: 0.8,
      reproductiveStatus: "Activo",
      offspring: 45,
      expectedProgeny: 25,
      healthStatus: "Saludable",
      lastVaccination: "2024-05-15",
      nextVaccination: "2024-08-15",
      geneticValue: 2150,
      location: "Potrero Reproductores",
      alerts: [],
      marketValue: 3500,
      feedEfficiency: 6.2,
    },
    {
      id: "BEEF-002",
      name: "Novillo Premium",
      tagNumber: "N-2457",
      breed: "Hereford",
      birthDate: "2022-01-20",
      age: "2 años 5 meses",
      weight: 520,
      bodyConditionScore: 6.8,
      category: "Novillo",
      dailyGain: 1.4,
      reproductiveStatus: "N/A",
      offspring: 0,
      expectedProgeny: 0,
      healthStatus: "Saludable",
      lastVaccination: "2024-04-20",
      nextVaccination: "2024-07-20",
      geneticValue: 1850,
      location: "Potrero Engorde A",
      alerts: [],
      marketValue: 1850,
      feedEfficiency: 7.1,
    },
    {
      id: "BEEF-003",
      name: "Vaquillona Elite",
      tagNumber: "V-2458",
      breed: "Brangus",
      birthDate: "2022-06-10",
      age: "2 años",
      weight: 420,
      bodyConditionScore: 6.2,
      category: "Vaquillona",
      dailyGain: 1.1,
      reproductiveStatus: "Preñada",
      offspring: 0,
      expectedProgeny: 1,
      healthStatus: "Saludable",
      lastVaccination: "2024-03-15",
      nextVaccination: "2024-06-15",
      geneticValue: 1920,
      location: "Potrero Vaquillonas",
      alerts: [],
      marketValue: 1680,
      feedEfficiency: 6.8,
    },
    {
      id: "BEEF-004",
      name: "Ternero Promesa",
      tagNumber: "T-2459",
      breed: "Angus Colorado",
      birthDate: "2023-11-05",
      age: "8 meses",
      weight: 280,
      bodyConditionScore: 6.5,
      category: "Ternero",
      dailyGain: 1.6,
      reproductiveStatus: "N/A",
      offspring: 0,
      expectedProgeny: 0,
      healthStatus: "Atención",
      lastVaccination: "2024-05-01",
      nextVaccination: "2024-08-01",
      geneticValue: 1780,
      location: "Potrero Terneros",
      alerts: ["Peso bajo para la edad"],
      marketValue: 980,
      feedEfficiency: 5.9,
    },
  ],
  selectedAnimal: {
    id: "BEEF-001",
    name: "Toro Campeón",
    tagNumber: "T-2456",
    breed: "Angus Negro",
    birthDate: "2020-03-15",
    age: "4 años 3 meses",
    weight: 850,
    bodyConditionScore: 7.5,
    category: "Toro Reproductor",
    dailyGain: 0.8,
    reproductiveStatus: "Activo",
    offspring: 45,
    expectedProgeny: 25,
    healthStatus: "Saludable",
    lastVaccination: "2024-05-15",
    nextVaccination: "2024-08-15",
    geneticValue: 2150,
    location: "Potrero Reproductores",
    marketValue: 3500,
    feedEfficiency: 6.2,
    alerts: [],
  },
  weightRecords: [
    { date: "2024-06-20", weight: 850, gain: 0.8, bodyCondition: 7.5 },
    { date: "2024-05-20", weight: 826, gain: 0.9, bodyCondition: 7.2 },
    { date: "2024-04-20", weight: 799, gain: 1.1, bodyCondition: 7.0 },
    { date: "2024-03-20", weight: 765, gain: 1.0, bodyCondition: 6.8 },
    { date: "2024-02-20", weight: 735, gain: 0.7, bodyCondition: 6.5 },
    { date: "2024-01-20", weight: 714, gain: 0.8, bodyCondition: 6.3 },
    { date: "2023-12-20", weight: 690, gain: 0.9, bodyCondition: 6.0 },
  ],
  reproductiveHistory: [
    {
      event: "Servicio",
      date: "2024-01-15",
      details: "Servicio natural con 8 vacas, temporada reproductiva 2024",
      outcome: "Exitoso",
    },
    {
      event: "Evaluación reproductiva",
      date: "2024-04-10",
      details: "Examen andrológico completo, calidad seminal excelente",
      outcome: "Apto para reproducción",
    },
    {
      event: "Descendencia",
      date: "2024-05-15",
      details: "Nacimiento de 6 terneros de su servicio anterior",
      outcome: "100% viabilidad",
    },
  ],
  healthRecords: [
    {
      date: "2024-06-01",
      type: "Vacunación",
      treatment: "Vacuna Clostridiosis + Carbunco",
      veterinarian: "Dr. Martínez",
      notes: "Aplicación preventiva anual",
      cost: 35.0,
    },
    {
      date: "2024-05-20",
      type: "Desparasitación",
      treatment: "Ivermectina + Levamisol",
      veterinarian: "Dr. López",
      notes: "Tratamiento preventivo contra parásitos internos y externos",
      cost: 25.0,
    },
    {
      date: "2024-04-15",
      type: "Chequeo",
      treatment: "Examen andrológico completo",
      veterinarian: "Dr. García",
      notes: "Evaluación de capacidad reproductiva, resultado excelente",
      cost: 80.0,
    },
  ],
  nutritionPlan: {
    dailyDryMatter: 18.5,
    crudeProtein: 14.2,
    metabolizableEnergy: 2.45,
    neutralDetergentFiber: 45.8,
    calcium: 0.65,
    phosphorus: 0.38,
    feedEfficiency: 6.2,
    feedCost: 12.5,
    ration: [
      { ingredient: "Pastura natural", amount: 12.5, percentage: 67.6 },
      { ingredient: "Suplemento proteico", amount: 2.8, percentage: 15.1 },
      { ingredient: "Grano de maíz", amount: 2.2, percentage: 11.9 },
      { ingredient: "Heno de alfalfa", amount: 0.8, percentage: 4.3 },
      { ingredient: "Sales minerales", amount: 0.2, percentage: 1.1 },
    ],
  },
  geneticData: {
    pedigree: {
      sire: "Angus Elite Champion 2018",
      dam: "Vaca Madre Superior",
      maternalGrandSire: "Toro Abuelo Materno",
    },
    breedingValues: {
      birthWeight: "+2.8 kg",
      weaningWeight: "+35 kg",
      yearlingWeight: "+58 kg",
      matureWeight: "+85 kg",
      marbling: "+0.45",
      ribeye: "+1.2 cm²",
      backfat: "-1.8 mm",
      maternalMilk: "+18 kg",
    },
    genomicReliability: 88,
  },
}

