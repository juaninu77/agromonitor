const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

// Función para convertir números seriales de Excel a fechas
function excelDateToJSDate(serial) {
  if (!serial || typeof serial !== 'number') return null
  const utc_days = Math.floor(serial - 25569)
  const utc_value = utc_days * 86400
  const date_info = new Date(utc_value * 1000)
  return date_info.toISOString()
}

// Función para normalizar campos
function normalizarCampo(campo) {
  const campoStr = String(campo || '').trim()
  if (campoStr.toLowerCase().includes('alberto') && !campoStr.toLowerCase().includes('renuevo')) {
    return 'Chacra Alberto'
  }
  if (campoStr.toLowerCase().includes('renuevo') && !campoStr.toLowerCase().includes('alberto')) {
    return 'Renuevo'
  }
  if (campoStr.toLowerCase().includes('alberto') && campoStr.toLowerCase().includes('renuevo')) {
    return 'Alberto-Renuevo'
  }
  if (campoStr.toLowerCase().includes('cantera')) {
    return 'Cantera'
  }
  return 'Chacra Alberto' // default
}

// Función para generar ID único
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Leer el Excel
console.log('📖 Leyendo archivo Excel...')
const workbook = XLSX.readFile('sample-data/Administracion 24_25.xlsx')

const data = {
  campos: [],
  bovinos: [],
  ovinos: [],
  tareas: [],
  stockAlimentos: [],
  registrosSanitarios: [],
  movimientos: []
}

// ============================================
// IMPORTAR CAMPOS
// ============================================
console.log('\n🏞️  Creando campos...')
const camposSet = new Set([
  'Chacra Alberto',
  'Renuevo',
  'Cantera',
  'Alberto-Renuevo'
])

camposSet.forEach((nombreCampo, index) => {
  data.campos.push({
    id: `campo-${index + 1}`,
    nombre: nombreCampo,
    hectareas: 100, // Valor por defecto, deberás actualizarlo
    tipo: 'propio',
    potreros: []
  })
})

console.log(`✅ ${data.campos.length} campos creados`)

// ============================================
// IMPORTAR STOCK BOVINOS
// ============================================
console.log('\n🐄 Importando Stock Bovinos...')
try {
  const bovinosSheet = workbook.Sheets['Stock Bovinos ']
  const bovinosRaw = XLSX.utils.sheet_to_json(bovinosSheet, { header: 1 })

  // Buscar el campo por nombre
  const getCampoId = (nombre) => {
    const campo = data.campos.find(c => c.nombre === nombre)
    return campo ? campo.id : data.campos[0].id
  }

  let contador = 0
  for (let i = 2; i < bovinosRaw.length; i++) { // Empezar desde fila 2 (después de headers)
    const row = bovinosRaw[i]
    if (!row || row.length === 0) continue

    const cuig = row[0] ? String(row[0]).trim() : null
    const numero = row[1] ? String(row[1]).trim() : `SN-${i}`
    const subNumero = row[2] ? parseInt(row[2]) : null
    const dientes = row[3] ? String(row[3]).trim() : null
    const observaciones = row[4] ? String(row[4]).trim() : null
    const padre = row[8] ? String(row[8]).trim() : null
    const madre = row[9] ? String(row[9]).trim() : null
    const raza = row[12] ? String(row[12]).trim() : null

    // Intentar determinar el campo basado en observaciones o padre
    const campoNombre = normalizarCampo(padre || observaciones || '')
    const campoId = getCampoId(campoNombre)

    // Determinar categoría basada en contexto (esto es una aproximación)
    let categoria = 'vaca' // Por defecto
    if (observaciones && observaciones.toLowerCase().includes('toro')) {
      categoria = 'toro'
    }

    if (cuig || numero) {
      data.bovinos.push({
        id: `bovino-${generateId()}`,
        cuig: cuig,
        numero: numero,
        subNumero: subNumero,
        categoria: categoria,
        dientes: dientes,
        fechaNacimiento: null,
        edad: null,
        peso: null,
        rodeo: padre,
        padre: padre,
        madre: madre,
        raza: raza,
        estado: 'activo',
        observaciones: observaciones,
        historial: [],
        campoId: campoId,
        ubicacion: null,
        condicionCorporal: null,
        valorMercado: null
      })
      contador++
    }
  }

  console.log(`✅ ${contador} bovinos importados`)
} catch (error) {
  console.error('❌ Error importando bovinos:', error.message)
}

// ============================================
// IMPORTAR STOCK OVINOS
// ============================================
console.log('\n🐑 Importando Stock Ovinos...')
try {
  const ovinosSheet = workbook.Sheets['Stock Ovinos ']
  const ovinosRaw = XLSX.utils.sheet_to_json(ovinosSheet, { header: 1 })

  // Buscar el campo por nombre
  const getCampoId = (nombre) => {
    const campo = data.campos.find(c => c.nombre === nombre)
    return campo ? campo.id : data.campos[0].id
  }

  let contador = 0
  for (let i = 2; i < ovinosRaw.length && i < 300; i++) { // Limitar a las primeras 300 filas
    const row = ovinosRaw[i]
    if (!row || row.length === 0) continue

    // Leer IDV del año 2024 (columna 8)
    const idv = row[8] ? parseInt(row[8]) : null
    const color = row[9] ? String(row[9]).trim().toLowerCase() : 'negro'
    const categoria = row[10] ? String(row[10]).trim().toLowerCase() : 'oveja'

    // Mapear colores del Excel a nuestro sistema
    const colorMapa = {
      'rojo': 'rojo',
      'celeste': 'celeste',
      'negra': 'negro',
      'negro': 'negro',
      'amarillo': 'amarillo',
      'verde': 'verde',
      'blanco': 'blanco'
    }

    // Mapear categorías
    const categoriaMapa = {
      'oveja': 'oveja',
      'borrega': 'borrega',
      'cordera': 'cordera',
      'capon': 'capon',
      'carnero': 'carnero',
      'cordero': 'cordero'
    }

    const colorMarca = colorMapa[color] || 'negro'
    const categoriaOvino = categoriaMapa[categoria] || 'oveja'

    if (idv && !isNaN(idv)) {
      // Crear historial de categorías por año
      const historialCategoria = []

      // Año 2022 (columnas 0-3)
      if (row[0]) {
        historialCategoria.push({
          anio: 2022,
          categoria: row[2] || 'oveja',
          color: row[1] || 'rojo'
        })
      }

      // Año 2023 (columnas 4-7)
      if (row[4]) {
        historialCategoria.push({
          anio: 2023,
          categoria: row[6] || 'borrega',
          color: row[5] || 'celeste'
        })
      }

      // Año 2024 (columnas 8-11)
      historialCategoria.push({
        anio: 2024,
        categoria: categoriaOvino,
        color: colorMarca
      })

      const campoId = getCampoId('Renuevo') // La mayoría de ovinos están en Renuevo

      data.ovinos.push({
        id: `ovino-${generateId()}`,
        idv: idv,
        colorMarca: colorMarca,
        categoria: categoriaOvino,
        anioNacimiento: 2024 - historialCategoria.length, // Aproximación
        peso: null,
        raza: null,
        estado: 'activo',
        rodeo: null,
        observaciones: null,
        historialCategoria: historialCategoria,
        historial: [],
        campoId: campoId,
        condicionCorporal: null,
        valorMercado: null
      })
      contador++
    }
  }

  console.log(`✅ ${contador} ovinos importados`)
} catch (error) {
  console.error('❌ Error importando ovinos:', error.message)
}

// ============================================
// IMPORTAR TAREAS
// ============================================
console.log('\n📋 Importando Listado de Tareas...')
try {
  const tareasSheet = workbook.Sheets['Listado de Tareas']
  const tareasRaw = XLSX.utils.sheet_to_json(tareasSheet, { header: 1 })

  let contador = 0
  for (let i = 2; i < tareasRaw.length; i++) {
    const row = tareasRaw[i]
    if (!row || row.length === 0) continue

    const campo = row[0] ? String(row[0]).trim() : null
    const fechaInicio = row[1] ? excelDateToJSDate(row[1]) : null
    const descripcion = row[2] ? String(row[2]).trim() : null
    const operario = row[3] ? String(row[3]).trim() : null
    const fechaFin = row[4] ? excelDateToJSDate(row[4]) : null

    if (descripcion) {
      data.tareas.push({
        id: `tarea-${generateId()}`,
        campo: normalizarCampo(campo),
        fechaInicio: fechaInicio,
        descripcion: descripcion,
        operario: operario,
        fechaFinalizacion: fechaFin,
        status: fechaFin ? 'completed' : 'pending'
      })
      contador++
    }
  }

  console.log(`✅ ${contador} tareas importadas`)
} catch (error) {
  console.error('❌ Error importando tareas:', error.message)
}

// ============================================
// IMPORTAR STOCK DE ALIMENTOS
// ============================================
console.log('\n🌾 Importando Plan de Alimentación...')
try {
  const alimentacionSheet = workbook.Sheets['Plan Alimentacion']
  const alimentacionRaw = XLSX.utils.sheet_to_json(alimentacionSheet, { header: 1 })

  // Fardos (fila 2)
  if (alimentacionRaw[2]) {
    data.stockAlimentos.push({
      id: `alimento-${generateId()}`,
      tipo: 'fardo',
      nombre: 'Fardos de Pasto',
      cantidad: alimentacionRaw[2][1] || 750,
      unidad: 'fardos',
      kgUnitario: alimentacionRaw[2][2] || 18,
      kgTotal: alimentacionRaw[2][3] || 13500,
      ubicacion: 'Galpón Principal',
      costoUnitario: null,
      proveedor: null,
      fechaIngreso: null,
      fechaVencimiento: null
    })
  }

  // Mezcla (fila 3)
  if (alimentacionRaw[3]) {
    data.stockAlimentos.push({
      id: `alimento-${generateId()}`,
      tipo: 'mezcla',
      nombre: 'Mezcla Forrajera',
      cantidad: alimentacionRaw[3][1] || 34000,
      unidad: 'kg',
      kgUnitario: 1,
      kgTotal: alimentacionRaw[3][3] || 34000,
      ubicacion: 'Silo',
      costoUnitario: null,
      proveedor: null,
      fechaIngreso: null,
      fechaVencimiento: null
    })
  }

  // Maíz (fila 4)
  if (alimentacionRaw[4]) {
    data.stockAlimentos.push({
      id: `alimento-${generateId()}`,
      tipo: 'maiz',
      nombre: 'Grano de Maíz',
      cantidad: alimentacionRaw[4][1] || 6000,
      unidad: 'kg',
      kgUnitario: 1,
      kgTotal: alimentacionRaw[4][3] || 6000,
      ubicacion: 'Silo Maíz',
      costoUnitario: null,
      proveedor: null,
      fechaIngreso: null,
      fechaVencimiento: null
    })
  }

  // Balanceado (fila 5)
  if (alimentacionRaw[5]) {
    data.stockAlimentos.push({
      id: `alimento-${generateId()}`,
      tipo: 'balanceado',
      nombre: 'Balanceado Comercial',
      cantidad: alimentacionRaw[5][1] || 4000,
      unidad: 'kg',
      kgUnitario: 1,
      kgTotal: alimentacionRaw[5][3] || 4000,
      ubicacion: 'Galpón Principal',
      costoUnitario: null,
      proveedor: null,
      fechaIngreso: null,
      fechaVencimiento: null
    })
  }

  console.log(`✅ ${data.stockAlimentos.length} alimentos importados`)
} catch (error) {
  console.error('❌ Error importando alimentación:', error.message)
}

// ============================================
// IMPORTAR REGISTRO SANITARIO
// ============================================
console.log('\n💉 Importando Registro Sanitario...')
try {
  const sanitarioSheet = workbook.Sheets['Registro Sanitario']
  const sanitarioRaw = XLSX.utils.sheet_to_json(sanitarioSheet, { header: 1 })

  const getCampoId = (nombre) => {
    const campo = data.campos.find(c => c.nombre === normalizarCampo(nombre))
    return campo ? campo.id : data.campos[0].id
  }

  let contador = 0
  for (let i = 1; i < sanitarioRaw.length; i++) {
    const row = sanitarioRaw[i]
    if (!row || row.length === 0) continue

    const campo = row[0] ? String(row[0]).trim() : null
    const especie = row[1] ? String(row[1]).trim().toLowerCase() : 'oveja'
    const fecha = row[2] ? excelDateToJSDate(row[2]) : null
    const tratamiento = row[3] ? String(row[3]).trim() : null
    const producto = row[4] ? String(row[4]).trim() : null
    const dosis = row[5] ? String(row[5]).trim() : null
    const operario = row[6] ? String(row[6]).trim() : null
    const observaciones = row[7] ? String(row[7]).trim() : null

    if (fecha && tratamiento) {
      data.registrosSanitarios.push({
        id: `sanitario-${generateId()}`,
        fecha: fecha,
        campoId: getCampoId(campo),
        especie: especie === 'vaca' ? 'bovino' : 'ovino',
        tipo: tratamiento.toLowerCase().includes('desparasit') ? 'desparasitacion' : 'vacuna',
        tratamiento: tratamiento,
        producto: producto || 'N/A',
        dosis: dosis || 'N/A',
        cantidadAnimales: 0, // No especificado en Excel
        operario: operario || 'N/A',
        observaciones: observaciones
      })
      contador++
    }
  }

  console.log(`✅ ${contador} registros sanitarios importados`)
} catch (error) {
  console.error('❌ Error importando registros sanitarios:', error.message)
}

// ============================================
// GUARDAR ARCHIVOS JSON
// ============================================
console.log('\n💾 Guardando archivos JSON...')

const outputDir = path.join(__dirname, '..', 'prisma', 'seed-data')
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

fs.writeFileSync(
  path.join(outputDir, 'campos.json'),
  JSON.stringify(data.campos, null, 2)
)

fs.writeFileSync(
  path.join(outputDir, 'bovinos.json'),
  JSON.stringify(data.bovinos, null, 2)
)

fs.writeFileSync(
  path.join(outputDir, 'ovinos.json'),
  JSON.stringify(data.ovinos, null, 2)
)

fs.writeFileSync(
  path.join(outputDir, 'tareas.json'),
  JSON.stringify(data.tareas, null, 2)
)

fs.writeFileSync(
  path.join(outputDir, 'stock-alimentos.json'),
  JSON.stringify(data.stockAlimentos, null, 2)
)

fs.writeFileSync(
  path.join(outputDir, 'registros-sanitarios.json'),
  JSON.stringify(data.registrosSanitarios, null, 2)
)

console.log('\n✅ Importación completada!')
console.log('\n📊 Resumen:')
console.log(`   - Campos: ${data.campos.length}`)
console.log(`   - Bovinos: ${data.bovinos.length}`)
console.log(`   - Ovinos: ${data.ovinos.length}`)
console.log(`   - Tareas: ${data.tareas.length}`)
console.log(`   - Stock Alimentos: ${data.stockAlimentos.length}`)
console.log(`   - Registros Sanitarios: ${data.registrosSanitarios.length}`)
console.log(`\n📁 Archivos guardados en: ${outputDir}`)
