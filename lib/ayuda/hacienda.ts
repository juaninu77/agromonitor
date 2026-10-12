// Ayuda: Panel, Ganado, Manga, Sanidad y Reproducción.
import type { SeccionAyuda } from "./buscar"

export const PANEL: SeccionAyuda = {
  id: "panel",
  titulo: "Panel de Control",
  ruta: "/",
  descripcion: "La pantalla de inicio: números del campo activo, alertas que piden acción y accesos rápidos.",
  guias: [
    {
      id: "leer-panel",
      titulo: "Qué muestra el panel",
      resumen: "Arriba están los indicadores del campo: «Total Animales», «Total Lotes», «Pesadas del mes», «Sanidad del mes», «Ventas del mes», «Partos próximos» y «Ganado pesado este mes».",
      notas: [
        "Las alertas aparecen solo cuando hay algo para revisar, y cada renglón lleva a la pantalla donde se resuelve.",
        "«Para revisar en el campo»: potreros sin agua, con sobrecarga o con pasto bajo (lleva al mapa).",
        "«Plan sanitario: N tareas vencidas»: abre Sanidad con la tarea lista para registrar.",
        "«Reproducción: N pendientes atrasados»: tactos, partos, señaladas y destetes atrasados (lleva a la Agenda).",
        "«Insumos para revisar»: lotes vencidos o por vencer en 30 días y productos con stock bajo.",
        "El botón «Actualizar» vuelve a cargar los datos.",
      ],
    },
    {
      id: "empezar",
      titulo: "Empezar de cero",
      resumen: "Si el campo todavía no tiene datos, el panel muestra «¡Bienvenido a AgroMonitor!» con tres pasos.",
      pasos: [
        "«Configurar»: cargá los datos del establecimiento (nombre, hectáreas, RENSPA).",
        "«Crear Lotes»: armá los grupos de animales (por ejemplo «Vacas de cría», «Recría»).",
        "«Agregar Animal»: registrá los animales uno por uno, en tanda o importando un Excel (ver Ganado).",
      ],
    },
  ],
}

export const GANADO: SeccionAyuda = {
  id: "ganado",
  titulo: "Ganado",
  ruta: "/ganado",
  descripcion: "El rodeo del campo: alta de animales, búsqueda, pesadas, sanidad rápida, ficha de cada animal, movimientos y bajas.",
  guias: [
    {
      id: "buscar",
      titulo: "Buscar y filtrar animales",
      pasos: [
        "Elegí la especie arriba: «Bovinos», «Ovinos» o «Todos».",
        "Escribí en el buscador la caravana, el RFID o el nombre.",
        "Usá los filtros de categoría, lote y estado. «Activos» viene elegido; también podés ver «Vendidos», «Muertos» o «Bajas».",
        "Tocá «Ver ficha» en la fila para abrir el animal.",
      ],
      notas: [
        "En la columna Estado pueden aparecer «Retiro hasta dd/mm» (carencia sanitaria) y el estado reproductivo (vacía, servida, preñada, parida, en lactancia).",
        "«Más» › «Exportar resultados a Excel» o «a PDF» exporta todas las páginas con los filtros aplicados.",
        "La pestaña «Reportes» muestra la distribución por categoría y el peso por categoría.",
      ],
    },
    {
      id: "alta-individual",
      titulo: "Registrar un animal",
      pasos: [
        "Tocá «Registrar» y quedate en la pestaña «Individual».",
        "Identificación: elegí la especie, cargá la «Caravana visual» y/o el «RFID» (15 o 16 dígitos; con el bastón, dejá el cursor en el campo y leé la caravana), el «Sexo» y la «Fecha de nacimiento».",
        "Clasificación: elegí «Raza» y «Categoría». Si cargaste la fecha de nacimiento, la app sugiere la categoría según la edad.",
        "Detalles (opcional): peso inicial, condición corporal, lote, potrero y origen.",
        "Tocá «Guardar animal», o «Guardar y seguir» para cargar otro con la misma especie, raza, lote y potrero.",
      ],
      notas: [
        "Hace falta la caravana visual o el RFID (al menos uno).",
        "Las caravanas se guardan en mayúsculas y el RFID se limpia de espacios y guiones.",
      ],
    },
    {
      id: "alta-masiva",
      titulo: "Registrar muchos animales de una vez",
      quien: "Administrador o encargado.",
      pasos: [
        "Tocá «Registrar» y elegí la pestaña «Masivo».",
        "Elegí lo común a toda la tanda: especie, sexo, raza, categoría y, si querés, lote y potrero. Tocá «Continuar a cargar caravanas».",
        "Cargá las caravanas: una por fila, con «Generar serie» (prefijo, desde, hasta y dígitos; por ejemplo A-001 a A-100) o con «Pegar lista».",
        "Tocá «Validar» para revisar sin guardar y después «Registrar N».",
      ],
      notas: [
        "Se guardan todos o ninguno: si una fila tiene error (caravana repetida, RFID inválido), no se registra nada hasta corregirla.",
        "En «Pegar lista», los números de 15 o 16 dígitos se toman como RFID.",
      ],
    },
    {
      id: "importar-excel",
      titulo: "Importar animales desde Excel",
      quien: "Administrador o encargado.",
      pasos: [
        "Tocá «Registrar» y elegí la pestaña «Importar».",
        "Bajá la «Plantilla .xlsx»: trae una hoja «Instrucciones» con las razas, categorías, lotes y potreros válidos del campo.",
        "Completá una fila por animal: Caravana (o RFID/CUIG), Sexo, Raza y Categoría son obligatorias; Fecha nacimiento, Peso, CC, Lote, Potrero y Origen son opcionales.",
        "Subí la planilla. Se valida sola y muestra los errores fila por fila.",
        "Si todo está bien, tocá «Confirmar importación».",
      ],
      notas: ["Máximo 1000 filas por archivo. Se importan todas las filas o ninguna."],
    },
    {
      id: "pesada",
      titulo: "Registrar una pesada",
      pasos: [
        "En Ganado tocá «Pesada» (o «Registrar peso» en la ficha del animal).",
        "Buscá el animal por caravana y elegilo.",
        "Cargá el «Peso (kg)», la fecha y, si querés, notas.",
        "Tocá «Registrar Pesada». El formulario queda listo para el siguiente animal.",
      ],
      notas: [
        "La fecha no puede ser futura y el animal tiene que estar activo.",
        "Para pesar muchos animales con balanza y bastón, usá la Manga.",
      ],
    },
    {
      id: "ficha",
      titulo: "La ficha del animal",
      resumen: "Muestra identificación, datos, estado actual (peso, lote, ubicación) y el historial completo.",
      notas: [
        "Pestañas: «Ficha / SENASA» (datos que faltan para la documentación), «Pesadas» (gráfico de evolución y ganancia diaria), «Sanidad», «Reproducción» (genealogía con madre, padre y crías), «Movimientos» y «Timeline» (todo junto).",
        "Botones: «Registrar peso», «Aplicar sanidad», «Mover de lote», «Editar» y «Dar de baja».",
        "En hembras activas, la pestaña Reproducción tiene «Registrar servicio», «Registrar tacto» y «Registrar parto», que abren Reproducción con el animal ya elegido.",
        "Si está bajo carencia sanitaria aparece «Bajo retiro hasta dd/mm».",
      ],
    },
    {
      id: "editar-mover",
      titulo: "Editar un animal o cambiarlo de lote",
      pasos: [
        "Abrí la ficha y tocá «Editar» para corregir identificación, raza, categoría, sexo, fecha de nacimiento, características o lote.",
        "Para solo cambiarlo de grupo, tocá «Mover de lote», elegí el «Nuevo lote» (de la misma especie) y «Mover».",
      ],
      notas: [
        "Editar los datos del animal lo hacen el administrador o el encargado.",
        "Mover de lote deja el historial: se ve en la pestaña «Movimientos».",
        "Para cambiar de potrero o corral usá el mapa de Potreros («Mover animales»).",
      ],
    },
    {
      id: "baja",
      titulo: "Dar de baja un animal (muerte, venta, faena…)",
      quien: "Administrador o encargado.",
      pasos: [
        "Abrí la ficha y tocá «Dar de baja».",
        "Elegí el «Motivo» (venta, muerte, faena, descarte, robo u otro), la «Fecha» y, si querés, observaciones.",
        "Tocá «Confirmar baja».",
      ],
      notas: [
        "La baja no borra el animal: deja de contar en el rodeo y se cierran su lote y su ubicación.",
        "Para una venta con cliente, precio y cobro usá «Registrar venta» en Ventas y Compras.",
        "Un animal bajo carencia no se puede dar de baja por faena, y una venta pide confirmación.",
      ],
    },
  ],
}

export const MANGA: SeccionAyuda = {
  id: "manga",
  titulo: "Manga (bastón RFID)",
  ruta: "/manga",
  descripcion: "Estación de trabajo para pasar hacienda por la manga leyendo caravanas electrónicas con el bastón Tru-Test: pesadas, tactos, condición corporal y más, con o sin señal.",
  guias: [
    {
      id: "sesion",
      titulo: "Empezar una sesión de manga",
      pasos: [
        "Tocá «Nueva Sesión».",
        "Poné un nombre (por ejemplo «Pesada terneros lote 3») y elegí el «Tipo de trabajo»: Pesada de rodeo, Vacunación, Antiparasitario, Tacto, Destete, Señalada, Recepción de hacienda o Trabajo general.",
        "Revisá las «Acciones habilitadas» (Peso, Sanidad, Tacto, Cond. Corporal, Dentición, Apartado, Registro nuevo): se marcan solas según el tipo y las podés cambiar.",
        "Si habilitás «Sanidad», completá el «Tratamiento de la sesión»: producto (de Inventario), dosis por animal, vía, motivo y carencia. Lo define un administrador, encargado o veterinario.",
        "Opcional: elegí el «Lote de origen» (los animales nuevos que registres entran a ese lote).",
        "Tocá «Iniciar Sesión».",
      ],
      notas: [
        "Hacé la sesión con señal: al abrirla, el rodeo del campo se guarda en el dispositivo («Caché: N») para poder buscar sin conexión.",
        "Si ya hay una sesión abierta en el campo, la pantalla entra directo a esa sesión.",
      ],
    },
    {
      id: "conectar",
      titulo: "Conectar el bastón",
      pasos: [
        "En el celular o la tablet, vinculá el bastón por Bluetooth como teclado. Dejá el modo «Teclado (HID)»: el bastón escribe el número en el campo de EID.",
        "En una computadora con Chrome o Edge podés usar «Avanzado (Serial)»: tocá «Conectar bastón», elegí el dispositivo en la ventana del navegador y esperá «Conectado».",
      ],
      notas: [
        "La app recuerda el último modo usado en ese dispositivo.",
        "Safari, iPhone y iPad no permiten el modo Serial: usá el modo teclado o importá el CSV del bastón.",
        "Si el bastón guardó lecturas en su memoria, podés subirlas después con «Importar desde bastón (CSV)».",
      ],
    },
    {
      id: "pasar-animales",
      titulo: "Pasar los animales",
      pasos: [
        "Leé la caravana con el bastón (o escribí el EID y tocá «Buscar»).",
        "Revisá la tarjeta del animal: caravana, categoría, raza, edad y último peso. Si aparece el recuadro rojo de retiro, no lo apartes para faena.",
        "Completá lo que corresponda: «Peso (kg)», «Condición Corporal» (1 a 9), «Aplicar tratamiento», «Resultado del tacto» (y «Meses de gestación» si está preñada), «Dentición» o «Apartado».",
        "Tocá «Confirmar y Siguiente». La lista «Animales procesados» muestra lo cargado.",
      ],
      notas: [
        "Un pitido agudo confirma una lectura válida; un pitido grave y vibración indican un EID inválido.",
        "Si el mismo EID se lee dos veces en 3 segundos, la segunda lectura se ignora.",
        "Solo se puede tactar a una hembra.",
        "En una sesión de vacunación, «Aplicar tratamiento» viene marcado para cada animal.",
        "Un EID que no está en el rodeo aparece como «No registrado». Con «Registro nuevo» habilitado, tocá «Registrar», elegí sexo, raza y categoría (y la caravana visual): se da de alta en Ganado con ese EID. Sin «Registro nuevo», la lectura queda en la sesión pero no se registra en ningún animal.",
      ],
    },
    {
      id: "sin-senal",
      titulo: "Trabajar sin señal en la manga",
      notas: [
        "Sin conexión, las búsquedas se hacen en la copia del rodeo guardada en el dispositivo y cada «Confirmar y Siguiente» queda guardado ahí.",
        "El indicador muestra «N pendientes». Al volver la señal se sincroniza solo, o tocá «Sincronizar».",
        "No se puede finalizar la sesión con lecturas pendientes: primero recuperá la conexión.",
      ],
    },
    {
      id: "finalizar",
      titulo: "Finalizar la sesión",
      pasos: [
        "Tocá «Finalizar» y después «Confirmar».",
        "La app crea, para cada animal identificado, la pesada (con su condición corporal), el tacto (con la fecha probable de parto si está preñada y cargaste los meses) y el tratamiento en Sanidad si lo marcaste, y descuenta el producto del stock (si falta, descuenta lo que hay y avisa).",
        "Se abre el «Resumen de Sesión» con los totales y el detalle. Tocá «Exportar PDF» para guardarlo.",
      ],
      notas: [
        "Las sesiones anteriores quedan en la pestaña «Historial».",
        "Los tratamientos de la sesión aparecen en Sanidad como una aplicación masiva: si se anula uno, se anulan todos los de la sesión y el producto vuelve al stock.",
      ],
    },
    {
      id: "csv",
      titulo: "Importar las lecturas del bastón (CSV)",
      pasos: [
        "Exportá el archivo desde Tru-Test Data Link (columnas EID, VID, Fecha, Hora, Peso).",
        "Dentro de la sesión, en «Importar desde bastón (CSV)», tocá «Seleccionar archivo».",
        "Revisá la vista previa (EIDs válidos, omitidos y con peso) y tocá «Importar N registros».",
      ],
      notas: ["Cada lectura se vincula sola con el animal que tenga ese RFID en el campo. No se puede importar a una sesión finalizada."],
    },
  ],
}

export const SANIDAD: SeccionAyuda = {
  id: "sanidad",
  titulo: "Sanidad",
  ruta: "/sanidad",
  descripcion: "Vacunas, antiparasitarios y tratamientos: registro individual o masivo con descuento de stock, carencias, libro sanitario y plan sanitario anual con tareas.",
  guias: [
    {
      id: "tratamiento",
      titulo: "Registrar un tratamiento",
      quien: "Administrador, encargado o veterinario.",
      pasos: [
        "Tocá «Registrar tratamiento».",
        "Elegí el animal (buscalo por caravana) o, en su lugar, un «Lote» para aplicarlo a todo el grupo.",
        "Elegí el «Producto» (los insumos sanitarios del Inventario) y cargá «Dosis», «Unidad» y «Vía».",
        "En «Descontar del stock» revisá la cantidad que se sugiere (dosis × animales) y, si querés, el lote del producto.",
        "Completá veterinario, aplicador, carencia, motivo y fecha, y guardá.",
      ],
      notas: [
        "La carencia vacía usa los días de retiro del producto.",
        "Si el lote del producto está vencido, la app pregunta si igual lo aplicaste.",
        "Si no alcanza el stock, registrá una entrada en Inventario o desmarcá el descuento.",
        "El costo se calcula del stock descontado (en pesos).",
      ],
    },
    {
      id: "masiva",
      titulo: "Aplicación masiva (vacunar un rodeo)",
      quien: "Administrador, encargado o veterinario.",
      pasos: [
        "Tocá «Aplicación masiva».",
        "En «A quiénes» filtrá por «Grupo», «Especie», «Categoría» y/o «Potrero o corral». El contador muestra cuántos animales activos entran.",
        "Elegí el producto, la «Dosis por animal», la vía, el motivo y la fecha.",
        "Revisá «Descontar del stock»: la cantidad es por animal y se muestra el total.",
        "Tocá «Aplicar a N animales».",
      ],
      notas: [
        "Se registra todo junto: si algo falla, no se guarda nada.",
        "Si mientras tanto cambió la cantidad de animales, la app avisa y pide confirmar de nuevo.",
        "Sin filtros se aplica a todos los animales activos del campo (pide confirmación).",
      ],
    },
    {
      id: "corregir",
      titulo: "Editar o anular un tratamiento",
      pasos: [
        "En «Historial», abrí el menú de la fila.",
        "«Editar» cambia veterinario, aplicador, vía, motivo y observaciones.",
        "Para cambiar producto, dosis, fecha o animal, tocá «Anular», escribí el motivo y cargalo de nuevo.",
      ],
      notas: [
        "Anular lo hacen el administrador o el encargado. Lo descontado del stock vuelve al inventario.",
        "Si el tratamiento es parte de una aplicación masiva, se anula la aplicación completa.",
      ],
    },
    {
      id: "retiro",
      titulo: "Carencia: animales bajo retiro",
      resumen: "Un animal tratado queda bajo retiro hasta la fecha de aplicación más la carencia. Mientras tanto no se puede faenar.",
      notas: [
        "La tarjeta «Bajo retiro (hoy)» y la pestaña «Bajo retiro» listan los animales con su fecha de liberación («Libre desde»).",
        "Si se trató un lote, el retiro alcanza a los animales que estaban en ese grupo.",
        "Una baja por faena de un animal bajo retiro se rechaza. Una venta pide confirmación. Un DT-e con motivo faena avisa si hay animales de esa especie bajo retiro.",
        "El retiro también se ve en la lista de Ganado y en la Manga, aun sin señal.",
      ],
    },
    {
      id: "libro",
      titulo: "Libro sanitario y consultas",
      notas: [
        "«Historial»: todos los tratamientos, con búsqueda por caravana, grupo o producto y filtros por motivo y especie.",
        "Botones «Excel» y «PDF»: exportan el «Libro sanitario» con los filtros de la vista.",
        "«Por animal»: tratamientos agrupados por animal. «Calendario»: lo registrado y lo planificado por día.",
      ],
    },
    {
      id: "protocolos",
      titulo: "Armar el plan sanitario (protocolos)",
      quien: "Administrador, encargado o veterinario.",
      pasos: [
        "Tocá «Plan sanitario» (o «Protocolos» en la pestaña Plan).",
        "Definí la «Zona de aftosa del campo» (administrador o encargado). En zona libre sin vacunación no se programa aftosa.",
        "En «Plantillas» elegí una (Bovino general, Bovino Patagonia, Ovino Patagonia base, Ovino PROLANA, Bovino reproductores) y tocá «Usar plantilla», o creá un «Protocolo vacío».",
        "Con «Editar» ajustá los ítems: nombre, «Cuándo» (fecha fija, campañas, inicio del servicio, destete, esquila), días antes/después, repetición, a quiénes, producto, vía y dosis.",
        "Tocá «Guardar protocolo».",
      ],
      notas: ["Los cambios valen para los calendarios que se armen desde ese momento."],
    },
    {
      id: "calendario",
      titulo: "Aplicar el plan: calendario y tareas",
      pasos: [
        "En la pestaña «Plan», tocá «Nuevo calendario».",
        "Elegí el protocolo, el año, el grupo (o todo el campo) y las fechas que pida (campañas, inicio del servicio, destete, esquila). Las de servicio y destete se sugieren desde Reproducción.",
        "Revisá la vista previa: cuántas tareas se crean y cuáles no se programan y por qué.",
        "Tocá «Crear calendario (N tareas)»: cada aplicación queda como tarea en Tareas.",
        "Cuando llegue la fecha, en «Tareas pendientes del plan» tocá «Registrar»: se abre la aplicación masiva preparada y, al guardarla, la tarea queda cumplida.",
      ],
      notas: [
        "«Desactivar» un calendario cancela sus tareas pendientes. Lo ya registrado no cambia.",
        "La pestaña Plan muestra la cobertura del año, las tareas vencidas, el costo por animal y por categoría y los casos curativos por mes, con aviso de posible brote.",
      ],
    },
  ],
}

export const REPRODUCCION: SeccionAyuda = {
  id: "reproduccion",
  titulo: "Reproducción",
  ruta: "/reproduccion",
  descripcion: "El ciclo completo: toradas y encarneradas, servicios, tactos, partos con alta de crías, destetes, señaladas, agenda de pendientes, indicadores e informes.",
  guias: [
    {
      id: "torada",
      titulo: "Armar una torada o encarnerada",
      quien: "Administrador o encargado.",
      pasos: [
        "En la pestaña «Toradas» tocá «Nueva torada» (en ovinos, «Nueva encarnerada»).",
        "Poné un nombre (por ejemplo «Servicio otoño 2026»), elegí el «Grupo de hembras», el tipo y la fecha de inicio.",
        "Tocá «Crear torada».",
        "Al terminar el servicio, tocá «Cerrar / toros» en la fila: cargá la fecha de fin (o «Cerrar hoy») y los toros asignados.",
      ],
      notas: ["En ovinos la encarnerada es solo con servicio natural."],
    },
    {
      id: "servicio",
      titulo: "Registrar servicios",
      pasos: [
        "Una hembra: tocá «Nuevo servicio», elegí fecha, tipo (Natural, IA o IATF) y la hembra; si es natural, el macho; si es IA, la «Pajuela del inventario» (completa el toro y la partida) o escribí el toro, y el inseminador. Tocá «Registrar servicio».",
        "Todo el grupo: «Por grupo» › «Servicio por torada». En natural se registran todas las hembras del grupo ese día; en IA elegís cuáles. Tocá «Registrar N servicios».",
      ],
      notas: [
        "Si la hembra figura preñada, la app pregunta antes de registrar el servicio.",
        "El servicio con torada tiene que caer dentro de sus fechas y la hembra tiene que estar en el grupo ese día.",
        "Con pajuela del inventario se descuenta 1 por servicio (1 por hembra en «Servicio por torada»); si no alcanzan, avisa y no guarda. Anular el servicio devuelve la pajuela.",
      ],
    },
    {
      id: "tacto",
      titulo: "Registrar tactos",
      quien: "Administrador, encargado o veterinario.",
      pasos: [
        "Una hembra: «Registrar tacto», elegí fecha, resultado, hembra y el servicio que se diagnostica. Si está preñada, cargá los meses: la app calcula la fecha probable de parto.",
        "Toda la torada: «Por grupo» › «Planilla de tacto». Elegí la torada y marcá cada hembra con P (preñada), V (vacía), D (dudosa) o A (absorción). Tocá «Registrar N tactos».",
      ],
      notas: ["Por ecografía hay que indicar los meses o vincular el servicio."],
    },
    {
      id: "parto",
      titulo: "Registrar un parto (y dar de alta la cría)",
      pasos: [
        "Tocá «Registrar parto».",
        "Elegí la fecha, la madre y el padre (del rodeo o externo, por ejemplo IA).",
        "Por cada cría: si nació viva o muerta, sexo, peso, caravana y EID. Para mellizos tocá «Agregar mellizo».",
        "Si fue un aborto, marcá «Fue un aborto (sin cría)».",
        "Tocá «Registrar parto».",
      ],
      notas: [
        "Cada cría viva se da de alta sola en Ganado, con su madre y su padre, en el grupo y el lugar de la madre. El peso al nacer queda como primera pesada.",
        "En el primer parto de una vaquillona (o borrega), la app ofrece pasarla a vaca (u oveja) con un clic.",
      ],
    },
    {
      id: "destete",
      titulo: "Registrar destetes",
      pasos: [
        "Un animal: «Nuevo destete» en la pestaña Destetes. Cargá fecha, animal, peso, método y el grupo de destete.",
        "Todo un grupo: «Por grupo» › «Destete por grupo». Elegí el grupo, marcá las crías (aparecen las nacidas en los últimos 18 meses), cargá el peso de cada una y el «Grupo de destete». Tocá «Destetar N».",
      ],
      notas: [
        "El peso queda como pesada y el animal pasa al grupo de destete.",
        "La lista calcula la ganancia diaria desde el nacimiento y el peso ajustado a 205 días.",
        "Avisa si un bovino no tiene caravana electrónica (obligatoria después del destete).",
      ],
    },
    {
      id: "senalada",
      titulo: "Señalada de corderos",
      pasos: [
        "«Por grupo» › «Señalada (ovinos)».",
        "Elegí el grupo ovino, la encarnerada y la fecha. Cargá «Señalados», «Muertos antes» y el desglose (machos enteros, castrados y hembras, que tiene que sumar los señalados).",
        "Si vacunaste, elegí la «Vacuna clostridial» y la «Dosis por cordero (ml)»: se sugiere cuánto descontar del stock.",
        "Tocá «Registrar señalada».",
      ],
      notas: [
        "La lista de «Señaladas» calcula el % señalada sobre las ovejas encarneradas y lo califica (bueno, regular o malo) según la referencia patagónica.",
        "Si se anula la señalada, la vacuna descontada vuelve al stock.",
      ],
    },
    {
      id: "agenda",
      titulo: "La agenda: qué hay que hacer",
      resumen: "La pestaña «Agenda» calcula sola los pendientes a partir de lo registrado: tactos, partos previstos, señaladas y destetes.",
      pasos: [
        "Abrí la pestaña «Agenda». Los atrasados llevan la etiqueta «Atrasado».",
        "Tocá el botón de acción («Cargar tacto», «Registrar parto», «Registrar señalada», «Destetar»): abre el registro ya preparado.",
      ],
      notas: [
        "Los pendientes que vencen en 30 días también aparecen en Tareas y se completan solos al registrar el evento.",
        "Los atrasados se ven en el Panel de Control.",
      ],
    },
    {
      id: "corregir",
      titulo: "Editar o anular un registro",
      pasos: [
        "En la lista, abrí el menú «⋯» de la fila.",
        "«Editar» cambia solo datos menores (toro, inseminador, veterinario, tipo de parto, método, observaciones).",
        "Para corregir la fecha, el animal o el resultado, tocá «Anular», escribí el motivo y cargalo de nuevo.",
      ],
      notas: [
        "Anular lo hacen el administrador o el encargado.",
        "Un servicio con tacto no se anula: primero anulá el tacto.",
        "Un parto se anula entero; las crías dadas de alta quedan en el rodeo (si fueron un error, dalas de baja desde su ficha).",
        "Al anular un destete podés elegir «Quitar también la pesada del destete» y «Volver el animal al grupo en el que estaba».",
        "Cada registro queda en el campo donde ocurrió, aunque el animal se mude a otro campo.",
      ],
    },
    {
      id: "indicadores",
      titulo: "Indicadores e informes",
      notas: [
        "Arriba: «Servidas sin tactar», «% Preñez», «Preñadas a parir» y «Partos» del año.",
        "Pestaña «Indicadores»: por torada, % preñez, parición, destete o señalada, pérdidas, mellizos, cabeza/cuerpo/cola y kg destetados por hembra, más el intervalo entre partos.",
        "«Hoja de servicio» de cada torada, en Excel o PDF.",
        "«Desempeño por toro»: por toro del rodeo o pajuela, hembras servidas, % preñez, partos, cabeza/cuerpo/cola, dificultad de parto y peso al destete de las crías, por año y exportable a Excel.",
        "«Pronóstico de parición» por mes y «Resumen de zafra por año», exportables.",
        "«Apartar vacías» (administrador o encargado) mueve las vacías de la torada a otro grupo, sin darlas de baja.",
      ],
    },
    {
      id: "roles",
      titulo: "Quién puede registrar cada cosa",
      notas: [
        "Servicio y parto: todos los roles.",
        "Tacto: administrador, encargado o veterinario.",
        "Destete y señalada: administrador, encargado u operario.",
        "Toradas, anular y apartar vacías: administrador o encargado.",
      ],
    },
  ],
}
