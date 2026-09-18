# Ganado por especie y revisión de uso de AgroMonitor

Fecha: 18 de septiembre de 2026.

## Resultado

Ganado tiene tres vistas: **Bovinos, Ovinos y Todos**. El campo se elige en el selector general. La especie se conserva en la dirección de la página, al recargar y al volver desde una ficha. Cambiar de campo o especie reinicia la selección y los formularios, evitando trabajar accidentalmente con un animal del contexto anterior.

La vista inicial muestra animales activos. Vendidos, muertos y bajas siguen disponibles en el filtro de estado. “Todos” permite consultar conjuntamente las especies; no borra ni reclasifica animales.

## Cómo se hizo la revisión

Se inspeccionaron los componentes y consultas de Ganado, sus formularios y fichas, el menú general, el inicio, Administración, Flota y Cultivos. Ganado se recorrió en el navegador con el campo ficticio La Alameda, incluyendo alta y pesada, y con El Molino como campo vacío. Se revisó la presentación en escritorio y en un ancho de celular de 390 px.

Es una revisión funcional y de interfaz sobre el producto, no un estudio con usuarios independientes. Las propuestas generales requieren validación con personas que hagan el trabajo de campo; no se atribuyen porcentajes de ahorro de tiempo sin medirlos.

## Problemas corregidos

| Problema observado | Cambio | Beneficio práctico |
| --- | --- | --- |
| Encabezado bovino con ovejas en la misma lista; consultas sin el campo activo | Selector de especie y consultas por campo en lista, resumen y manejo | Saber sobre qué animales se está trabajando |
| Buscar sólo entre los 25 animales cargados | Búsqueda de caravana, RFID, CUIG y nombre en el servidor | Encontrar animales de cualquier página |
| Filtros pensados para vacas y novillos | Categorías reales y lotes de la especie y organización elegidas | Consultar una majada sin categorías bovinas |
| Alta masiva sin especie ni campo explícitos | Ambos identificadores viajan en cada alta; catálogos por especie | Registrar ovejas correctamente incluso teniendo varios campos |
| Pesada y sanidad cargaban hasta 1.000 animales mezclados | Buscador común por campo, especie y estado activo | Evitar elegir un animal de otra especie o campo |
| Cinco indicadores, dos de ellos siempre en cero | Tres indicadores calculados: cantidad, peso y animales sin pesada | Distinguir falta de información de un resultado real |
| Tabla de ocho columnas con identificación repetida y estados vacíos | Cinco columnas agrupadas; lote y ubicación visibles | Ver identificación, peso y ubicación sin abrir cada ficha |
| Dos caminos hacia detalles distintos del mismo animal | Una ficha completa desde la lista o tarjeta | Encontrar historia, documentación y movimientos en el mismo lugar |
| Cinco acciones compitiendo en el encabezado | Registrar, Pesada y Sanidad visibles; actualizar y exportar en Más | Priorizar el trabajo cotidiano |
| “Exportar todos” exportaba solamente la página cargada | Recorrer todas las páginas del filtro antes de generar el archivo | Reportar el conjunto realmente seleccionado |
| Reportes calculados con una página y filtros locales distintos | Agregados del servidor con los mismos filtros que el listado | Totales y gráficos consistentes |
| Demasiados controles apilados en celular | Filtros desplegables y tarjetas de animales | Llegar antes a los datos, manteniendo los controles disponibles |
| Cambio a un lote de otra especie permitido en algunas rutas | Validación por especie y campo tanto al editar como al mover | Mantener la coherencia del manejo |
| Selección sanitaria podía usar un producto de otra organización | Producto exacto de la organización del animal y alta atómica | Evitar asociaciones incorrectas |
| Dos pesadas en el mismo día no tenían desempate | Orden por fecha, momento de registro e identificador | Mostrar de forma consistente la última registrada ese día |

Los colores de las acciones principales usan los componentes y tokens comunes. Se agregaron nombres accesibles a buscadores, selectores y botones con iconos. Los archivos de exportación y los gráficos se cargan cuando se necesitan: la compilación intermedia pasó de 564 kB a 220 kB de JavaScript inicial para Ganado. Es una medida del empaquetado, no una medición del tiempo de carga en una conexión rural.

## Funciones que siguen disponibles

- Alta individual y masiva, con revisión antes de guardar.
- Edición de identificación, categoría, características y notas.
- Lista, tarjetas, orden por caravana/nombre/categoría/raza/edad y paginación.
- Pesadas, sanidad, historial reproductivo, movimientos y preparación de documentación en la ficha.
- Consulta de animales que ya no están activos.
- Reportes y archivos Excel/PDF del campo, especie y filtros elegidos.

La ficha de preparación ayuda a revisar información; no emite autorizaciones ni certifica aptitud para SENASA. La especie de un animal ya registrado no se cambia desde la edición común: esa corrección requiere revisar sus relaciones e historia, no sólo reemplazar una etiqueta.

## Mejoras siguientes, por prioridad

| Prioridad | Área | Propuesta concreta | Cómo comprobarla |
| --- | --- | --- | --- |
| Alta | Trabajo diario | Una bandeja “Hoy” con servicios vencidos, tareas sanitarias, documentos próximos a vencer y reservas bajas, con enlace a resolver cada caso | Un encargado identifica los pendientes de un campo sin recorrer varios módulos |
| Alta | Ganado | Movimiento y sanidad por selección múltiple dentro de la especie, con resumen de animales antes de guardar | Aplicar a una majada y comprobar que no afecta a animales excluidos |
| Alta | Información sanitaria | Mostrar motivo, producto, dosis y unidad explícitos; integrar vencimientos y carencias donde corresponda | La ficha permite reconstruir qué se aplicó y cuándo sin interpretar texto libre |
| Media | Navegación | Agrupar el menú en Campo, Ganado y Administración; conservar las rutas y añadir favoritos | Localizar Flota, documentos y lotes en una prueba con usuarios nuevos |
| Media | Flota | Añadir filtro “Vencidos / Próximos / Al día” y priorizar una acción según el estado del equipo | Encontrar y registrar el service pendiente sin revisar todas las tarjetas |
| Media | Cultivos y forrajes | Conectar reserva, lote y consumo en un mismo recorrido; mantener unidades visibles en cada paso | Registrar consumo para una majada y verificar el saldo de fardos/rollos/kg |
| Media | Administración | Usar el mismo encabezado compacto y filtros progresivos; presentar campos opcionales bajo “Más detalles” | Cargar una factura y adjuntar su archivo sin recorrer campos ajenos al caso |
| Media | Formularios | Unificar registro individual y formulario de edición sobre secciones comunes, con más datos opcionales desplegables | Las mismas etiquetas, validaciones y catálogos se comportan igual al crear y editar |
| Media | Móvil | Medir la barra superior, búsqueda global y menú con tareas reales; reducir elementos secundarios si dificultan el trabajo | Completar consulta, pesada y service con una mano y sin desplazamiento horizontal |
| Posterior | Conectividad | Extender el comportamiento sin conexión a operaciones seleccionadas, con estado de sincronización y resolución de conflictos | Cortar conexión, registrar, reconectar y demostrar que no hay duplicados |

## Guía de prueba para Juan

1. Elegir **La Alameda · DEMO**, abrir Ganado y seleccionar Ovinos.
2. Buscar `UX-OV-1809` o una caravana `DEMO-013` a `DEMO-017` y abrir su ficha.
3. Alternar a Bovinos: esas ovejas no deben aparecer. Volver a Ovinos.
4. En Registrar, verificar que las razas y categorías son ovinas. El modo Masivo agrupa animales con la misma configuración.
5. Usar Pesada o Sanidad y buscar una oveja. Consultar luego su historial.
6. Abrir Filtros en celular, o el filtro de estado en escritorio, y elegir Vendidos para encontrar `DEMO-018`.
7. Seleccionar El Molino: el listado debe quedar vacío. Volver a La Alameda para continuar.
8. En Más, exportar los resultados o abrir Reportes. Ambos deben coincidir con los filtros elegidos.

Las pruebas técnicas y sus resultados se documentan en `VALIDACION_GANADO_ESPECIES_2026-09-18.md`. No se modificó el esquema de producción para esta separación.
