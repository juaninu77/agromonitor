// Ayuda: Ventas y Compras, Finanzas, Administración, Tareas, Equipo, Mi cuenta y Configuración.
import type { SeccionAyuda } from "./buscar"

export const VENTAS: SeccionAyuda = {
  id: "ventas",
  titulo: "Ventas y Compras",
  ruta: "/ventas",
  descripcion: "Ventas y otras bajas de hacienda con su cobro, clientes, proveedores y documentos de tránsito (DTA/DT-e).",
  guias: [
    {
      id: "venta",
      titulo: "Registrar una venta",
      quien: "Administrador o encargado.",
      pasos: [
        "Tocá «Registrar venta».",
        "Buscá el animal por caravana y elegilo. Dejá el motivo en «Venta» y cargá la fecha.",
        "Elegí el cliente y cargá «Peso venta (kg)» y «Precio/kg ($)»: el total se calcula solo (también lo podés escribir).",
        "Para registrar el cobro, en «Cobrado en» elegí la cuenta en pesos: se crea el ingreso en Finanzas.",
        "Opcional: Nº DTA, Nº Factura y observaciones. Tocá «Registrar baja».",
      ],
      notas: [
        "El animal deja de estar activo, el peso queda como última pesada y se cierran su lote y su ubicación.",
        "Si el animal está bajo carencia, una venta pide confirmación y una faena se rechaza.",
        "Con el mismo diálogo se registran muertes, faenas, descartes y robos (cambiá el «Motivo»).",
      ],
    },
    {
      id: "operaciones",
      titulo: "Ver las operaciones del mes",
      notas: [
        "Arriba: «Vendidos este mes», «Kg totales», «Facturación total» y «DTAs vigentes».",
        "La pestaña «Operaciones» lista las bajas con su motivo, cliente, peso, precio y total; se filtra por motivo.",
      ],
    },
    {
      id: "clientes",
      titulo: "Clientes y proveedores",
      pasos: [
        "«Nuevo cliente»: nombre o razón social, CUIT, RENSPA, tipo (invernador, frigorífico, consignatario, feria, particular), contacto y teléfono.",
        "En la pestaña «Proveedores», «Nuevo proveedor»: nombre, CUIT, tipo (insumos, hacienda, servicios…) y contacto.",
      ],
      notas: ["Los proveedores se usan también en las compras de Inventario."],
    },
    {
      id: "documentos",
      titulo: "Cargar un DTA / DT-e",
      pasos: [
        "En la pestaña «Documentos», tocá «Crear DTA/DTe».",
        "Cargá el número, el tipo, el motivo, la fecha de emisión y la de vencimiento.",
        "Completá RENSPA y nombre de origen y destino, especie, cantidad y categorías, y los datos del transporte.",
        "Tocá «Crear documento».",
      ],
      notas: [
        "La fecha de vencimiento es obligatoria.",
        "Si el motivo es faena y hay animales de esa especie bajo retiro en el campo, la app pide confirmar que ninguno viaja.",
        "También se listan los documentos donde el RENSPA del campo figura como destino (hacienda que entra).",
      ],
    },
  ],
}

export const FINANZAS: SeccionAyuda = {
  id: "finanzas",
  titulo: "Finanzas",
  ruta: "/finanzas",
  descripcion: "Cajas y cuentas, ingresos, gastos, impuestos y transferencias del campo, con un resumen por período. Pesos y dólares nunca se mezclan.",
  guias: [
    {
      id: "cuenta",
      titulo: "Crear una caja o cuenta",
      quien: "Administrador o encargado.",
      pasos: [
        "En la pestaña «Cuentas», tocá «Nueva cuenta».",
        "Poné el nombre, el tipo (caja, cuenta bancaria, billetera virtual, tarjeta de crédito u otro), la moneda (ARS o USD) y el «Saldo inicial» (lo que había antes del primer movimiento).",
        "Tocá «Guardar».",
      ],
      notas: [
        "El saldo se calcula solo: saldo inicial + ingresos − gastos.",
        "Una cuenta con movimientos no se elimina: desactivala desde «Editar».",
      ],
    },
    {
      id: "movimiento",
      titulo: "Registrar un ingreso o un gasto",
      pasos: [
        "Tocá «Ingreso» o «Gasto».",
        "Cargá el importe, la fecha, la descripción y la categoría (por ejemplo «Combustible» o «Venta de hacienda»).",
        "Elegí la cuenta y, si querés, medio de pago, cliente o proveedor, CUIT y notas.",
        "Guardá.",
      ],
      notas: [
        "Para impuestos, elegí la categoría «Impuestos y tasas» y el impuesto (IVA, Ganancias, Ingresos Brutos, Inmobiliario rural…).",
        "Las ventas de hacienda con cuenta de cobro y las compras de insumos con pago crean su movimiento solas.",
      ],
    },
    {
      id: "transferir",
      titulo: "Pasar plata de una cuenta a otra",
      pasos: [
        "Tocá «Transferir».",
        "Elegí «Desde» y «Hacia», el importe y la fecha. Si las monedas son distintas, cargá también cuánto entra.",
        "Tocá «Transferir».",
      ],
      notas: [
        "No cuenta como ingreso ni como gasto.",
        "Una transferencia no se edita: eliminala (se borran las dos partes) y cargala de nuevo.",
      ],
    },
    {
      id: "resumen",
      titulo: "Resumen, movimientos y exportar",
      notas: [
        "«Resumen»: ingresos, gastos, resultado y saldo en cuentas del período elegido, el gráfico por mes, los gastos e ingresos por categoría y los impuestos pagados.",
        "También muestra los comprobantes pendientes de Administración (por cobrar y por pagar).",
        "«Movimientos»: filtrá por fechas, tipo, categoría, cuenta o texto. «Exportar a Excel» descarga hasta 500 filas.",
        "Lápiz para editar y papelera para eliminar un movimiento.",
      ],
    },
  ],
}

export const ADMINISTRACION: SeccionAyuda = {
  id: "administracion",
  titulo: "Administración",
  ruta: "/administracion",
  descripcion: "Bienes del campo, comprobantes, trámites de SENASA y archivo de documentos, en un solo lugar.",
  guias: [
    {
      id: "registro",
      titulo: "Cargar un bien, comprobante, trámite o documento",
      quien: "Propietario, administrador o encargado.",
      pasos: [
        "Elegí la sección: «Patrimonio», «Comprobantes», «Trámites SENASA» o «Documentos».",
        "Tocá «Nuevo registro».",
        "Completá título, tipo, estado y referencia, más los datos de la sección: fecha y valor para un bien; número, fecha, vencimiento, importe y contraparte para un comprobante; fecha y vencimiento para un trámite; el archivo para un documento.",
        "Guardá.",
      ],
      notas: [
        "Los vencimientos pasados se ven en rojo («Vencido») mientras el registro siga pendiente.",
        "Los comprobantes no emiten facturas fiscales. Los pendientes aparecen en el resumen de Finanzas.",
        "No se repite un comprobante con el mismo número, tipo y contraparte.",
      ],
    },
    {
      id: "adjuntar",
      titulo: "Adjuntar archivos",
      pasos: [
        "En la fila del registro, tocá el clip «Adjuntar».",
        "Elegí el archivo (PDF, JPG o PNG de hasta 2 MB) y guardá. Queda vinculado al bien, comprobante, trámite o animal.",
      ],
      notas: ["En «Documentos» cada archivo se descarga desde su fila. El límite es de 100 MB por organización."],
    },
  ],
}

export const TAREAS: SeccionAyuda = {
  id: "tareas",
  titulo: "Tareas",
  ruta: "/tareas",
  descripcion: "Las tareas del campo: las que cargás vos y las que generan solos el plan sanitario y la agenda reproductiva.",
  guias: [
    {
      id: "crear",
      titulo: "Crear una tarea",
      pasos: [
        "Tocá «Nueva Tarea».",
        "Cargá el título, la descripción, el tipo (General, Sanitario, Mantenimiento o Movimiento), la prioridad, el lugar del campo (opcional) y la fecha límite.",
        "Tocá «Crear Tarea».",
      ],
      notas: ["Una tarea con lugar muestra el enlace «ver en el mapa», y aparece en la ficha de ese lugar."],
    },
    {
      id: "seguir",
      titulo: "Seguir y completar tareas",
      notas: [
        "Pestañas «Todas», «Pendientes», «En Progreso», «Completadas» y «Canceladas», con filtros por prioridad y tipo. «Total» y los contadores de arriba cuentan todas las tareas con esos filtros (de todas las páginas, sin importar la pestaña). Las fechas vencidas se ven en rojo.",
        "El tilde «Marcar como completada» la cierra.",
        "Las tareas del plan sanitario tienen «Registrar en Sanidad», y las de reproducción, «Registrar en Reproducción». Se completan solas al registrar el evento.",
        "Las tareas no se borran. «Cancelar tarea» (administrador o encargado, en tareas pendientes o en progreso) pide confirmación y la pasa a «Canceladas». Una del plan sanitario o de la agenda reproductiva cancelada no se vuelve a crear. Una tarea completada no se cancela.",
      ],
    },
  ],
}

export const CARGAS_WHATSAPP: SeccionAyuda = {
  id: "whatsapp",
  titulo: "Cargas por WhatsApp",
  ruta: "/whatsapp",
  descripcion: "Registrar lo que hiciste en el campo desde WhatsApp, escrito o con un audio, y validar lo que cargan los operarios.",
  guias: [
    {
      id: "cargar",
      titulo: "Cargar un evento por WhatsApp",
      pasos: [
        "Con tu número vinculado (ver «Mi cuenta» → «Consultar por WhatsApp»), escribile al asistente lo que hiciste, o mandá un audio: «vacuné el grupo Terneros con Ivomec, 5 ml subcutánea», «la 1234 pesó 380 kg», «se murió la vaca 567», «tacto: 1201 preñada, 1202 vacía», «pasé la 1201 y la 1202 al grupo Vacas», «la 880 parió un macho de 32 kilos», «celo a la mañana en la 1201».",
        "Si mandás un audio, primero te contesta «🎙️ Entendí: …» con lo que escuchó.",
        "Te muestra un resumen (animales, producto, dosis, stock que descuenta, fecha) con los botones «Confirmar» y «Cancelar». No se registra nada hasta que tocás «Confirmar».",
        "Al confirmar, contesta «✅ …» si quedó registrado, o «📨 Listo, lo mandé a validar» si tiene que aprobarlo un encargado.",
      ],
      notas: [
        "Se puede cargar: sanidad (a animales por caravana o a un grupo entero), pesadas, cambio de grupo, bajas (una por animal), servicios, tactos, partos y celos. Los animales se buscan por caravana visual, CUIG, número interno o caravana electrónica, solo entre los activos del campo activo.",
        "Un administrador o encargado registra todo al confirmar; un veterinario, la sanidad y la reproducción. Lo que manda un operario (y las pesadas, cambios de grupo y bajas de un veterinario) queda «Por validar».",
        "Si al registrar aparece un aviso (lote vencido, sin stock, venta de un animal en retiro, hembra preñada, mellizo, cambió la cantidad de animales) el asistente pregunta de nuevo con los botones. Una faena de un animal en retiro no se registra.",
        "El resumen vence a los 30 minutos: si no lo confirmaste, mandalo de nuevo. Si algo salió mal, tocá «Cancelar» y repetilo corregido.",
        "Los audios pueden durar hasta unos 3 minutos. El audio no se guarda: solo el texto que entendió.",
      ],
    },
    {
      id: "validar",
      titulo: "Validar lo que cargan los operarios",
      pasos: [
        "Cuando un operario confirma una carga, te llega una notificación y el Panel muestra «N cargas por WhatsApp esperan tu validación».",
        "Entrá a «Cargas por WhatsApp». En «Por validar» ves cada carga con quién la mandó, cuándo, el campo, el resumen y el mensaje original (el texto o lo que se entendió del audio).",
        "«Aprobar» la registra con tus permisos, revisando de nuevo todo (stock, retiro, animales activos). Si aparece un aviso, «Aprobar igual» lo acepta.",
        "«Rechazar» pide un motivo y no registra nada.",
      ],
      notas: [
        "Validan los administradores y encargados de ESE campo. A quien la mandó le llega el resultado en la app y, si escribió al asistente en las últimas 24 horas, también por WhatsApp.",
        "Lo que nadie revisa en 7 días vence y no se registra.",
        "«Últimos 30 días» muestra lo registrado, rechazado o vencido de tus campos y lo que mandaste vos. Cada carga registrada queda en la auditoría con quién la mandó y quién la aprobó.",
      ],
    },
  ],
}

export const EQUIPO: SeccionAyuda = {
  id: "equipo",
  titulo: "Equipo y permisos",
  ruta: "/configuracion/equipo",
  descripcion: "Las personas que trabajan en la organización: invitaciones, roles y a qué campos accede cada una.",
  guias: [
    {
      id: "invitar",
      titulo: "Invitar a una persona",
      quien: "Propietario o administrador.",
      pasos: [
        "Tocá «Invitar persona».",
        "Cargá el email y elegí el rol (encargado, veterinario, operario o administrador).",
        "Si el rol no es de gestión y hay varios campos, elegí «Todos los campos» o «Solo algunos campos».",
        "Opcional: un mensaje. Tocá «Crear invitación».",
        "Compartí el enlace: «Copiar enlace», «Enviar por WhatsApp» o «Abrir correo».",
      ],
      notas: [
        "El enlace se muestra una sola vez y vence en 7 días. Si se pierde, generá uno nuevo con «Renovar enlace».",
        "La persona entra con su propia cuenta: si no tiene, la crea desde el enlace.",
        "«Anular» deja sin efecto una invitación pendiente.",
      ],
    },
    {
      id: "roles",
      titulo: "Cambiar el rol o los campos de un miembro",
      pasos: [
        "En «Miembros», tocá «Rol y campos» en la tarjeta de la persona.",
        "Cambiá el rol y/o los campos a los que accede y tocá «Guardar».",
      ],
      notas: [
        "Un administrador gestiona encargados, veterinarios y operarios. Solo un propietario cambia o quita administradores y propietarios.",
        "Nadie cambia su propio rol, y la organización siempre conserva al menos un propietario.",
        "Propietarios y administradores ven todos los campos.",
      ],
    },
    {
      id: "pausar",
      titulo: "Pausar o quitar el acceso",
      notas: [
        "«Pausar acceso» bloquea temporalmente a un miembro; «Reactivar» lo devuelve.",
        "«Quitar» lo saca de la organización. Sus registros quedan.",
        "«Salir», en tu propia tarjeta, te saca de la organización.",
      ],
    },
  ],
}

export const CUENTA: SeccionAyuda = {
  id: "cuenta",
  titulo: "Mi cuenta",
  ruta: "/configuracion/cuenta",
  descripcion: "Tus datos, tu contraseña y los espacios de trabajo (organizaciones) en los que participás.",
  guias: [
    {
      id: "datos",
      titulo: "Cambiar mis datos o mi contraseña",
      pasos: [
        "Abrí el menú de tu avatar (arriba a la derecha) y tocá «Mi cuenta y espacios».",
        "En «Mis datos» cambiá nombre, apellido o teléfono y tocá «Guardar». El email es tu usuario y no se cambia.",
        "En «Contraseña» cargá la actual y la nueva (al menos 8 caracteres, con letras y números) y tocá «Cambiar contraseña».",
      ],
      notas: ["Si olvidaste la contraseña, en la pantalla de ingreso tocá «¿Olvidaste tu contraseña?»: te llega un enlace que vence en 1 hora."],
    },
    {
      id: "espacios",
      titulo: "Espacios de trabajo: entrar, aceptar invitaciones o crear uno",
      notas: [
        "Cada espacio (organización) tiene sus campos, datos y equipo. Podés estar en varios con roles distintos.",
        "«Entrar» cambia al espacio elegido. También se cambia desde el selector de arriba, en «Cambiar organización».",
        "En «Invitaciones para vos», «Aceptar» te suma a un espacio (con el email verificado; si no, usá el enlace que te compartieron).",
        "«Crear un espacio nuevo» arma una organización propia donde sos propietario, y te lleva a cargar su primer campo.",
      ],
    },
    {
      id: "whatsapp",
      titulo: "Consultar por WhatsApp",
      pasos: [
        "En «Mi cuenta», tarjeta «WhatsApp», tocá «Vincular WhatsApp».",
        "Aparece un mensaje como «VINCULAR K7Q2MZ»: tocá «Abrir WhatsApp» (o «Copiar mensaje») y mandalo al número del asistente desde tu teléfono. El código vence a los 10 minutos.",
        "Cuando llega, la tarjeta muestra tu número como vinculado y el asistente te saluda. Si tenés más de un campo, te pregunta con cuál trabajar (escribí «campo» para cambiarlo).",
        "Escribile como hablás: «¿Cuánta ivermectina queda?», «¿qué vacas paren este mes?», «buscame la caravana 1234», «¿qué tareas tengo?», «¿cuánto gastamos este mes?». «ayuda» muestra ejemplos.",
      ],
      notas: [
        "El asistente usa tus mismos permisos y campos que en la app; por ejemplo, las finanzas solo las ve un administrador o encargado. Si te quitan el acceso a un campo, deja de mostrarte sus datos en el momento.",
        "También podés cargar eventos de hacienda y mandar audios: ver la sección «Cargas por WhatsApp». Facturas y tareas por WhatsApp llegan en las próximas versiones.",
        "«Desvincular» corta el acceso de ese número. Con «Vincular otro número» lo cambiás; si un número estaba en otra cuenta, se pasa a la tuya.",
        "Para cuidar el costo, responde hasta 30 mensajes cada 10 minutos por número.",
      ],
    },
  ],
}

export const CONFIGURACION: SeccionAyuda = {
  id: "configuracion",
  titulo: "Configuración",
  ruta: "/configuracion/establecimientos",
  descripcion: "Campos (establecimientos), lotes y catálogos de especies, razas y categorías.",
  guias: [
    {
      id: "campo",
      titulo: "Agregar o editar un campo",
      quien: "Propietario o administrador.",
      pasos: [
        "Tocá «Nuevo Establecimiento» (o «Crear nuevo establecimiento» en el selector de campo).",
        "Cargá el nombre, las hectáreas, el RENSPA, la provincia, la localidad y la ubicación.",
        "Tocá «Crear Establecimiento».",
        "Para corregir los datos, tocá el engranaje de la tarjeta, cambiá lo necesario y tocá «Guardar Cambios».",
      ],
      notas: ["El nombre no se puede repetir dentro de la organización."],
    },
    {
      id: "lotes",
      titulo: "Crear lotes (grupos de animales)",
      quien: "Propietario o administrador.",
      pasos: [
        "En la tarjeta del campo, tocá «Ver Lotes».",
        "Tocá «Nuevo Lote» y cargá el nombre, el tipo (Reproductivo, Recría, Engorde, Mixto o Descarte), la especie y el objetivo.",
        "Tocá «Crear Lote».",
      ],
      notas: ["Los lotes se usan en Ganado, en los pastoreos del mapa, en las toradas y en las aplicaciones masivas."],
    },
    {
      id: "catalogo",
      titulo: "Especies, razas y categorías",
      quien: "Propietario, administrador o encargado.",
      pasos: [
        "En «Otras configuraciones» tocá «Catálogo».",
        "En cada pestaña («Especies», «Razas», «Categorías») tocá «Nueva…» y completá el nombre. A una categoría se le puede indicar sexo y edad mínima y máxima en meses.",
      ],
      notas: [
        "La edad de la categoría permite que la app sugiera la categoría al dar de alta un animal y elija la de las crías.",
        "Hay un catálogo general compartido. Lo que agregás queda solo para tu organización.",
      ],
    },
    {
      id: "primer-uso",
      titulo: "Configuración inicial",
      notas: [
        "Al crear la cuenta se arma un espacio con un «Establecimiento Principal», y el asistente «Configuración Inicial» guía para completar el campo y crear los primeros lotes.",
        "Mientras el espacio no tenga ningún campo, la app lleva a ese asistente.",
      ],
    },
    {
      id: "whatsapp-uso",
      titulo: "Ver el uso y el gasto del asistente de WhatsApp",
      quien: "Administrador de la plataforma.",
      pasos: [
        "En «Configuración», tocá la tarjeta «Asistente de WhatsApp».",
        "Elegí el período («7 días», «30 días» o «90 días»): arriba ves las consultas respondidas, las personas que lo usaron y el gasto en Claude y en WhatsApp.",
        "Los gráficos muestran los mensajes y el costo estimado por día; abajo, quién lo usa, qué le preguntan, el gasto por campo y los errores recientes.",
        "En «Anthropic (Claude)» y «Meta (WhatsApp)» está el gasto que informa cada proveedor. Si dice «Sin conectar», la tarjeta explica qué variable falta cargar en Vercel.",
      ],
      notas: [
        "El costo «estimado» lo calcula AgroMonitor con los tokens de cada consulta; el «real» lo informa Anthropic con unos minutos de demora y abarca toda la cuenta de Anthropic.",
        "Las respuestas que el bot manda dentro de las 24 horas de que la persona le escribe son de categoría «Servicio» y Meta no las cobra hasta cierto volumen mensual.",
      ],
    },
  ],
}
