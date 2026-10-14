// Ayuda: Potreros y mapa, Cultivos y Forrajes, Flota e Inventario.
import type { SeccionAyuda } from "./buscar"

export const POTREROS: SeccionAyuda = {
  id: "potreros",
  titulo: "Potreros y mapa",
  ruta: "/potreros",
  descripcion: "El mapa del campo: dibujar potreros, corrales y aguadas; ver dónde está la hacienda, la carga y el pasto; mover animales, registrar pastoreos y mediciones, aun sin señal.",
  guias: [
    {
      id: "ubicar-campo",
      titulo: "Ubicar el campo en el mapa",
      pasos: [
        "En la vista «Mapa», tocá la lupa «Ubicar campo».",
        "Buscá la localidad (por ejemplo «Sarmiento · Chubut») o escribí las coordenadas («-45.58, -69.06») y tocá «Ir a coordenadas».",
        "Acercate hasta ver el campo en la imagen satelital (en «Capas del mapa» › «Fondo» elegí «Satélite»).",
        "Dibujá el «Límite del campo» con «Agregar».",
      ],
    },
    {
      id: "dibujar",
      titulo: "Dibujar un potrero, corral, aguada o camino",
      quien: "Administrador o encargado.",
      pasos: [
        "Tocá «Agregar» y elegí el tipo de lugar. La herramienta se elige sola: área libre para potreros, rectángulo para corrales y galpones, línea para caminos y alambrados, punto para aguadas y tranqueras.",
        "Área libre: tocá cada esquina y cerrá tocando el vértice 1 (o doble clic, o «Cerrar contorno»). Rectángulo: dos clics marcan un lado y el tercero el ancho.",
        "Mirá las medidas en vivo (hectáreas, perímetro y largo de cada lado). El imán pega los puntos a vértices y bordes existentes.",
        "Completá «Nombre» y descripción y tocá «Guardar lugar».",
      ],
      notas: [
        "«Deshacer» y «Rehacer» corrigen puntos. Enter termina y Retroceso borra el último punto.",
        "Si un potrero pisa a otro, la app avisa antes de guardar (las superficies se contarían dos veces).",
        "El borrador queda guardado en el dispositivo hasta que lo guardes o lo canceles.",
        "Para cambiar el contorno, abrí la ficha y tocá el lápiz «Editar límites». Las versiones anteriores quedan en «Historial de límites» y se pueden restaurar.",
      ],
    },
    {
      id: "dividir",
      titulo: "Dividir un potrero con un alambrado",
      quien: "Administrador o encargado.",
      pasos: [
        "Abrí la ficha del potrero y tocá la tijera «Dividir con un alambrado».",
        "Dibujá la línea cruzando el potrero de lado a lado (empezá y terminá afuera).",
        "Revisá las hectáreas de cada parte y los nombres.",
        "Dejá marcado «Guardar la línea como alambrado» si querés que quede dibujado, y tocá «Dividir».",
      ],
      notas: ["La parte más grande conserva el nombre, el ganado y el historial. Agua, sombra y balanza se copian a la parte nueva y la capacidad se reparte según la superficie."],
    },
    {
      id: "importar",
      titulo: "Importar los lugares de Google Earth (KMZ/KML)",
      pasos: [
        "En «Lugares», abrí «Importar de Google Earth (KMZ/KML)» y elegí el archivo KMZ, KML o GeoJSON (hasta 5 MB y 100 figuras).",
        "Las figuras del archivo aparecen punteadas en el mapa y en una lista, cada una con su nombre y el tipo de lugar que se dedujo (potrero, aguada, corral, camino, alambrado…).",
        "Revisá la lista: cambiá el nombre o el tipo donde haga falta y destildá las que no quieras. Con «Todos» y «Ninguno» marcás o desmarcás todas.",
        "Tocá «Crear N lugares»: se crean todos juntos en el campo.",
      ],
      notas: [
        "El tipo sale del dato «tipo» del archivo, del nombre («Aguada norte», «Potrero del molino» es un potrero) o de la carpeta de Google Earth (todo lo que está en la carpeta «Corrales» es corral). Si no hay pistas, un área es potrero, una línea alambrado y un punto «Otro sector»: la lista avisa «tipo según la forma, revisalo».",
        "Un área grande sin tipo que encierra a los demás potreros se toma como «Límite del campo».",
        "Se arreglan solos los contornos sin cerrar y los puntos repetidos; los trazos de más de 500 puntos se simplifican. Una figura que no se puede arreglar (por ejemplo, un contorno que se cruza) aparece en «figuras no se pudieron importar» con el motivo, y el resto se importa igual.",
        "Si un nombre ya existe en el campo, se guarda numerado («Potrero 1 (2)») y la lista te lo avisa antes.",
        "Con el lápiz podés abrir una figura en el editor del mapa, ajustarla y guardarla sola.",
        "Los multipolígonos se separan en varios lugares; los huecos de un polígono y los recorridos GPS no se importan (la app avisa).",
      ],
    },
    {
      id: "ver-distribucion",
      titulo: "Ver la hacienda, la carga y el pasto en el mapa",
      pasos: [
        "Tocá «Capas del mapa».",
        "En «Colorear por» elegí «Ocupación», «Carga animal (EV/ha)», «Altura de pasto» o «Días de ocupación / descanso». La leyenda de abajo explica los colores.",
        "Marcá «Mostrar nombres y ganado sobre el mapa» para ver en cada lugar los animales por especie, los equivalentes vaca (EV) y los grupos.",
        "Prendé o apagá las capas (potreros, corrales, aguadas, caminos, límite).",
      ],
      notas: [
        "El «Resumen del campo» (abajo a la izquierda) muestra animales, EV, carga global y la superficie por tipo, y lista lo que hay «Para revisar»: sin agua, sobrecarga o pasto bajo. Cada alerta lleva al lugar.",
        "«Lugares» filtra por tipo y estado (sin ubicar, con tareas, con ganado, en descanso, con cultivo).",
        "La carga se calcula en equivalentes vaca: vaca 1, vaquillona 0,75, ternero 0,5, toro 1,2, oveja 0,17, etc.",
      ],
    },
    {
      id: "mover",
      titulo: "Mover animales de un potrero a otro",
      quien: "Administrador o encargado.",
      pasos: [
        "Abrí la ficha del lugar de origen y tocá «Mover animales».",
        "Marcá los animales (o «Seleccionar los N de esta vista»).",
        "Elegí el destino: la lista sugiere primero los potreros con más descanso, mejor pasto y carga adecuada. También podés tocar «Elegir el destino en el mapa».",
        "Tocá «Confirmar movimiento».",
      ],
      notas: [
        "Para ingresar un grupo completo a un lugar, usá «Ingresar grupo» (en el Listado o en la pestaña Ganado de la ficha): en un potrero también inicia el pastoreo.",
        "Los avisos de capacidad o agua no impiden mover; solo informan.",
        "«Trasladar a otro campo» mueve animales entre campos de la misma organización, con su historial.",
      ],
    },
    {
      id: "pastoreo",
      titulo: "Pastoreo, descanso y mediciones de pasto",
      notas: [
        "Un pastoreo empieza solo cuando un grupo completo entra a un potrero y termina cuando ya no quedan animales del grupo ahí.",
        "La pestaña «Rotación y pasto» muestra la situación actual (días ocupado o en descanso), el historial de pastoreos y las mediciones con su gráfico.",
        "«Registrar salida» cierra un pastoreo en curso cuando el grupo ya salió.",
        "Para medir el pasto: «Medir pasto» en el Listado o «Registrar actividad» › «Medición de pasto» en la ficha (altura, materia seca y cobertura; la fecha no puede ser futura).",
      ],
    },
    {
      id: "ficha",
      titulo: "La ficha de un lugar",
      notas: [
        "«Resumen»: animales, tareas, agua, superficies, cultivos, forraje y «Datos del lugar» («Editar datos»: superficie declarada, capacidad, uso, agua, sombra y balanza).",
        "«Ganado», «Actividad» (tareas e historial), «Rotación y pasto», «Cultivos», «Existencias» (en galpones) y «Archivos» (fotos o documentos de hasta 2 MB).",
        "«Registrar actividad» guarda notas, tareas, revisiones de agua, descansos, labores y mediciones.",
      ],
    },
    {
      id: "archivar",
      titulo: "Archivar o restaurar un lugar",
      pasos: [
        "En la ficha, pestaña «Resumen», tocá «Archivar lugar» y confirmá.",
        "Para traerlo de vuelta, en «Lugares» abrí «Lugares archivados» y tocá «Restaurar».",
      ],
      notas: ["No se borra ningún dato. No se puede archivar un lugar con animales, con un grupo pastoreando o con stock."],
    },
    {
      id: "sin-senal",
      titulo: "Cargar en el campo sin señal",
      resumen: "Los movimientos de animales, ingresos de grupo, registros de actividad y mediciones se guardan en el dispositivo y se envían solos al volver la señal.",
      notas: [
        "Abajo en el mapa aparece «N registros sin enviar».",
        "«Revisar» muestra lo guardado. Si el sistema rechazó alguno, podés «Reintentar» o «Descartar».",
        "Traslados entre campos, siembras, stock y archivos necesitan conexión.",
      ],
    },
    {
      id: "listado",
      titulo: "El Listado de lugares",
      notas: [
        "La pestaña «Listado» muestra cada lugar en una tarjeta, con su estado, animales, pastoreo, agua, tareas y última medición.",
        "«Nuevo sector» crea un lugar sin dibujo. Después se ubica con «Dibujar en el mapa».",
        "«Exportar mapa (GeoJSON)», en «Más opciones del mapa», descarga todos los dibujos.",
      ],
    },
  ],
}

export const CULTIVOS: SeccionAyuda = {
  id: "cultivos",
  titulo: "Cultivos y Forrajes",
  ruta: "/cultivos",
  descripcion: "Siembras y pasturas por parcela, cosechas y reservas de forraje (fardos, rollos o kg) con su stock por galpón.",
  guias: [
    {
      id: "siembra",
      titulo: "Registrar una siembra",
      quien: "Propietario, administrador o encargado.",
      pasos: [
        "En «Siembras y pasturas» tocá «Registrar siembra».",
        "Elegí el sector o potrero, el cultivo o forraje, la fecha de siembra y las hectáreas; opcional, la densidad y notas.",
        "Tocá «Guardar».",
      ],
      notas: [
        "Solo en parcelas, y sin pasar de la superficie declarada (si hay otra campaña abierta, cerrala primero).",
        "Para cerrar la campaña, tocá «Finalizar cultivo» y cargá la fecha.",
      ],
    },
    {
      id: "cosecha",
      titulo: "Registrar una cosecha",
      pasos: [
        "En la tarjeta de la siembra, tocá «Registrar cosecha».",
        "Cargá la cantidad y la fecha.",
        "Elegí una reserva existente del mismo forraje o creá una nueva (nombre, unidad y galpón).",
        "Tocá «Guardar»: la reserva suma lo cosechado.",
      ],
      notas: ["Fardos y rollos van en números enteros. Las unidades nunca se convierten (un fardo no pasa a kg)."],
    },
    {
      id: "reservas",
      titulo: "Reservas de forraje: entradas, consumo y transferencias",
      pasos: [
        "En «Reservas de forraje» tocá «Crear reserva» (galpón, nombre, forraje, unidad, lugar y stock mínimo).",
        "Para cargar o sacar stock, usá «Entrada» (compra, ajuste) o «Salida / consumo» (consumo, venta, ajuste). En un consumo podés indicar el potrero y el grupo alimentado.",
        "Para llevar fardos a otro galpón, tocá «Transferir».",
      ],
      notas: [
        "Con el stock en el mínimo o por debajo, la reserva aparece como «Reponer reserva».",
        "La salida no puede dejar el stock negativo.",
      ],
    },
  ],
}

export const FLOTA: SeccionAyuda = {
  id: "flota",
  titulo: "Flota",
  ruta: "/flota",
  descripcion: "Vehículos y maquinaria: lecturas de km u horas y servicios de mantenimiento con su próximo vencimiento.",
  guias: [
    {
      id: "equipo",
      titulo: "Registrar un vehículo o máquina",
      pasos: [
        "Tocá «Registrar equipo».",
        "Cargá nombre, tipo, marca y modelo, patente, medidor (km u horas) y la lectura actual.",
        "Opcional: el próximo servicio por fecha y/o por lectura. Guardá.",
      ],
      notas: ["El equipo también queda como bien en Administración › Patrimonio."],
    },
    {
      id: "servicio",
      titulo: "Actualizar la lectura y registrar servicios",
      pasos: [
        "En la tarjeta del equipo, «Actualizar lectura» carga los km u horas nuevos (no pueden retroceder).",
        "«Registrar servicio» guarda fecha, lectura, trabajo o taller, costo y el próximo servicio.",
      ],
      notas: ["El estado avisa «Servicio próximo» (30 días, o 500 km / 20 h antes) y «Servicio vencido»."],
    },
  ],
}

export const INVENTARIO: SeccionAyuda = {
  id: "inventario",
  titulo: "Inventario de insumos",
  ruta: "/inventario",
  descripcion: "Vacunas, medicamentos, alimento, semillas y otros insumos: stock por lote y galpón, vencimientos, compras, recuentos y valorización.",
  guias: [
    {
      id: "producto",
      titulo: "Crear un producto",
      quien: "Administrador o encargado.",
      pasos: [
        "Tocá «Nuevo producto».",
        "Cargá nombre, tipo, unidad de stock y stock mínimo (para la alerta). Si es sanitario: principio activo, dosis de referencia y días de retiro.",
        "Opcional: costo de referencia y moneda. Tocá «Crear producto».",
      ],
      notas: [
        "Los días de retiro del producto se usan como carencia cuando no se carga otra en el tratamiento.",
        "Solo los productos sanitarios se ofrecen en Sanidad.",
        "Semen para IA: creá un producto tipo «Semen (pajuelas)» con el nombre del toro y cargá cada partida con «Ingresar lote». Se descuenta al registrar servicios de IA o IATF.",
        "«Archivar» saca el producto de los formularios (solo con stock en cero).",
      ],
    },
    {
      id: "compra",
      titulo: "Registrar una compra",
      pasos: [
        "Tocá «Registrar compra».",
        "Elegí el producto, la cantidad, el costo total y la moneda, el proveedor y la fecha; opcional, número de lote, vencimiento, ubicación y factura.",
        "Para registrar el pago, marcá «Registrar el pago como egreso en Finanzas» y elegí la cuenta (de la misma moneda) y el medio de pago.",
        "Guardá.",
      ],
      notas: ["Entra al stock como un lote nuevo con su costo, y el gasto queda en Finanzas en la misma operación."],
    },
    {
      id: "movimiento",
      titulo: "Entradas, salidas y ajustes",
      pasos: [
        "Tocá «Nuevo Movimiento».",
        "Elegí el producto y el tipo: «Entrada», «Salida» o «Ajuste de inventario» (en el ajuste, si suma o resta).",
        "Cargá la cantidad, la fecha, el galpón y, si hace falta, el lote. Un ajuste necesita motivo.",
        "Tocá «Registrar».",
      ],
      notas: [
        "Nada puede dejar el stock negativo, ni por galpón ni por lote.",
        "Una salida sin lote toma primero el que vence antes.",
        "«Ingresar lote», en la fila del producto, carga un lote con vencimiento y costo.",
      ],
    },
    {
      id: "galpones",
      titulo: "Stock por galpón y transferencias",
      pasos: [
        "Los galpones son los lugares de tipo galpón del mapa de Potreros.",
        "Para mover stock de un galpón a otro, tocá «Transferir», elegí producto, origen, destino y cantidad.",
      ],
      notas: ["La transferencia conserva los lotes y el total no cambia. El filtro de ubicación muestra el stock de cada galpón."],
    },
    {
      id: "recuento",
      titulo: "Hacer un recuento físico",
      pasos: [
        "Tocá «Recuento».",
        "Elegí la ubicación contada y la fecha.",
        "Cargá lo que contaste en la columna «Contado». Lo que dejes vacío no se modifica.",
        "Tocá «Confirmar recuento»: se registra un ajuste por cada diferencia.",
      ],
    },
    {
      id: "ficha-producto",
      titulo: "Ficha del producto y anular un movimiento",
      notas: [
        "Tocá el nombre del producto para ver sus lotes, en qué galpón está, las últimas aplicaciones y el kardex con el saldo después de cada movimiento.",
        "Un movimiento no se borra: «Anular» registra el movimiento inverso con un motivo.",
        "Lo descontado por un tratamiento o una señalada se devuelve anulando el tratamiento o la señalada en su módulo.",
      ],
    },
    {
      id: "alertas",
      titulo: "Alertas, vencimientos y valor del stock",
      notas: [
        "«Stock bajo» usa el stock mínimo de cada producto (sin mínimo, no hay alerta).",
        "«Vencimientos Próximos» avisa los lotes que vencen en 30 días. La pestaña «Alertas» los lista.",
        "«Valor del stock» (administrador o encargado) valoriza cada lote a su costo; los pesos y los dólares se muestran por separado.",
        "Las alertas también aparecen en el Panel de Control y en las notificaciones.",
      ],
    },
    {
      id: "consumos",
      titulo: "Descuentos automáticos desde otros módulos",
      notas: [
        "Sanidad: cada tratamiento descuenta el producto (si no alcanza, avisa y no guarda).",
        "Señalada: la vacuna clostridial se descuenta al registrarla.",
        "Manga: al finalizar una sesión con tratamiento se descuenta lo aplicado; si falta stock, descuenta lo que hay y avisa.",
        "En «Movimientos», el origen de cada fila dice Compra, Sanidad, Manga, Señalada, Transferencia o Recuento.",
      ],
    },
  ],
}
