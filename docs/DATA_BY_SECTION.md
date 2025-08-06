# 📊 Datos por Sección - Plataforma de Agricultura Inteligente

## 🎯 Visión General

Este documento detalla los datos específicos que se muestran en cada sección de la plataforma, organizados por módulos funcionales y roles de usuario.

---

## 🏠 Dashboard Principal

### KPIs Principales
- **Producción Total Diaria**: Litros de leche, kg de carne, toneladas de granos
- **Eficiencia Operativa**: % de utilización de recursos, conversión alimenticia
- **Salud del Hato**: % animales saludables, alertas sanitarias activas
- **Estado de Cultivos**: % de cultivos en etapa óptima, alertas fitosanitarias
- **Indicadores Financieros**: Ingresos diarios, costos operativos, margen bruto
- **Condiciones Ambientales**: Temperatura, humedad, precipitación, viento

### Widgets Dinámicos
- **Clima en Tiempo Real**: Temperatura actual, pronóstico 7 días, alertas meteorológicas
- **Alertas Prioritarias**: Notificaciones críticas por color (rojo, amarillo, verde)
- **Tareas Pendientes**: Lista de actividades programadas para hoy
- **Resumen de Producción**: Gráficos de tendencias semanales/mensuales
- **Estado de Dispositivos IoT**: Sensores online/offline, nivel de batería
- **Mapa Interactivo**: Vista satelital con overlays de datos

---

## 🌱 Módulo de Cultivos

### Vista General de Cultivos
\`\`\`json
{
  "cultivos_activos": [
    {
      "id": "cultivo_001",
      "nombre": "Maíz Híbrido DK-390",
      "lote": "Lote Norte A-1",
      "area_hectareas": 25.5,
      "fecha_siembra": "2024-03-15",
      "dias_desde_siembra": 95,
      "etapa_actual": "Floración (R1)",
      "progreso_etapa": 65,
      "rendimiento_estimado": 12.5,
      "estado_salud": "Bueno",
      "nivel_riesgo": "Bajo",
      "proxima_actividad": "Aplicación fungicida",
      "fecha_proxima_actividad": "2024-06-25"
    }
  ],
  "resumen_produccion": {
    "total_hectareas": 156.8,
    "cultivos_activos": 8,
    "rendimiento_promedio": 11.2,
    "eficiencia_agua": 85.3,
    "costo_por_hectarea": 1250.00
  }
}
\`\`\`

### Datos Fenológicos Detallados
\`\`\`json
{
  "fenologia": {
    "etapas_completadas": [
      {
        "codigo": "VE",
        "nombre": "Emergencia",
        "fecha": "2024-03-25",
        "porcentaje": 100,
        "observaciones": "Emergencia uniforme, 95% de plantas emergidas"
      },
      {
        "codigo": "V6",
        "nombre": "6 hojas verdaderas",
        "fecha": "2024-04-20",
        "porcentaje": 100,
        "observaciones": "Desarrollo vegetativo normal"
      }
    ],
    "etapa_actual": {
      "codigo": "R1",
      "nombre": "Floración",
      "inicio": "2024-06-10",
      "porcentaje": 65,
      "unidades_termicas": 1250,
      "unidades_requeridas": 1800
    },
    "proyeccion_cosecha": {
      "fecha_estimada": "2024-07-20",
      "dias_restantes": 35,
      "condiciones_requeridas": "Temperatura 25-30°C, sin heladas"
    }
  }
}
\`\`\`

### Plan Nutricional
\`\`\`json
{
  "nutricion": {
    "analisis_suelo": {
      "fecha": "2024-02-15",
      "ph": 6.8,
      "materia_organica": 3.2,
      "nitrogeno": 45,
      "fosforo": 28,
      "potasio": 180,
      "recomendaciones": [
        "Aplicar 40 kg/ha de N en V8",
        "Considerar aplicación foliar de micronutrientes"
      ]
    },
    "programa_fertilizacion": [
      {
        "nutriente": "Nitrógeno",
        "aplicado": 180,
        "recomendado": 220,
        "pendiente": 40,
        "proxima_fecha": "2024-06-25",
        "fuente": "Urea 46%"
      }
    ],
    "costo_total": 285.50
  }
}
\`\`\`

### Manejo Fitosanitario
\`\`\`json
{
  "sanidad": {
    "monitoreo_plagas": [
      {
        "plaga": "Cogollero del Maíz",
        "nombre_cientifico": "Spodoptera frugiperda",
        "nivel_actual": 2,
        "umbral_economico": 3,
        "estado": "Monitoreo",
        "ultima_evaluacion": "2024-06-18",
        "accion_recomendada": "Continuar monitoreo semanal"
      }
    ],
    "aplicaciones_realizadas": [
      {
        "fecha": "2024-05-10",
        "producto": "Herbicida Atrazina",
        "dosis": "2.5 L/ha",
        "objetivo": "Control de malezas",
        "costo": 125.00
      }
    ],
    "proximas_aplicaciones": [
      {
        "fecha_programada": "2024-06-25",
        "producto": "Fungicida Triazol",
        "objetivo": "Prevención de roya",
        "costo_estimado": 95.00
      }
    ]
  }
}
\`\`\`

### Sistema de Riego
\`\`\`json
{
  "riego": {
    "estado_hidrico": {
      "humedad_suelo": 65,
      "capacidad_campo": 100,
      "punto_marchitez": 25,
      "agua_disponible": 53,
      "deficit_hidrico": 0
    },
    "programacion": {
      "ultimo_riego": "2024-06-18",
      "proximo_riego": "2024-06-22",
      "lamina_requerida": 25,
      "duracion_estimada": 4.5,
      "costo_energia": 45.20
    },
    "eficiencia": {
      "uniformidad": 85,
      "eficiencia_aplicacion": 88,
      "perdidas_evaporacion": 8,
      "agua_total_temporada": 450
    }
  }
}
\`\`\`

---

## 🐄 Módulo de Ganado

### Resumen del Hato
\`\`\`json
{
  "hato_general": {
    "total_animales": 245,
    "vacas_lactantes": 156,
    "vacas_secas": 42,
    "vaquillonas": 28,
    "terneros": 19,
    "produccion_diaria": 2850,
    "promedio_por_vaca": 18.3,
    "tasa_preñez": 85.2,
    "mortalidad": 2.1,
    "condicion_corporal_promedio": 3.2
  }
}
\`\`\`

### Registro Individual de Animal
\`\`\`json
{
  "animal": {
    "identificacion": {
      "id": "COW-001",
      "nombre": "Esperanza",
      "caravana": "2456",
      "raza": "Holstein Friesian",
      "fecha_nacimiento": "2019-03-15",
      "edad": "5 años 3 meses",
      "peso_actual": 650,
      "condicion_corporal": 3.5
    },
    "produccion": {
      "lactancia_numero": 3,
      "dias_en_leche": 185,
      "produccion_diaria": 28.5,
      "grasa": 3.8,
      "proteina": 3.2,
      "recuento_somatico": 125000,
      "proyeccion_305_dias": 8450
    },
    "reproduccion": {
      "estado": "Gestante",
      "dias_gestacion": 120,
      "fecha_probable_parto": "2024-09-15",
      "numero_partos": 2,
      "intervalo_partos": 385,
      "tasa_concepcion": 65
    },
    "salud": {
      "estado_general": "Saludable",
      "temperatura": 38.5,
      "frecuencia_cardiaca": 72,
      "frecuencia_respiratoria": 28,
      "ultima_vacunacion": "2024-05-15",
      "proxima_vacunacion": "2024-08-15"
    },
    "genetica": {
      "valor_genetico": 1850,
      "confiabilidad": 85,
      "padre": "Holstein Elite 2019",
      "madre": "Esperanza Madre",
      "indices_mejoramiento": {
        "leche": "+1250 kg",
        "grasa": "+45 kg",
        "proteina": "+38 kg"
      }
    }
  }
}
\`\`\`

### Plan Nutricional del Hato
\`\`\`json
{
  "nutricion": {
    "grupos_alimentacion": [
      {
        "grupo": "Vacas Alta Producción",
        "animales": 78,
        "materia_seca_diaria": 22.5,
        "proteina_cruda": 16.8,
        "energia_metabolizable": 2.65,
        "costo_diario": 8.50,
        "racion": [
          {
            "ingrediente": "Alfalfa henificada",
            "cantidad": 8.5,
            "porcentaje": 37.8
          },
          {
            "ingrediente": "Maíz molido",
            "cantidad": 6.2,
            "porcentaje": 27.6
          }
        ]
      }
    ],
    "eficiencia_alimenticia": 1.45,
    "costo_total_diario": 1850.00
  }
}
\`\`\`

### Registros Sanitarios
\`\`\`json
{
  "sanidad": {
    "programa_vacunacion": [
      {
        "vacuna": "IBR-BVD-PI3-BRSV",
        "fecha_aplicacion": "2024-05-15",
        "animales_vacunados": 245,
        "veterinario": "Dr. Martínez",
        "costo_total": 1225.00,
        "proxima_dosis": "2024-11-15"
      }
    ],
    "tratamientos_activos": [
      {
        "animal": "COW-045",
        "diagnostico": "Mastitis subclínica",
        "tratamiento": "Antibiótico intramamario",
        "inicio": "2024-06-18",
        "duracion": 5,
        "retiro_leche": 72
      }
    ],
    "indicadores_salud": {
      "animales_saludables": 92.5,
      "en_tratamiento": 5.2,
      "casos_nuevos_mes": 8,
      "costo_sanitario_mensual": 2850.00
    }
  }
}
\`\`\`

---

## 🚜 Módulo de Maquinaria y Equipos

### Inventario de Equipos
\`\`\`json
{
  "maquinaria": [
    {
      "id": "TRACTOR-001",
      "tipo": "Tractor",
      "marca": "John Deere",
      "modelo": "6120M",
      "año": 2020,
      "horas_trabajo": 2450,
      "estado": "Operativo",
      "ubicacion": "Galpón Principal",
      "ultimo_mantenimiento": "2024-05-15",
      "proximo_mantenimiento": "2024-07-15",
      "costo_operativo_hora": 25.50
    }
  ],
  "implementos": [
    {
      "id": "SEMBRADORA-001",
      "tipo": "Sembradora",
      "marca": "Agco",
      "modelo": "White 8100",
      "ancho_trabajo": 6.0,
      "estado": "Mantenimiento",
      "dias_sin_uso": 15
    }
  ]
}
\`\`\`

### Programación de Actividades
\`\`\`json
{
  "actividades_programadas": [
    {
      "fecha": "2024-06-25",
      "actividad": "Aplicación de herbicida",
      "lote": "Norte A-1",
      "equipo_asignado": "PULVERIZADORA-001",
      "operador": "Juan Pérez",
      "duracion_estimada": 4.5,
      "costo_estimado": 185.00
    }
  ],
  "mantenimientos": [
    {
      "equipo": "TRACTOR-001",
      "tipo": "Mantenimiento preventivo",
      "fecha_programada": "2024-07-15",
      "items": [
        "Cambio de aceite motor",
        "Filtro de aire",
        "Revisión sistema hidráulico"
      ],
      "costo_estimado": 450.00
    }
  ]
}
\`\`\`

---

## 💰 Módulo Financiero

### Dashboard Financiero
\`\`\`json
{
  "resumen_financiero": {
    "ingresos_mes": 125000.00,
    "gastos_mes": 89500.00,
    "margen_bruto": 35500.00,
    "margen_porcentaje": 28.4,
    "flujo_caja": 45200.00,
    "roi_anual": 18.5
  },
  "ingresos_por_categoria": [
    {
      "categoria": "Venta de Leche",
      "monto": 85000.00,
      "porcentaje": 68.0
    },
    {
      "categoria": "Venta de Animales",
      "monto": 25000.00,
      "porcentaje": 20.0
    },
    {
      "categoria": "Venta de Granos",
      "monto": 15000.00,
      "porcentaje": 12.0
    }
  ],
  "gastos_por_categoria": [
    {
      "categoria": "Alimentación",
      "monto": 35000.00,
      "porcentaje": 39.1
    },
    {
      "categoria": "Sanidad",
      "monto": 12500.00,
      "porcentaje": 14.0
    },
    {
      "categoria": "Combustibles",
      "monto": 8500.00,
      "porcentaje": 9.5
    }
  ]
}
\`\`\`

### Análisis de Rentabilidad por Actividad
\`\`\`json
{
  "rentabilidad_actividades": [
    {
      "actividad": "Producción Lechera",
      "ingresos": 85000.00,
      "costos_directos": 52000.00,
      "costos_indirectos": 15000.00,
      "margen_bruto": 33000.00,
      "margen_neto": 18000.00,
      "roi": 26.9
    },
    {
      "actividad": "Cultivo de Maíz",
      "ingresos": 28000.00,
      "costos_directos": 18500.00,
      "costos_indirectos": 4200.00,
      "margen_bruto": 9500.00,
      "margen_neto": 5300.00,
      "roi": 23.3
    }
  ]
}
\`\`\`

---

## 📈 Módulo de Mercado (NUEVO)

### Dashboard de Mercado
\`\`\`json
{
  "kpis_mercado": {
    "items_monitoreados": 45,
    "items_alza": 28,
    "items_baja": 17,
    "cambio_promedio": "+1.2%"
  },
  "top_movers": [
    {
      "id": "fertilizante-npk",
      "nombre": "Fertilizante NPK 20-20-20",
      "cambio": "+5.32%",
      "tipo_cambio": "increase"
    },
    {
      "id": "semilla-maiz",
      "nombre": "Semilla Maíz Híbrido DK390",
      "cambio": "-3.91%",
      "tipo_cambio": "decrease"
    }
  ]
}
\`\`\`

### Precios de Productos
\`\`\`json
{
  "productos_mercado": [
    {
      "id": "maiz-grano",
      "nombre": "Maíz Grano",
      "categoria": "Granos",
      "precio_actual": 185.50,
      "precio_anterior": 182.30,
      "cambio_porcentaje": 1.75,
      "tipo_cambio": "increase",
      "unidad": "por tonelada",
      "fuente": "Mercado de Rosario",
      "tendencia_7d": [180, 182, 184, 183, 185, 186, 185.5],
      "volumen": 2500,
      "ultima_actualizacion": "2024-08-06T14:15:00Z"
    },
    {
      "id": "novillo-gordo",
      "nombre": "Novillo Gordo 400-450kg",
      "categoria": "Ganado",
      "precio_actual": 2.85,
      "precio_anterior": 2.78,
      "cambio_porcentaje": 2.52,
      "tipo_cambio": "increase",
      "unidad": "por kg vivo",
      "fuente": "Mercado de Liniers",
      "tendencia_7d": [2.7, 2.75, 2.78, 2.8, 2.82, 2.84, 2.85],
      "volumen": 3200,
      "ultima_actualizacion": "2024-08-06T13:45:00Z"
    }
  ]
}
\`\`\`

---

## 📋 Módulo de Tareas (NUEVO)

### Dashboard de Tareas
\`\`\`json
{
  "estadisticas_tareas": {
    "total": 25,
    "pendientes": 8,
    "en_progreso": 5,
    "completadas": 10,
    "vencidas": 2,
    "progreso_general": 40
  }
}
\`\`\`

### Vista Kanban
\`\`\`json
{
  "kanban_board": {
    "pending": [
      { "id": "t003", "title": "Siembra de Maíz", "priority": "medium", "dueDate": "2024-08-15", "assignedTo": "Ana García" }
    ],
    "in-progress": [
      { "id": "t002", "title": "Reparar Cerca Eléctrica", "priority": "high", "dueDate": "2024-08-10", "assignedTo": "Carlos Mendoza" }
    ],
    "completed": [
      { "id": "t001", "title": "Vacunación Ganado Sector A", "priority": "urgent", "dueDate": "2024-08-01", "assignedTo": "Dr. Roberto Silva" }
    ],
    "overdue": [
      { "id": "t004", "title": "Mantenimiento Tractor #3", "priority": "high", "dueDate": "2024-07-25", "assignedTo": "Miguel Torres" }
    ]
  }
}
\`\`\`

### Detalle de Tarea
\`\`\`json
{
  "tarea_detalle": {
    "id": "t002",
    "title": "Reparar Cerca Eléctrica",
    "description": "Reparar cerca caída en potrero #14 reportada por sensor G-45. Se necesita alambre y aisladores.",
    "status": "in-progress",
    "priority": "high",
    "category": "Mantenimiento",
    "dueDate": "2024-08-10T17:00:00Z",
    "assignedTo": {
      "id": "user_002",
      "name": "Carlos Mendoza",
      "avatar": "/placeholder-user.jpg"
    },
    "location": {
      "id": "loc_014",
      "name": "Potrero #14"
    },
    "estimatedHours": 2.5,
    "completedAt": null,
    "createdBy": "Sistema (Alerta Automática)",
    "createdAt": "2024-08-05T09:00:00Z",
    "comments": [
      {
        "user": "Carlos Mendoza",
        "comment": "Iniciando la tarea. El daño es mayor de lo esperado.",
        "timestamp": "2024-08-06T10:15:00Z"
      }
    ],
    "dependencies": []
  }
}
\`\`\`

---

## 🌐 Módulo IoT y Sensores

### Estado de Dispositivos
\`\`\`json
{
  "dispositivos_iot": {
    "total_dispositivos": 45,
    "online": 42,
    "offline": 2,
    "mantenimiento": 1,
    "bateria_baja": 3,
    "ultima_actualizacion": "2024-06-20T14:30:00Z"
  },
  "sensores_por_tipo": [
    {
      "tipo": "Humedad de Suelo",
      "cantidad": 15,
      "activos": 14,
      "valor_promedio": 65.2,
      "unidad": "%",
      "rango_normal": "40-80"
    },
    {
      "tipo": "Temperatura Ambiente",
      "cantidad": 8,
      "activos": 8,
      "valor_promedio": 24.5,
      "unidad": "°C",
      "rango_normal": "15-35"
    }
  ]
}
\`\`\`

### Datos en Tiempo Real
\`\`\`json
{
  "lecturas_recientes": [
    {
      "sensor_id": "SOIL-001",
      "tipo": "Humedad Suelo",
      "ubicacion": "Lote Norte A-1",
      "valor": 68.5,
      "unidad": "%",
      "timestamp": "2024-06-20T14:25:00Z",
      "estado": "Normal"
    },
    {
      "sensor_id": "TEMP-003",
      "tipo": "Temperatura",
      "ubicacion": "Establo Principal",
      "valor": 26.8,
      "unidad": "°C",
      "timestamp": "2024-06-20T14:25:00Z",
      "estado": "Normal"
    }
  ],
  "alertas_activas": [
    {
      "sensor_id": "SOIL-005",
      "tipo": "Humedad Suelo",
      "mensaje": "Humedad por debajo del umbral crítico",
      "valor_actual": 25.2,
      "umbral": 30.0,
      "severidad": "Alta",
      "timestamp": "2024-06-20T13:45:00Z"
    }
  ]
}
\`\`\`

---

## 📊 Reportes y Analytics

### Reportes Automáticos
\`\`\`json
{
  "reportes_disponibles": [
    {
      "nombre": "Reporte Diario de Producción",
      "frecuencia": "Diario",
      "hora_generacion": "06:00",
      "destinatarios": ["gerente@finca.com", "operador@finca.com"],
      "formato": "PDF",
      "incluye": [
        "Producción de leche",
        "Estado de animales",
        "Alertas del día",
        "Actividades programadas"
      ]
    },
    {
      "nombre": "Análisis Semanal de Cultivos",
      "frecuencia": "Semanal",
      "dia_generacion": "Lunes",
      "incluye": [
        "Progreso fenológico",
        "Condiciones climáticas",
        "Aplicaciones realizadas",
        "Proyecciones de rendimiento"
      ]
    }
  ]
}
\`\`\`

### KPIs y Métricas Avanzadas
\`\`\`json
{
  "kpis_avanzados": {
    "eficiencia_operativa": {
      "conversion_alimenticia": 1.45,
      "eficiencia_reproductiva": 85.2,
      "utilizacion_maquinaria": 78.5,
      "eficiencia_energetica": 92.1
    },
    "sostenibilidad": {
      "huella_carbono_kg_co2": 1250.5,
      "uso_agua_m3_ha": 4500.0,
      "reciclaje_residuos": 85.0,
      "energia_renovable": 35.0
    },
    "calidad": {
      "indice_calidad_leche": 95.2,
      "clasificacion_granos": "A",
      "trazabilidad_completa": 100.0,
      "certificaciones_vigentes": 3
    }
  }
}
\`\`\`

---

## 🔔 Sistema de Notificaciones

### Tipos de Alertas
\`\`\`json
{
  "configuracion_alertas": {
    "criticas": {
      "animal_enfermo": {
        "canal": ["email", "sms", "push"],
        "destinatarios": ["veterinario", "gerente"],
        "tiempo_respuesta": 15
      },
      "falla_equipo_critico": {
        "canal": ["email", "sms"],
        "destinatarios": ["tecnico", "gerente"],
        "tiempo_respuesta": 30
      }
    },
    "importantes": {
      "umbral_produccion": {
        "canal": ["email", "push"],
        "destinatarios": ["gerente"],
        "tiempo_respuesta": 60
      },
      "condiciones_climaticas": {
        "canal": ["push"],
        "destinatarios": ["todos"],
        "tiempo_respuesta": 120
      }
    },
    "informativas": {
      "mantenimiento_programado": {
        "canal": ["email"],
        "destinatarios": ["operadores"],
        "tiempo_respuesta": 1440
      }
    }
  }
}
\`\`\`

---

## 👥 Datos por Rol de Usuario

### Administrador
- **Acceso completo** a todos los módulos y datos
- **Configuración** del sistema y usuarios
- **Reportes financieros** detallados
- **Analytics avanzados** y predicciones
- **Gestión de alertas** y notificaciones

### Gerente de Producción
- **Dashboard ejecutivo** con KPIs principales
- **Reportes de producción** y eficiencia
- **Análisis de rentabilidad** por actividad
- **Planificación** de actividades
- **Supervisión** de equipos y personal

### Veterinario
- **Registros sanitarios** completos del hato
- **Historial médico** individual por animal
- **Programas de vacunación** y tratamientos
- **Alertas de salud** y diagnósticos
- **Análisis reproductivo** y genético
- **Reportes epidemiológicos**

### Ingeniero Agrónomo
- **Monitoreo de cultivos** y fenología
- **Planes de fertilización** y nutrición vegetal
- **Manejo fitosanitario** integrado
- **Análisis de suelos** y recomendaciones
- **Programación de riego** y balance hídrico
- **Proyecciones de rendimiento**

### Operador de Campo
- **Tareas diarias** asignadas
- **Registros de actividades** realizadas
- **Alertas operativas** básicas
- **Datos de producción** diaria
- **Estado de equipos** asignados
- **Formularios móviles** para captura de datos

### Contador/Financiero
- **Estados financieros** completos
- **Análisis de costos** por centro
- **Flujo de caja** y proyecciones
- **Presupuestos** y variaciones
- **Reportes fiscales** y tributarios
- **Indicadores de rentabilidad**

---

## 📱 Datos para Aplicación Móvil

### Dashboard Móvil Simplificado
\`\`\`json
{
  "dashboard_movil": {
    "widgets_principales": [
      {
        "tipo": "produccion_hoy",
        "valor": 2850,
        "unidad": "litros",
        "variacion": "+2.5%"
      },
      {
        "tipo": "alertas_activas",
        "cantidad": 3,
        "criticas": 1,
        "importantes": 2
      },
      {
        "tipo": "clima_actual",
        "temperatura": 24.5,
        "humedad": 68,
        "viento": 12
      },
      {
        "tipo": "tareas_pendientes",
        "cantidad": 5,
        "urgentes": 2
      }
    ]
  }
}
\`\`\`

### Formularios de Captura Rápida
\`\`\`json
{
  "formularios_moviles": [
    {
      "nombre": "Registro de Ordeño",
      "campos": [
        "animal_id",
        "cantidad_leche",
        "observaciones",
        "foto_opcional"
      ],
      "validaciones": {
        "cantidad_leche": "required|numeric|min:0|max:50"
      }
    },
    {
      "nombre": "Inspección de Cultivo",
      "campos": [
        "lote_id",
        "etapa_fenologica",
        "estado_general",
        "plagas_detectadas",
        "coordenadas_gps",
        "fotos"
      ]
    },
    {
      "nombre": "Reporte de Incidencia",
      "campos": [
        "tipo_incidencia",
        "descripcion",
        "ubicacion",
        "prioridad",
        "foto_evidencia"
      ]
    }
  ]
}
\`\`\`

---

## 🔄 Sincronización de Datos

### Estrategia de Sincronización
\`\`\`json
{
  "sincronizacion": {
    "tiempo_real": [
      "alertas_criticas",
      "datos_sensores",
      "notificaciones_push"
    ],
    "cada_5_minutos": [
      "produccion_actual",
      "estado_dispositivos",
      "condiciones_climaticas"
    ],
    "cada_hora": [
      "registros_actividades",
      "datos_historicos",
      "reportes_automaticos"
    ],
    "diario": [
      "respaldos_completos",
      "analisis_tendencias",
      "limpieza_datos_antiguos"
    ]
  }
}
\`\`\`

### Datos Offline
\`\`\`json
{
  "capacidades_offline": {
    "lectura": [
      "registros_animales",
      "mapas_lotes",
      "formularios_captura",
      "datos_historicos_30_dias"
    ],
    "escritura": [
      "registros_produccion",
      "observaciones_campo",
      "fotos_evidencia",
      "reportes_incidencias"
    ],
    "sincronizacion_automatica": true,
    "resolucion_conflictos": "timestamp_mas_reciente"
  }
}
\`\`\`

---

## 📈 Métricas de Performance del Sistema

### Indicadores Técnicos
\`\`\`json
{
  "metricas_sistema": {
    "performance": {
      "tiempo_respuesta_promedio": "< 200ms",
      "disponibilidad": "99.9%",
      "throughput": "1000 req/min",
      "latencia_p95": "< 500ms"
    },
    "datos": {
      "registros_totales": 2500000,
      "crecimiento_mensual": "5%",
      "tamaño_base_datos": "15.2 GB",
      "respaldos_diarios": "Automáticos"
    },
    "usuarios": {
      "usuarios_activos_diarios": 45,
      "sesiones_promedio": 3.2,
      "tiempo_sesion_promedio": "25 min",
      "dispositivos_conectados": 125
    }
  }
}
\`\`\`

---

*Esta documentación de datos por sección proporciona una guía completa para desarrolladores, analistas y usuarios finales sobre qué información está disponible en cada módulo de la plataforma de agricultura inteligente.*
