import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Seed de Base de Datos para AgroMonitor v3
 * 
 * Crea:
 * 1. Usuario demo
 * 2. Organización demo
 * 3. Catálogos base (especies, razas, categorías, forrajes, productos)
 * 4. Establecimiento con sectores
 * 5. Lotes/Rodeos
 * 6. Animales de ejemplo con eventos
 */

async function main() {
  console.log('🌱 Iniciando seed de base de datos AgroMonitor v3...\n')

  // ============================================
  // LIMPIAR BASE DE DATOS (en orden de dependencias)
  // ============================================
  console.log('🗑️  Limpiando base de datos...')
  
  // Eventos
  await prisma.evtPastoreo.deleteMany().catch(() => {})
  await prisma.evtAlimentacion.deleteMany().catch(() => {})
  await prisma.evtBaja.deleteMany().catch(() => {})
  await prisma.evtTacto.deleteMany().catch(() => {})
  await prisma.evtServicio.deleteMany().catch(() => {})
  await prisma.evtDestete.deleteMany().catch(() => {})
  await prisma.evtParicion.deleteMany().catch(() => {})
  await prisma.evtSanidad.deleteMany().catch(() => {})
  await prisma.evtMovimiento.deleteMany().catch(() => {})
  await prisma.evtPesada.deleteMany().catch(() => {})
  
  // Estructuras
  await prisma.torada.deleteMany().catch(() => {})
  await prisma.planAlimentacion.deleteMany().catch(() => {})
  await prisma.dietaComponente.deleteMany().catch(() => {})
  await prisma.dieta.deleteMany().catch(() => {})
  await prisma.ubicacionHist.deleteMany().catch(() => {})
  await prisma.animalLoteHist.deleteMany().catch(() => {})
  await prisma.animalAttr.deleteMany().catch(() => {})
  await prisma.genealogia.deleteMany().catch(() => {})
  await prisma.animal.deleteMany().catch(() => {})
  await prisma.loteProducto.deleteMany().catch(() => {})
  await prisma.producto.deleteMany().catch(() => {})
  await prisma.lote.deleteMany().catch(() => {})
  await prisma.medicionPotrero.deleteMany().catch(() => {})
  await prisma.sectorForraje.deleteMany().catch(() => {})
  await prisma.forraje.deleteMany().catch(() => {})
  await prisma.sector.deleteMany().catch(() => {})
  await prisma.establecimiento.deleteMany().catch(() => {})
  await prisma.cliente.deleteMany().catch(() => {})
  await prisma.proveedor.deleteMany().catch(() => {})
  await prisma.categoria.deleteMany().catch(() => {})
  await prisma.raza.deleteMany().catch(() => {})
  await prisma.especie.deleteMany().catch(() => {})
  await prisma.membresia.deleteMany().catch(() => {})
  await prisma.session.deleteMany().catch(() => {})
  // @ts-ignore - El cliente Prisma tiene estos modelos pero TS no los detecta por caché
  await prisma.account.deleteMany().catch(() => {})
  // @ts-ignore
  await prisma.verificationToken.deleteMany().catch(() => {})
  await prisma.usuario.deleteMany().catch(() => {})
  await prisma.organizacion.deleteMany().catch(() => {})
  await prisma.auditLog.deleteMany().catch(() => {})
  await prisma.documentoTransito.deleteMany().catch(() => {})
  
  console.log('✅ Base de datos limpiada\n')

  // ============================================
  // USUARIO Y ORGANIZACIÓN
  // ============================================
  console.log('👤 Creando usuario y organización...')
  
  const passwordHash = await bcrypt.hash('demo123456', 12)
  
  const usuario = await prisma.usuario.create({
    data: {
      nombre: 'Usuario',
      apellido: 'Demo',
      email: 'demo@agromonitor.com',
      emailVerificado: new Date(),
      passwordHash,
      rol: 'admin',
    } as any // TS caché issue - el cliente Prisma SÍ tiene 'apellido'
  })

  const organizacion = await prisma.organizacion.create({
    data: {
      nombre: 'Estancia La Esperanza',
      slug: 'estancia-la-esperanza',
    }
  })

  await prisma.membresia.create({
    data: {
      usuarioId: usuario.id,
      organizacionId: organizacion.id,
      rol: 'admin',
    }
  })
  
  console.log('✅ Usuario demo: demo@agromonitor.com / demo123456\n')

  // ============================================
  // CATÁLOGOS: ESPECIES
  // ============================================
  console.log('📚 Creando catálogos base...')
  
  const bovino = await prisma.especie.create({
    data: { nombre: 'bovino', descripcion: 'Ganado bovino' }
  })
  
  const ovino = await prisma.especie.create({
    data: { nombre: 'ovino', descripcion: 'Ganado ovino' }
  })

  // ============================================
  // CATÁLOGOS: RAZAS BOVINAS
  // ============================================
  const razasBovinas = await Promise.all([
    prisma.raza.create({ data: { especieId: bovino.id, nombre: 'Angus Negro' } }),
    prisma.raza.create({ data: { especieId: bovino.id, nombre: 'Angus Colorado' } }),
    prisma.raza.create({ data: { especieId: bovino.id, nombre: 'Hereford' } }),
    prisma.raza.create({ data: { especieId: bovino.id, nombre: 'Brangus' } }),
    prisma.raza.create({ data: { especieId: bovino.id, nombre: 'Braford' } }),
    prisma.raza.create({ data: { especieId: bovino.id, nombre: 'Limousin' } }),
    prisma.raza.create({ data: { especieId: bovino.id, nombre: 'Cruza' } }),
  ])
  
  const [angusNegro, angusColorado, hereford, brangus] = razasBovinas

  // ============================================
  // CATÁLOGOS: CATEGORÍAS BOVINAS
  // ============================================
  const categoriasBovinas = await Promise.all([
    prisma.categoria.create({ data: { especieId: bovino.id, nombre: 'ternero', sexo: 'M', edadMaxMeses: 12 } }),
    prisma.categoria.create({ data: { especieId: bovino.id, nombre: 'ternera', sexo: 'F', edadMaxMeses: 12 } }),
    prisma.categoria.create({ data: { especieId: bovino.id, nombre: 'novillito', sexo: 'M', edadMinMeses: 12, edadMaxMeses: 24 } }),
    prisma.categoria.create({ data: { especieId: bovino.id, nombre: 'vaquillona', sexo: 'F', edadMinMeses: 12, edadMaxMeses: 36 } }),
    prisma.categoria.create({ data: { especieId: bovino.id, nombre: 'novillo', sexo: 'M', edadMinMeses: 24 } }),
    prisma.categoria.create({ data: { especieId: bovino.id, nombre: 'vaca', sexo: 'F', edadMinMeses: 36 } }),
    prisma.categoria.create({ data: { especieId: bovino.id, nombre: 'toro', sexo: 'M', edadMinMeses: 24 } }),
  ])
  
  const [catTernero, catTernera, catNovillito, catVaquillona, catNovillo, catVaca, catToro] = categoriasBovinas

  // ============================================
  // CATÁLOGOS: RAZAS Y CATEGORÍAS OVINAS
  // ============================================
  await Promise.all([
    prisma.raza.create({ data: { especieId: ovino.id, nombre: 'Corriedale' } }),
    prisma.raza.create({ data: { especieId: ovino.id, nombre: 'Merino' } }),
    prisma.raza.create({ data: { especieId: ovino.id, nombre: 'Romney Marsh' } }),
  ])
  
  await Promise.all([
    prisma.categoria.create({ data: { especieId: ovino.id, nombre: 'cordero', sexo: 'M', edadMaxMeses: 12 } }),
    prisma.categoria.create({ data: { especieId: ovino.id, nombre: 'cordera', sexo: 'F', edadMaxMeses: 12 } }),
    prisma.categoria.create({ data: { especieId: ovino.id, nombre: 'borrego', sexo: 'M', edadMinMeses: 12, edadMaxMeses: 24 } }),
    prisma.categoria.create({ data: { especieId: ovino.id, nombre: 'borrega', sexo: 'F', edadMinMeses: 12, edadMaxMeses: 24 } }),
    prisma.categoria.create({ data: { especieId: ovino.id, nombre: 'capón', sexo: 'M', edadMinMeses: 12 } }),
    prisma.categoria.create({ data: { especieId: ovino.id, nombre: 'oveja', sexo: 'F', edadMinMeses: 24 } }),
    prisma.categoria.create({ data: { especieId: ovino.id, nombre: 'carnero', sexo: 'M', edadMinMeses: 24 } }),
  ])

  // ============================================
  // CATÁLOGOS: FORRAJES
  // ============================================
  const forrajes = await Promise.all([
    prisma.forraje.create({ data: { nombre: 'Campo natural', tipo: 'perenne', clase: 'pastura' } }),
    prisma.forraje.create({ data: { nombre: 'Festuca', tipo: 'perenne', clase: 'pastura' } }),
    prisma.forraje.create({ data: { nombre: 'Alfalfa', tipo: 'perenne', clase: 'pastura' } }),
    prisma.forraje.create({ data: { nombre: 'Raigrás', tipo: 'anual', clase: 'verdeo' } }),
    prisma.forraje.create({ data: { nombre: 'Avena', tipo: 'anual', clase: 'verdeo' } }),
    prisma.forraje.create({ data: { nombre: 'Sorgo forrajero', tipo: 'anual', clase: 'verdeo' } }),
  ])
  
  const [campoNatural, festuca, alfalfa] = forrajes

  // ============================================
  // CATÁLOGOS: PRODUCTOS SANITARIOS
  // ============================================
  const productos = await Promise.all([
    prisma.producto.create({ data: { nombre: 'Ivermectina 1%', tipo: 'antiparasitario', principioActivo: 'Ivermectina', retiroDias: 28 } }),
    prisma.producto.create({ data: { nombre: 'Doramectina', tipo: 'antiparasitario', principioActivo: 'Doramectina', retiroDias: 35 } }),
    prisma.producto.create({ data: { nombre: 'Vacuna Aftosa', tipo: 'vacuna', principioActivo: 'Virus inactivado', retiroDias: 0 } }),
    prisma.producto.create({ data: { nombre: 'Vacuna Clostridial', tipo: 'vacuna', principioActivo: 'Toxoides clostridiales', retiroDias: 0 } }),
    prisma.producto.create({ data: { nombre: 'Oxitetraciclina LA', tipo: 'antibiotico', principioActivo: 'Oxitetraciclina', retiroDias: 28 } }),
    prisma.producto.create({ data: { nombre: 'Complejo Vitamínico ADE', tipo: 'vitaminico', retiroDias: 0 } }),
  ])
  
  const [ivermectina, , vacunaAftosa, vacunaClostridial] = productos
  
  console.log('✅ Catálogos creados\n')

  // ============================================
  // ESTABLECIMIENTO Y SECTORES
  // ============================================
  console.log('🏞️  Creando establecimiento y sectores...')
  
  const establecimiento = await prisma.establecimiento.create({
    data: {
      nombre: 'Campo Principal',
      organizacionId: organizacion.id,
      ubicacion: 'Ruta 5 Km 120, Buenos Aires',
      renspa: '06.123.0.12345/00',
      provincia: 'Buenos Aires',
      localidad: 'Chivilcoy',
      hectareas: 500,
    }
  })

  // Potreros
  const potreroCria = await prisma.sector.create({
    data: {
      establecimientoId: establecimiento.id,
      nombre: 'Potrero Cría Norte',
      tipo: 'potrero',
      superficieHa: 80,
      uso: 'pastoreo',
      capacidad: 100,
      tieneAgua: true,
      tieneSombra: true,
    }
  })
  
  const potreroRecria = await prisma.sector.create({
    data: {
      establecimientoId: establecimiento.id,
      nombre: 'Potrero Recría',
      tipo: 'potrero',
      superficieHa: 60,
      uso: 'pastoreo',
      capacidad: 80,
      tieneAgua: true,
    }
  })
  
  const potreroEngorde = await prisma.sector.create({
    data: {
      establecimientoId: establecimiento.id,
      nombre: 'Potrero Engorde',
      tipo: 'potrero',
      superficieHa: 100,
      uso: 'pastoreo',
      capacidad: 150,
      tieneAgua: true,
      tieneSombra: true,
    }
  })

  // Corrales
  const corralManga = await prisma.sector.create({
    data: {
      establecimientoId: establecimiento.id,
      nombre: 'Manga Principal',
      tipo: 'manga',
      capacidad: 50,
      tieneBalanza: true,
    }
  })
  
  await prisma.sector.create({
    data: {
      establecimientoId: establecimiento.id,
      nombre: 'Corral de Encierre',
      tipo: 'corral',
      capacidad: 200,
      tieneAgua: true,
    }
  })

  // Asignar forrajes a potreros
  await prisma.sectorForraje.create({
    data: {
      sectorId: potreroCria.id,
      forrajeId: campoNatural.id,
      desde: new Date('2020-01-01'),
    }
  })
  
  await prisma.sectorForraje.create({
    data: {
      sectorId: potreroRecria.id,
      forrajeId: festuca.id,
      desde: new Date('2023-03-15'),
      densidadSiembraKgHa: 12,
    }
  })
  
  await prisma.sectorForraje.create({
    data: {
      sectorId: potreroEngorde.id,
      forrajeId: alfalfa.id,
      desde: new Date('2022-09-01'),
      densidadSiembraKgHa: 15,
    }
  })
  
  console.log('✅ Establecimiento y sectores creados\n')

  // ============================================
  // LOTES / RODEOS
  // ============================================
  console.log('🐄 Creando lotes y rodeos...')
  
  const loteVacas = await prisma.lote.create({
    data: {
      nombre: 'Rodeo Cría 2024',
      tipo: 'reproductivo',
      especieId: bovino.id,
      establecimientoId: establecimiento.id,
      objetivo: 'Producción de terneros',
    }
  })
  
  const loteRecria = await prisma.lote.create({
    data: {
      nombre: 'Recría 2024',
      tipo: 'recria',
      especieId: bovino.id,
      establecimientoId: establecimiento.id,
      objetivo: 'Desarrollo de vaquillonas reposición',
    }
  })
  
  const loteEngorde = await prisma.lote.create({
    data: {
      nombre: 'Engorde Lote 1',
      tipo: 'engorde',
      especieId: bovino.id,
      establecimientoId: establecimiento.id,
      objetivo: 'Venta marzo 2025 - 480kg',
    }
  })
  
  console.log('✅ Lotes creados\n')

  // ============================================
  // DIETAS
  // ============================================
  console.log('🌾 Creando dietas...')
  
  const dietaEngorde = await prisma.dieta.create({
    data: {
      nombre: 'Engorde Intensivo',
      objetivo: 'engorde',
      msObjetivoKg: 12,
      proteinaPct: 14,
      energiaMcal: 2.8,
      componentes: {
        create: [
          { insumo: 'Maíz molido', proporcionPct: 45 },
          { insumo: 'Expeller de soja', proporcionPct: 15 },
          { insumo: 'Heno de alfalfa', proporcionPct: 35 },
          { insumo: 'Núcleo vitamínico-mineral', proporcionPct: 5 },
        ]
      }
    }
  })
  
  await prisma.planAlimentacion.create({
    data: {
      loteId: loteEngorde.id,
      dietaId: dietaEngorde.id,
      desde: new Date('2024-10-01'),
      msDiaPlanKg: 11,
    }
  })
  
  console.log('✅ Dietas creadas\n')

  // ============================================
  // ANIMALES
  // ============================================
  console.log('🐮 Creando animales...')
  
  // Toro reproductor
  const toro = await prisma.animal.create({
    data: {
      especieId: bovino.id,
      razaId: angusNegro.id,
      categoriaId: catToro.id,
      sexo: 'M',
      cuig: '076.123.0.00001/00',
      caravanaVisual: 'T-001',
      caravanaRfid: '982000000000001',
      otroId: 'Toro Campeón',
      fechaNacimiento: new Date('2020-03-15'),
      origen: 'compra',
      colorManto: 'Negro',
      estadoCastracion: 'entero',
      denticion: 'BL',
      esCabana: true,
      registroCabana: 'AAA-12345',
      notas: 'Toro principal del rodeo. Excelente conformación.',
    }
  })
  
  // Genealogía del toro (padres externos)
  await prisma.genealogia.create({
    data: {
      animalId: toro.id,
      padreExterno: 'Don Julio AAA-9999 (Cabaña Los Álamos)',
      madreExterno: 'Negra Superior AAA-8888',
    }
  })
  
  // DEPs del toro (usando EAV)
  await prisma.animalAttr.createMany({
    data: [
      { animalId: toro.id, clave: 'dep_peso_nacimiento', valor: '+2.1' },
      { animalId: toro.id, clave: 'dep_peso_destete', valor: '+28.5' },
      { animalId: toro.id, clave: 'dep_peso_adulto', valor: '+45.2' },
      { animalId: toro.id, clave: 'dep_circunferencia_escrotal', valor: '+1.2' },
      { animalId: toro.id, clave: 'valor_genetico_usd', valor: '15000' },
    ]
  })
  
  // Ubicación del toro
  await prisma.ubicacionHist.create({
    data: {
      animalId: toro.id,
      sectorId: potreroCria.id,
      desde: new Date('2024-01-15'),
      motivo: 'Asignación a rodeo de cría',
    }
  })
  
  // Lote del toro
  await prisma.animalLoteHist.create({
    data: {
      animalId: toro.id,
      loteId: loteVacas.id,
      desde: new Date('2024-01-15'),
    }
  })

  // Vacas de cría
  const vacas = []
  for (let i = 1; i <= 10; i++) {
    const vaca = await prisma.animal.create({
      data: {
        especieId: bovino.id,
        razaId: i % 2 === 0 ? angusNegro.id : hereford.id,
        categoriaId: catVaca.id,
        sexo: 'F',
        cuig: `076.123.0.${String(100 + i).padStart(5, '0')}/00`,
        caravanaVisual: `V-${String(i).padStart(3, '0')}`,
        caravanaRfid: `98200000000${String(100 + i).padStart(4, '0')}`,
        fechaNacimiento: new Date(2019 - (i % 3), (i % 12), 15),
        origen: 'cria_propia',
        colorManto: i % 2 === 0 ? 'Negro' : 'Colorado cara blanca',
        denticion: 'BL',
      }
    })
    vacas.push(vaca)
    
    // Ubicación
    await prisma.ubicacionHist.create({
      data: {
        animalId: vaca.id,
        sectorId: potreroCria.id,
        desde: new Date('2024-01-01'),
      }
    })
    
    // Lote
    await prisma.animalLoteHist.create({
      data: {
        animalId: vaca.id,
        loteId: loteVacas.id,
        desde: new Date('2024-01-01'),
      }
    })
  }

  // Novillos en engorde
  const novillos = []
  for (let i = 1; i <= 15; i++) {
    const novillo = await prisma.animal.create({
      data: {
        especieId: bovino.id,
        razaId: brangus.id,
        categoriaId: catNovillo.id,
        sexo: 'M',
        cuig: `076.123.0.${String(200 + i).padStart(5, '0')}/00`,
        caravanaVisual: `N-${String(i).padStart(3, '0')}`,
        caravanaRfid: `98200000000${String(200 + i).padStart(4, '0')}`,
        fechaNacimiento: new Date(2022, (i % 6), 10 + (i % 20)),
        origen: 'cria_propia',
        estadoCastracion: 'castrado',
        denticion: i > 10 ? '4D' : '2D',
      }
    })
    novillos.push(novillo)
    
    // Ubicación
    await prisma.ubicacionHist.create({
      data: {
        animalId: novillo.id,
        sectorId: potreroEngorde.id,
        desde: new Date('2024-06-01'),
      }
    })
    
    // Lote
    await prisma.animalLoteHist.create({
      data: {
        animalId: novillo.id,
        loteId: loteEngorde.id,
        desde: new Date('2024-06-01'),
      }
    })
  }

  // Vaquillonas en recría
  const vaquillonas = []
  for (let i = 1; i <= 8; i++) {
    const vaquillona = await prisma.animal.create({
      data: {
        especieId: bovino.id,
        razaId: angusColorado.id,
        categoriaId: catVaquillona.id,
        sexo: 'F',
        cuig: `076.123.0.${String(300 + i).padStart(5, '0')}/00`,
        caravanaVisual: `VQ-${String(i).padStart(3, '0')}`,
        caravanaRfid: `98200000000${String(300 + i).padStart(4, '0')}`,
        fechaNacimiento: new Date(2022, 8 + (i % 4), 5 + i),
        origen: 'cria_propia',
        denticion: '2D',
      }
    })
    vaquillonas.push(vaquillona)
    
    // Ubicación
    await prisma.ubicacionHist.create({
      data: {
        animalId: vaquillona.id,
        sectorId: potreroRecria.id,
        desde: new Date('2024-03-01'),
      }
    })
    
    // Lote
    await prisma.animalLoteHist.create({
      data: {
        animalId: vaquillona.id,
        loteId: loteRecria.id,
        desde: new Date('2024-03-01'),
      }
    })
  }
  
  console.log(`✅ ${1 + vacas.length + novillos.length + vaquillonas.length} animales creados\n`)

  // ============================================
  // EVENTOS DE PESADA
  // ============================================
  console.log('⚖️  Creando eventos de pesada...')
  
  // Pesadas del toro
  const pesadasToro = [
    { fecha: new Date('2024-01-15'), peso: 780, cc: 6.5 },
    { fecha: new Date('2024-04-15'), peso: 810, cc: 7.0 },
    { fecha: new Date('2024-07-15'), peso: 835, cc: 7.0 },
    { fecha: new Date('2024-10-15'), peso: 850, cc: 7.5 },
  ]
  
  for (const p of pesadasToro) {
    await prisma.evtPesada.create({
      data: {
        animalId: toro.id,
        fecha: p.fecha,
        pesoKg: p.peso,
        cc: p.cc,
      }
    })
  }
  
  // Pesadas de novillos (simular evolución)
  for (const novillo of novillos) {
    const pesoBase = 280 + Math.random() * 40
    const fechas = [
      new Date('2024-06-01'),
      new Date('2024-08-01'),
      new Date('2024-10-01'),
      new Date('2024-11-15'),
    ]
    
    for (let i = 0; i < fechas.length; i++) {
      await prisma.evtPesada.create({
        data: {
          animalId: novillo.id,
          fecha: fechas[i],
          pesoKg: Math.round(pesoBase + (i * 45) + (Math.random() * 20)),
          cc: 5.5 + (i * 0.3) + (Math.random() * 0.5),
        }
      })
    }
  }
  
  console.log('✅ Eventos de pesada creados\n')

  // ============================================
  // EVENTOS DE SANIDAD
  // ============================================
  console.log('💉 Creando eventos de sanidad...')
  
  // Vacunación masiva del lote de engorde
  await prisma.evtSanidad.create({
    data: {
      loteId: loteEngorde.id,
      cantidadAnimales: novillos.length,
      fecha: new Date('2024-06-01'),
      productoId: vacunaAftosa.id,
      dosis: 2,
      unidad: 'ml',
      via: 'subcutanea',
      motivo: 'preventivo',
      aplicador: 'Juan Pérez',
    }
  })
  
  await prisma.evtSanidad.create({
    data: {
      loteId: loteEngorde.id,
      cantidadAnimales: novillos.length,
      fecha: new Date('2024-06-01'),
      productoId: vacunaClostridial.id,
      dosis: 5,
      unidad: 'ml',
      via: 'subcutanea',
      motivo: 'preventivo',
      aplicador: 'Juan Pérez',
    }
  })
  
  // Desparasitación
  await prisma.evtSanidad.create({
    data: {
      loteId: loteEngorde.id,
      cantidadAnimales: novillos.length,
      fecha: new Date('2024-06-15'),
      productoId: ivermectina.id,
      dosis: 1,
      unidad: 'ml/50kg',
      via: 'subcutanea',
      motivo: 'preventivo',
      carenciaDias: 28,
      aplicador: 'Juan Pérez',
      veterinario: 'Dr. García',
    }
  })
  
  console.log('✅ Eventos de sanidad creados\n')

  // ============================================
  // TORADA Y SERVICIOS
  // ============================================
  console.log('🐂 Creando temporada de servicio...')
  
  const torada = await prisma.torada.create({
    data: {
      nombre: 'Servicio Otoño 2024',
      loteId: loteVacas.id,
      fechaInicio: new Date('2024-04-01'),
      fechaFin: new Date('2024-06-30'),
      tipo: 'natural',
      cantidadHembras: vacas.length,
      cantidadMachos: 1,
    }
  })
  
  // Servicios individuales
  for (const vaca of vacas) {
    await prisma.evtServicio.create({
      data: {
        hembraId: vaca.id,
        machoId: toro.id,
        toradaId: torada.id,
        fecha: new Date('2024-04-15'),
        tipo: 'natural',
      }
    })
  }
  
  console.log('✅ Temporada de servicio creada\n')

  // ============================================
  // TACTOS
  // ============================================
  console.log('🩺 Creando tactos...')
  
  for (let i = 0; i < vacas.length; i++) {
    const preñada = i < 8 // 80% preñez
    await prisma.evtTacto.create({
      data: {
        hembraId: vacas[i].id,
        fecha: new Date('2024-07-01'),
        resultado: preñada ? 'preñada' : 'vacia',
        mesesGest: preñada ? 2.5 : null,
        fechaProbableParto: preñada ? new Date('2025-01-15') : null,
        metodo: 'palpacion',
        veterinario: 'Dr. Martínez',
      }
    })
  }
  
  console.log('✅ Tactos creados\n')

  // ============================================
  // PROVEEDOR Y CLIENTE
  // ============================================
  console.log('🤝 Creando proveedores y clientes...')
  
  await prisma.proveedor.create({
    data: {
      organizacionId: organizacion.id,
      nombre: 'Agroinsumos del Sur',
      cuit: '30-12345678-9',
      tipo: ['insumos', 'alimentos'],
      contactoNombre: 'María González',
      contactoTel: '011-4567-8901',
    }
  })
  
  await prisma.cliente.create({
    data: {
      organizacionId: organizacion.id,
      nombre: 'Frigorífico La Pampa',
      cuit: '30-98765432-1',
      tipo: ['frigorifico'],
      renspa: '06.999.0.00001/00',
      contactoNombre: 'Carlos Rodríguez',
      contactoTel: '011-9876-5432',
    }
  })
  
  console.log('✅ Proveedores y clientes creados\n')

  // ============================================
  // RESUMEN FINAL
  // ============================================
  console.log('═'.repeat(60))
  console.log('✅ SEED COMPLETADO EXITOSAMENTE!')
  console.log('═'.repeat(60))
  console.log('')
  console.log('📊 RESUMEN:')
  console.log(`   🏢 Organizaciones: ${await prisma.organizacion.count()}`)
  console.log(`   👤 Usuarios: ${await prisma.usuario.count()}`)
  console.log(`   🏞️  Establecimientos: ${await prisma.establecimiento.count()}`)
  console.log(`   📍 Sectores: ${await prisma.sector.count()}`)
  console.log(`   🐄 Lotes/Rodeos: ${await prisma.lote.count()}`)
  console.log(`   🐮 Animales: ${await prisma.animal.count()}`)
  console.log(`   ⚖️  Pesadas: ${await prisma.evtPesada.count()}`)
  console.log(`   💉 Sanidad: ${await prisma.evtSanidad.count()}`)
  console.log(`   🐂 Servicios: ${await prisma.evtServicio.count()}`)
  console.log(`   🩺 Tactos: ${await prisma.evtTacto.count()}`)
  console.log('')
  console.log('═'.repeat(60))
  console.log('🔐 CREDENCIALES DE ACCESO:')
  console.log('═'.repeat(60))
  console.log('   📧 Email: demo@agromonitor.com')
  console.log('   🔑 Contraseña: demo123456')
  console.log('═'.repeat(60))
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
