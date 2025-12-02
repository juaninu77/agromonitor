/**
 * Datos simulados para la gestión de cultivos
 * Extraído para optimización de rendimiento
 */

export interface PlantingInfo {
  id: string
  crop: string
  plot: string
  area: number
  plantingDate: string
  expectedHarvest: string
  currentStage: string
  stageProgress: number
  daysAfterPlanting: number
  thermalUnits: number
  requiredThermalUnits: number
  plantPopulation: number
  estimatedYield: number
  healthStatus: string
  riskLevel: string
  lastInspection: string
  issues: string[]
  irrigationStatus: string
  soilMoisture: number
  weatherRisk: string
}

export interface PhenologyStage {
  stage: string
  date: string
  percentage: number
  observations: string
}

export interface NutrientPlan {
  nutrient: string
  applied: number
  recommended: number
  unit: string
  status: string
  nextApplication: string | null
  source: string
}

export interface PestRecord {
  type: string
  name: string
  scientificName: string
  currentLevel: number
  economicThreshold: number
  status: string
  lastTreatment: string | null
  recommendedAction: string
}

export interface IrrigationData {
  currentSoilMoisture: number
  fieldCapacity: number
  wiltingPoint: number
  availableWater: number
  cropCoefficient: number
  dailyET: number
  weeklyRequirement: number
  lastIrrigation: string
  nextIrrigation: string
  irrigationEfficiency: number
  totalSeasonWater: number
}

export interface SoilAnalysis {
  pH: number
  organicMatter: number
  nitrogen: number
  phosphorus: number
  potassium: number
  calcium: number
  magnesium: number
  sulfur: number
  cec: number
  texture: string
  bulkDensity: number
  infiltrationRate: number
  recommendations: string[]
}

export interface CropData {
  activePlantings: PlantingInfo[]
  selectedCrop: PlantingInfo
  phenologyData: PhenologyStage[]
  nutritionPlan: NutrientPlan[]
  pestManagement: PestRecord[]
  irrigationData: IrrigationData
  soilAnalysis: SoilAnalysis
}

// Datos simulados desde perspectiva agronómica
export const cropData: CropData = {
  activePlantings: [
    {
      id: "1",
      crop: "Maíz Híbrido DK-390",
      plot: "Lote Norte A-1",
      area: 25.5,
      plantingDate: "2024-03-15",
      expectedHarvest: "2024-07-20",
      currentStage: "Floración (R1)",
      stageProgress: 65,
      daysAfterPlanting: 95,
      thermalUnits: 1250,
      requiredThermalUnits: 1800,
      plantPopulation: 75000,
      estimatedYield: 12.5,
      healthStatus: "Bueno",
      riskLevel: "Bajo",
      lastInspection: "2024-06-15",
      issues: [],
      irrigationStatus: "Óptimo",
      soilMoisture: 65,
      weatherRisk: "Bajo",
    },
    {
      id: "2",
      crop: "Soja RR Intacta",
      plot: "Lote Sur B-3",
      area: 18.2,
      plantingDate: "2024-04-01",
      expectedHarvest: "2024-08-15",
      currentStage: "Llenado de Granos (R5)",
      stageProgress: 80,
      daysAfterPlanting: 75,
      thermalUnits: 980,
      requiredThermalUnits: 1200,
      plantPopulation: 320000,
      estimatedYield: 3.8,
      healthStatus: "Excelente",
      riskLevel: "Muy Bajo",
      lastInspection: "2024-06-18",
      issues: [],
      irrigationStatus: "Bueno",
      soilMoisture: 58,
      weatherRisk: "Bajo",
    },
    {
      id: "3",
      crop: "Trigo Baguette 31",
      plot: "Lote Este C-2",
      area: 32.0,
      plantingDate: "2024-05-10",
      expectedHarvest: "2024-09-25",
      currentStage: "Macollaje (Z25)",
      stageProgress: 35,
      daysAfterPlanting: 40,
      thermalUnits: 420,
      requiredThermalUnits: 1600,
      plantPopulation: 4500000,
      estimatedYield: 4.2,
      healthStatus: "Regular",
      riskLevel: "Medio",
      lastInspection: "2024-06-20",
      issues: ["Presión de malezas", "Deficiencia de Nitrógeno"],
      irrigationStatus: "Atención",
      soilMoisture: 42,
      weatherRisk: "Medio",
    },
    {
      id: "4",
      crop: "Girasol Alto Oleico",
      plot: "Lote Oeste D-1",
      area: 15.8,
      plantingDate: "2024-04-20",
      expectedHarvest: "2024-08-30",
      currentStage: "Botón Floral (R4)",
      stageProgress: 55,
      daysAfterPlanting: 60,
      thermalUnits: 720,
      requiredThermalUnits: 1400,
      plantPopulation: 55000,
      estimatedYield: 2.8,
      healthStatus: "Bueno",
      riskLevel: "Bajo",
      lastInspection: "2024-06-19",
      issues: [],
      irrigationStatus: "Óptimo",
      soilMoisture: 62,
      weatherRisk: "Bajo",
    },
  ],
  selectedCrop: {
    id: "1",
    crop: "Maíz Híbrido DK-390",
    plot: "Lote Norte A-1",
    area: 25.5,
    plantingDate: "2024-03-15",
    expectedHarvest: "2024-07-20",
    currentStage: "Floración (R1)",
    stageProgress: 65,
    daysAfterPlanting: 95,
    thermalUnits: 1250,
    requiredThermalUnits: 1800,
    plantPopulation: 75000,
    estimatedYield: 12.5,
    healthStatus: "Bueno",
    riskLevel: "Bajo",
    lastInspection: "2024-06-15",
    issues: [],
    irrigationStatus: "Óptimo",
    soilMoisture: 65,
    weatherRisk: "Bajo",
  },
  phenologyData: [
    {
      stage: "Emergencia",
      date: "2024-03-25",
      percentage: 100,
      observations: "Emergencia uniforme, 95% de plantas emergidas",
    },
    {
      stage: "V6 (6 hojas)",
      date: "2024-04-20",
      percentage: 100,
      observations: "Desarrollo vegetativo normal, aplicación de herbicida",
    },
    {
      stage: "V12 (12 hojas)",
      date: "2024-05-15",
      percentage: 100,
      observations: "Primera fertilización nitrogenada aplicada",
    },
    {
      stage: "VT (Panojamiento)",
      date: "2024-06-01",
      percentage: 100,
      observations: "Inicio de diferenciación floral",
    },
    {
      stage: "R1 (Floración)",
      date: "2024-06-15",
      percentage: 65,
      observations: "Floración en progreso, condiciones favorables",
    },
  ],
  nutritionPlan: [
    {
      nutrient: "Nitrógeno (N)",
      applied: 180,
      recommended: 220,
      unit: "kg/ha",
      status: "Pendiente",
      nextApplication: "2024-06-25",
      source: "Urea 46%",
    },
    {
      nutrient: "Fósforo (P2O5)",
      applied: 80,
      recommended: 80,
      unit: "kg/ha",
      status: "Completo",
      nextApplication: null,
      source: "Fosfato Diamónico",
    },
    {
      nutrient: "Potasio (K2O)",
      applied: 60,
      recommended: 100,
      unit: "kg/ha",
      status: "Pendiente",
      nextApplication: "2024-07-01",
      source: "Cloruro de Potasio",
    },
  ],
  pestManagement: [
    {
      type: "Plaga",
      name: "Cogollero del Maíz",
      scientificName: "Spodoptera frugiperda",
      currentLevel: 2,
      economicThreshold: 3,
      status: "Monitoreo",
      lastTreatment: null,
      recommendedAction: "Continuar monitoreo semanal",
    },
    {
      type: "Enfermedad",
      name: "Roya del Maíz",
      scientificName: "Puccinia sorghi",
      currentLevel: 1,
      economicThreshold: 4,
      status: "Bajo Control",
      lastTreatment: null,
      recommendedAction: "Monitoreo preventivo",
    },
    {
      type: "Maleza",
      name: "Yuyo Colorado",
      scientificName: "Amaranthus quitensis",
      currentLevel: 3,
      economicThreshold: 2,
      status: "Requiere Acción",
      lastTreatment: "2024-06-10",
      recommendedAction: "Aplicación de herbicida selectivo",
    },
  ],
  irrigationData: {
    currentSoilMoisture: 65,
    fieldCapacity: 100,
    wiltingPoint: 25,
    availableWater: 53,
    cropCoefficient: 1.2,
    dailyET: 6.5,
    weeklyRequirement: 45.5,
    lastIrrigation: "2024-06-18",
    nextIrrigation: "2024-06-22",
    irrigationEfficiency: 85,
    totalSeasonWater: 450,
  },
  soilAnalysis: {
    pH: 6.8,
    organicMatter: 3.2,
    nitrogen: 45,
    phosphorus: 28,
    potassium: 180,
    calcium: 2400,
    magnesium: 320,
    sulfur: 12,
    cec: 18.5,
    texture: "Franco Limoso",
    bulkDensity: 1.35,
    infiltrationRate: 2.5,
    recommendations: [
      "Mantener niveles de materia orgánica",
      "Aplicar azufre para mejorar disponibilidad de nutrientes",
      "Considerar encalado ligero para próxima temporada",
    ],
  },
}

