# Potreros: operación desde el mapa

La edición actualiza el contorno durante el arrastre de cada vértice. Deshacer y rehacer recuperan la posición anterior; Guardar confirma los cambios para el campo.

## Uso diario

- **Agregar** reúne potreros, parcelas agrícolas, galpones, aguadas, caminos, tranqueras y el límite general. El límite del campo no se suma como otra parcela.
- Seleccionar un lugar abre directamente su ficha lateral y mantiene el mapa visible. **Volver a lugares** recupera la lista con sus filtros. La ficha tiene un resumen y acceso a ganado, actividad, campañas, archivos o existencias, según el tipo.
- **Mover animales** abre la selección y el destino. **Ganado** permite consultar sin mostrar el formulario de movimiento: botones Todos/Bovinos/Ovinos con cantidades y búsqueda por caravana o identificación alternativa. Al cambiar un filtro se limpia la selección para no trasladar animales que dejaron de verse. La operación actualiza ubicación e historial en una transacción. Ingresar un grupo completo también inicia pastoreo en una parcela. Los movimientos son actuales; no se reescriben ubicaciones históricas desde este flujo.
- Una salida parcial cierra el pastoreo declarado del grupo para no presentarlo como completamente ubicado en un único potrero. Las ubicaciones individuales siguen siendo la referencia para los conteos.
- **Actividad y tareas** registra notas, tareas, revisiones de agua, descansos, labores y mediciones. Cada registro lleva fecha. Completar una tarea conserva el historial. Sin revisión registrada es distinto de sin agua.
- **Cultivos** registra campañas sobre la misma parcela. Cerrá la campaña previa cuando corresponda. No se crea otra geometría al registrar una siembra. Las campañas que se superponen no pueden superar la superficie declarada.
- **Fotos y documentos** usa el archivo privado existente: PDF, JPG y PNG hasta 2 MB. Se vinculan al lugar por ID.
- **Existencias** muestra movimientos de productos vinculados al galpón. Las salidas no pueden dejarlo con stock negativo y los reintentos no duplican operaciones. Las existencias antiguas sin depósito siguen visibles en Inventario y no se asignan automáticamente a un galpón. Las reservas de forraje pueden vincularse al depósito y mantener sus unidades originales.

## Mapa y conectividad

El panel se puede ocultar y el mapa ampliar. El encabezado compacto y el panel con desplazamiento propio aprovechan la altura disponible. Tipo de lugar, estado y búsqueda se combinan: por ejemplo Potrero + Con tareas pendientes. Limpiar filtros muestra nuevamente todos los lugares. Una parcela con ganado y cultivo aparece en ambos filtros de uso. Los conteos del listado y del mapa usan la misma consulta de ubicaciones actuales.

Las acciones se adaptan al lugar: Mover animales y Registrar actividad para un potrero, Entrada/salida de stock para un galpón. Los formularios se abren al elegir una acción y se cierran al guardar o cancelar. Mientras hay una operación abierta, se evita cambiar de lugar por un clic accidental en el mapa. Editar límites sigue accesible en el encabezado de la ficha; no modifica la información de los animales.

Los borradores del dibujo se conservan por usuario y campo en este dispositivo. Se recuperan al volver o recargar; siguen pendientes hasta pulsar Guardar. Esto no implica que la aplicación funcione completamente sin conexión: las imágenes, las consultas y los guardados necesitan Internet. No se almacenan imágenes satelitales para uso sin conexión.

**Importar límites de Google Earth** acepta KML y GeoJSON de hasta 1 MB y 100 figuras. Cada figura se revisa y guarda individualmente. No se admiten polígonos con huecos, multipolígonos ni KML comprimido/KMZ. Coordenadas WGS84, hasta 500 vértices por figura. Las figuras nuevas no reemplazan automáticamente lugares existentes.

La superficie del dibujo es aproximada. La suma de hectáreas declaradas de parcelas no sustituye la superficie catastral ni detecta automáticamente límites dibujados que se superponen.

## Despliegue

Migración nueva: `20260919210000_potreros_operacion`. Agrega registros por lugar, vínculos de documentos, depósitos y movimientos de stock, y tipos cartográficos. No elimina datos existentes. Aplicada primero en la rama aislada `codex-mapa-campo`. La base principal y el merge siguen sujetos a la autorización pendiente de la entrega anterior.

## Referencia técnica

La edición usa los eventos de arrastre y la actualización de puntos de Leaflet, evitando recrear los controles durante el movimiento: https://leafletjs.com/reference.html#marker-drag y https://leafletjs.com/reference.html#polyline-setlatlngs.

## Validación

157 pruebas unitarias, incluida la actualización del contorno durante el evento de arrastre; 69 pruebas HTTP de regresión del ERP; 90 comprobaciones HTTP específicas de Potreros (conteos, traslados, permisos, tareas, agua, campañas, stock concurrente y adjuntos); 14 controles estáticos y análisis de seguridad de la migración. También se verificaron en navegador el arrastre, deshacer/rehacer, recuperación del borrador después de recargar, ficha, separación de especies, alta de una tarea ficticia, importación KML y visualización a 390 px.

## Próximas mejoras

- Reunir las tareas registradas en lugares con la agenda general del módulo Tareas.
- Incorporar asignación o transferencia del stock histórico sin depósito, con conciliación y unidades explícitas por producto.
- Detectar superposición entre límites de parcelas antes de sumar superficies del mapa.
- Extender importaciones a KMZ, multipolígonos y edición de subdivisiones.
- Incorporar captura de actividad sin conexión con una cola que permita revisar conflictos antes de sincronizar; hoy se conservan borradores de dibujos.
