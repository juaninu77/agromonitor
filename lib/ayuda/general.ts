// Ayuda: primeros pasos y conceptos que valen para toda la app.
import type { SeccionAyuda } from "./buscar"

export const PRIMEROS_PASOS: SeccionAyuda = {
  id: "primeros-pasos",
  titulo: "Primeros pasos",
  descripcion: "Cómo está organizada la app, cómo elegir el campo con el que trabajás y las reglas que valen en todos los módulos.",
  guias: [
    {
      id: "organizacion-campos",
      titulo: "Organización, campos y selector de campo",
      resumen: "Todo lo que cargás pertenece a una organización (la empresa o familia) y a uno de sus campos (establecimientos). Cada pantalla muestra los datos del campo elegido arriba.",
      pasos: [
        "Arriba a la izquierda está el selector de campo: muestra la organización y el campo activo.",
        "Tocalo y elegí otro campo de la lista (podés escribir para buscarlo).",
        "Para agregar un campo, tocá «Crear nuevo establecimiento» al final de la lista (te lleva a Configuración).",
      ],
      notas: [
        "Si trabajás en más de una organización, los datos de una nunca se mezclan con los de otra.",
        "Un miembro puede tener acceso a todos los campos de la organización o solo a algunos (lo define el administrador en Equipo).",
      ],
    },
    {
      id: "roles",
      titulo: "Roles: qué puede hacer cada uno",
      resumen: "Cada persona tiene un rol en cada organización. Si un botón no aparece, probablemente tu rol no lo permite en ese campo.",
      notas: [
        "«Propietario»: todo, incluido administrar a otros administradores y propietarios.",
        "«Administrador»: todo lo operativo y la gestión del equipo (encargados, veterinarios y operarios).",
        "«Encargado»: carga y corrige datos del campo, anula registros, inventario y finanzas.",
        "«Veterinario»: sanidad, tactos y plan sanitario.",
        "«Operario»: carga diaria (servicios, partos, destetes, señaladas, movimientos, manga).",
        "El rol vale por organización: ser administrador en una no da permisos en otra.",
      ],
    },
    {
      id: "anular",
      titulo: "Corregir un error: anular en lugar de borrar",
      resumen: "Los registros importantes (sanidad, reproducción, movimientos de stock, bajas) no se borran: se anulan con un motivo. Así queda la historia de quién cambió qué.",
      pasos: [
        "Buscá el registro en la lista del módulo.",
        "Abrí el menú «⋯» de la fila y elegí «Anular».",
        "Escribí el motivo (por ejemplo «se cargó en la vaca equivocada») y confirmá.",
        "Si hace falta, cargalo de nuevo con los datos correctos.",
      ],
      notas: [
        "Anular lo hacen el administrador o el encargado del campo.",
        "Lo anulado deja de contar en indicadores y saldos. Con la casilla «Ver anulados» lo seguís viendo en la lista.",
        "Para cambiar solo observaciones u otros datos menores, usá «Editar» en el mismo menú.",
      ],
    },
    {
      id: "fechas",
      titulo: "Fechas y horarios",
      notas: [
        "Las fechas de los eventos son días de calendario de Argentina y no pueden ser futuras.",
        "Un evento de un animal no puede ser anterior a su nacimiento.",
        "Los vencimientos de lotes de insumos se comparan con el día de hoy en Argentina.",
      ],
    },
    {
      id: "sin-conexion",
      titulo: "Trabajar sin señal",
      resumen: "La Manga y el Mapa guardan lo que cargás en el dispositivo y lo envían solos cuando vuelve la conexión.",
      notas: [
        "Cuando no hay conexión aparece un aviso arriba de la pantalla.",
        "En la Manga, la sesión queda en el teléfono o la computadora; el bastón es solo el lector.",
        "En el Mapa, los movimientos de animales, registros y mediciones quedan en una cola; si el servidor rechaza alguno, aparece como conflicto para reintentar o descartar.",
        "No borres los datos del navegador mientras haya cosas pendientes de enviar.",
      ],
    },
    {
      id: "buscar-exportar",
      titulo: "Buscar, filtrar y exportar",
      notas: [
        "El buscador del encabezado (o Ctrl + K) encuentra animales y pantallas.",
        "Las listas grandes se buscan por caravana y se recorren por páginas.",
        "Muchas listas tienen «Exportar» a Excel o PDF con los filtros aplicados.",
        "El botón «?» del encabezado abre esta ayuda en la sección de la pantalla donde estás.",
      ],
    },
  ],
}
