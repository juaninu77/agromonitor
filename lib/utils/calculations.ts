/**
 * Utilidades de cálculo para AgroMonitor ERP
 * Funciones centralizadas para cálculos agropecuarios
 */

/**
 * Calcula el porcentaje de cambio entre dos valores
 * @param anterior - Valor anterior
 * @param actual - Valor actual
 * @returns Porcentaje de cambio
 * @example
 * calcularPorcentajeCambio(100, 120) // 20
 * calcularPorcentajeCambio(100, 80) // -20
 */
export function calcularPorcentajeCambio(anterior: number, actual: number): number {
  if (anterior === 0) return 0
  return ((actual - anterior) / anterior) * 100
}

/**
 * Calcula el promedio de un array de números
 * @param valores - Array de números
 * @returns Promedio
 * @example
 * calcularPromedio([10, 20, 30]) // 20
 */
export function calcularPromedio(valores: number[]): number {
  if (valores.length === 0) return 0
  return valores.reduce((sum, val) => sum + val, 0) / valores.length
}

/**
 * Calcula la ganancia diaria de peso promedio (GDP)
 * @param pesoInicial - Peso inicial en kg
 * @param pesoFinal - Peso final en kg
 * @param dias - Días transcurridos
 * @returns GDP en kg/día
 * @example
 * calcularGDP(200, 250, 50) // 1 (kg/día)
 */
export function calcularGDP(pesoInicial: number, pesoFinal: number, dias: number): number {
  if (dias === 0) return 0
  return (pesoFinal - pesoInicial) / dias
}

/**
 * Calcula el rendimiento por hectárea
 * @param produccionTotal - Producción total en kg
 * @param hectareas - Cantidad de hectáreas
 * @returns Rendimiento en kg/ha
 * @example
 * calcularRendimiento(10000, 10) // 1000 kg/ha
 */
export function calcularRendimiento(produccionTotal: number, hectareas: number): number {
  if (hectareas === 0) return 0
  return produccionTotal / hectareas
}

/**
 * Calcula la edad en años a partir de una fecha de nacimiento
 * @param fechaNacimiento - Fecha de nacimiento
 * @returns Edad en años
 * @example
 * calcularEdad(new Date('2020-01-01')) // ~5
 */
export function calcularEdad(fechaNacimiento: string | Date): number {
  const fechaNac = typeof fechaNacimiento === 'string' ? new Date(fechaNacimiento) : fechaNacimiento
  const hoy = new Date()
  let edad = hoy.getFullYear() - fechaNac.getFullYear()
  const mes = hoy.getMonth() - fechaNac.getMonth()

  if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
    edad--
  }

  return edad
}

/**
 * Calcula los días transcurridos entre dos fechas
 * @param fechaInicio - Fecha de inicio
 * @param fechaFin - Fecha de fin (por defecto hoy)
 * @returns Días transcurridos
 * @example
 * calcularDiasTranscurridos(new Date('2025-01-01'), new Date('2025-01-10')) // 9
 */
export function calcularDiasTranscurridos(
  fechaInicio: string | Date,
  fechaFin: string | Date = new Date()
): number {
  const inicio = typeof fechaInicio === 'string' ? new Date(fechaInicio) : fechaInicio
  const fin = typeof fechaFin === 'string' ? new Date(fechaFin) : fechaFin

  const diffTime = Math.abs(fin.getTime() - inicio.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Calcula el costo por kilogramo producido
 * @param costoTotal - Costo total de producción
 * @param kgProducidos - Kilogramos producidos
 * @returns Costo por kg
 * @example
 * calcularCostoPorKg(10000, 500) // 20
 */
export function calcularCostoPorKg(costoTotal: number, kgProducidos: number): number {
  if (kgProducidos === 0) return 0
  return costoTotal / kgProducidos
}

/**
 * Calcula el margen de ganancia
 * @param precioVenta - Precio de venta
 * @param costo - Costo de producción
 * @returns Margen de ganancia en porcentaje
 * @example
 * calcularMargenGanancia(120, 100) // 20
 */
export function calcularMargenGanancia(precioVenta: number, costo: number): number {
  if (costo === 0) return 0
  return ((precioVenta - costo) / costo) * 100
}

/**
 * Calcula la ganancia neta
 * @param ingresos - Ingresos totales
 * @param gastos - Gastos totales
 * @returns Ganancia neta
 * @example
 * calcularGananciaNeta(100000, 60000) // 40000
 */
export function calcularGananciaNeta(ingresos: number, gastos: number): number {
  return ingresos - gastos
}

/**
 * Calcula el ROI (Return on Investment)
 * @param ganancia - Ganancia obtenida
 * @param inversion - Inversión realizada
 * @returns ROI en porcentaje
 * @example
 * calcularROI(50000, 100000) // 50
 */
export function calcularROI(ganancia: number, inversion: number): number {
  if (inversion === 0) return 0
  return (ganancia / inversion) * 100
}

/**
 * Calcula la carga animal (animales por hectárea)
 * @param cantidadAnimales - Cantidad de animales
 * @param hectareas - Hectáreas disponibles
 * @returns Carga animal (animales/ha)
 * @example
 * calcularCargaAnimal(450, 100) // 4.5
 */
export function calcularCargaAnimal(cantidadAnimales: number, hectareas: number): number {
  if (hectareas === 0) return 0
  return cantidadAnimales / hectareas
}

/**
 * Calcula la eficiencia de conversión alimenticia (ECA)
 * @param kgAlimentoConsumido - Kilogramos de alimento consumido
 * @param kgGananciaP eso - Kilogramos de peso ganado
 * @returns ECA (kg alimento / kg ganancia)
 * @example
 * calcularECA(700, 100) // 7 (se necesitan 7kg de alimento por 1kg de ganancia)
 */
export function calcularECA(kgAlimentoConsumido: number, kgGananciaPeso: number): number {
  if (kgGananciaPeso === 0) return 0
  return kgAlimentoConsumido / kgGananciaPeso
}

/**
 * Calcula el porcentaje de mortalidad
 * @param muertes - Número de muertes
 * @param total - Total de animales
 * @returns Porcentaje de mortalidad
 * @example
 * calcularMortalidad(5, 500) // 1
 */
export function calcularMortalidad(muertes: number, total: number): number {
  if (total === 0) return 0
  return (muertes / total) * 100
}

/**
 * Calcula el índice de preñez
 * @param vacasPreñadas - Número de vacas preñadas
 * @param vacasServidas - Número de vacas servidas
 * @returns Índice de preñez en porcentaje
 * @example
 * calcularIndicePreñez(85, 100) // 85
 */
export function calcularIndicePreñez(vacasPreñadas: number, vacasServidas: number): number {
  if (vacasServidas === 0) return 0
  return (vacasPreñadas / vacasServidas) * 100
}

/**
 * Calcula el costo por animal por día
 * @param costoTotal - Costo total mensual
 * @param cantidadAnimales - Cantidad de animales
 * @param dias - Días del período
 * @returns Costo por animal por día
 * @example
 * calcularCostoPorAnimalPorDia(30000, 500, 30) // 2
 */
export function calcularCostoPorAnimalPorDia(
  costoTotal: number,
  cantidadAnimales: number,
  dias: number
): number {
  if (cantidadAnimales === 0 || dias === 0) return 0
  return costoTotal / (cantidadAnimales * dias)
}

/**
 * Calcula el peso vivo total del lote
 * @param animales - Array con pesos individuales
 * @returns Peso total en kg
 * @example
 * calcularPesoTotalLote([450, 480, 420]) // 1350
 */
export function calcularPesoTotalLote(pesos: number[]): number {
  return pesos.reduce((total, peso) => total + peso, 0)
}

/**
 * Calcula el precio promedio ponderado
 * @param items - Array de items con precio y cantidad
 * @returns Precio promedio ponderado
 * @example
 * calcularPrecioPromedioPonderado([
 *   { precio: 100, cantidad: 10 },
 *   { precio: 120, cantidad: 5 }
 * ]) // 106.67
 */
export function calcularPrecioPromedioPonderado(
  items: Array<{ precio: number; cantidad: number }>
): number {
  const totalPonderado = items.reduce(
    (sum, item) => sum + item.precio * item.cantidad,
    0
  )
  const totalCantidad = items.reduce((sum, item) => sum + item.cantidad, 0)

  if (totalCantidad === 0) return 0
  return totalPonderado / totalCantidad
}

/**
 * Calcula la mediana de un array de números
 * @param valores - Array de números
 * @returns Mediana
 * @example
 * calcularMediana([1, 2, 3, 4, 5]) // 3
 */
export function calcularMediana(valores: number[]): number {
  if (valores.length === 0) return 0

  const sorted = [...valores].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

/**
 * Calcula la desviación estándar
 * @param valores - Array de números
 * @returns Desviación estándar
 * @example
 * calcularDesviacionEstandar([2, 4, 4, 4, 5, 5, 7, 9]) // ~2.14
 */
export function calcularDesviacionEstandar(valores: number[]): number {
  if (valores.length === 0) return 0

  const promedio = calcularPromedio(valores)
  const varianza = valores.reduce((sum, valor) => {
    return sum + Math.pow(valor - promedio, 2)
  }, 0) / valores.length

  return Math.sqrt(varianza)
}

/**
 * Calcula el valor total de inventario
 * @param items - Array de items con cantidad y costo
 * @returns Valor total
 * @example
 * calcularValorInventario([
 *   { cantidad: 10, costo: 100 },
 *   { cantidad: 5, costo: 200 }
 * ]) // 2000
 */
export function calcularValorInventario(
  items: Array<{ cantidad: number; costo: number }>
): number {
  return items.reduce((total, item) => total + item.cantidad * item.costo, 0)
}
