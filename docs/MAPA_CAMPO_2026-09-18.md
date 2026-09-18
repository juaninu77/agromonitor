# Mapa del campo

Potreros ahora reúne el mapa y la gestión de sectores. La ruta `/mapa` conduce a la misma herramienta para evitar dos versiones separadas.

## Cómo empezar

1. Elegí el campo en el selector superior. Cada campo conserva sus propios lugares.
2. En **Potreros → Mapa del campo → Ubicar campo**, buscá una localidad de Argentina. Hay accesos a **Sarmiento, Chubut**, y **General Conesa, Río Negro**. También podés pegar coordenadas decimales en orden **latitud, longitud**.
3. Acercate hasta encontrar el predio. El buscador ubica una localidad, no identifica automáticamente tu propiedad.
4. Usá **Dibujar área** para potreros, zonas de cultivo o superficies de instalaciones: marcá las esquinas, elegí **Terminar contorno**, completá nombre/tipo y guardá. Los vértices se pueden arrastrar para corregir el límite.
5. Usá **Marcar lugar** para un galpón, aguada, tanque, casa o puesto. Agregá una descripción de lo que hay allí y guardá.
6. Elegí un lugar del mapa o de la lista para consultar su información. El botón de centrar vuelve a mostrar los lugares visibles; los filtros permiten separar tipos o encontrar sectores pendientes de ubicar.

Para ubicar un potrero ya cargado, seleccioná su nombre en la lista y elegí **Dibujar área** o **Ubicar punto**. No es necesario crearlo otra vez. En **Sectores y pastoreo** se mantienen superficie declarada, capacidad, agua, sombra, balanza, mediciones y asignaciones. Se corrigió el formulario de edición para actualizar el sector existente mediante PATCH.

## Información vinculada

- El mapa usa los mismos sectores que ganado, pastoreo y cultivos.
- Los conteos de bovinos y ovinos consideran animales activos con ubicación individual vigente en ese sector. No representan seguimiento GPS.
- Los pastoreos declarados por lote se muestran aparte: no se confunden con la ubicación individual de cada animal.
- Los cultivos visibles provienen de los registros de forraje sin fecha de cierre. Dibujar un área llamada “Alfalfa” no registra por sí solo una siembra: esa operación se completa en Cultivos.
- Un galpón admite ubicación y descripción. El enlace a Inventario permite consultar suministros; todavía no existe distribución automática del stock por depósito.
- La superficie dibujada es aproximada y se calcula sobre coordenadas geográficas. No reemplaza la superficie declarada ni una mensura.
- GeoJSON exporta las geometrías y descripciones de los lugares guardados del campo, sin imágenes satelitales ni fichas personales. Es una base interoperable para futuras importaciones GIS/KML.

## Ejemplo ficticio

En **La Alameda · DEMO** se ubicaron tres sectores existentes cerca de Sarmiento y se agregaron un galpón y un tanque de agua. Los contornos son deliberadamente ficticios: no identifican propiedades reales. Durante la revisión se creó **Avena de prueba · MAPA** y se ajustó un vértice, pasando de aproximadamente 2,13 a 2,60 ha.

## Validación

- TypeScript y compilación de producción aprobados.
- **143 pruebas automáticas** en 17 archivos, incluidas 14 sobre geometría y datos de sectores.
- **37 comprobaciones HTTP/PostgreSQL** del mapa: alta de polígonos/puntos, persistencia, edición sin duplicados, concurrencia, roles, aislamiento entre campos, geometrías inválidas, tamaño máximo y vínculos con animales/cultivos.
- **50 regresiones HTTP** del ERP aprobadas y **14 controles estáticos** del repositorio.
- Navegador: imágenes satelitales reales, selección de Potrero Norte con 10 bovinos y 25 ha de alfalfa, dibujo de un área, arrastre de vértice, recálculo de superficie y guardado.

Las pruebas con escritura usan exclusivamente la rama Neon `br-muddy-bread-ahrdgo8k`, copia del escenario de ensayo anterior. Los scripts requieren confirmar host de ensayo y rechazan el endpoint principal conocido. Se agregaron `sectores.geometria` (GeoJSON) y `sectores.version`, y se amplió el CHECK de tipos manteniendo todos los anteriores. No hay eliminación de sectores ni cambios en sus relaciones.

Las bibliotecas previamente declaradas como `latest` se fijaron a sus versiones ya presentes en el lockfile. Esto impide que incorporar el mapa actualice incidentalmente controles de interfaz y gráficos.

## Proveedores y límites

- Motor: [Leaflet](https://leafletjs.com/reference.html); geometría y superficie: [Turf](https://turfjs.org/docs/api/area).
- Localidades: [Georef Argentina](https://www.argentina.gob.ar/georef), consultado al enviar la búsqueda y con caché. Las coordenadas de los accesos rápidos se verificaron contra su API.
- Vista de calles: [OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/), con atribución visible y sin precarga de áreas para uso sin conexión.
- Vista satelital: [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9), sujeta a cobertura, disponibilidad y términos del proveedor. No se exportan ni precargan imágenes. La fecha y resolución varían por zona; no son imágenes en tiempo real. Antes de ofrecer el ERP comercialmente, revisar la modalidad/licencia del proveedor de imágenes que se vaya a contratar.

El mapa necesita conexión para las imágenes y para guardar. Las figuras admitidas en esta entrega son puntos y polígonos simples de hasta 500 vértices, sin agujeros ni cruces. No se incluyen todavía importación KML, edición de caminos lineales, catastro oficial, stock por depósito ni trabajo sin conexión. Los cambios sin guardar deben terminarse o cancelarse antes de cambiar de campo o de sección.

## Próximas mejoras

1. Asociar existencias a depósitos y mostrar el stock del galpón seleccionado.
2. Abrir desde el mapa un listado de animales filtrado por sector y preparar movimientos con revisión de origen/destino.
3. Importar KML/GeoJSON de Google Earth o de un agrimensor, con vista previa antes de crear sectores.
4. Agregar caminos, tranqueras y límites generales del campo como capas independientes.
5. Incorporar historial de cambios de límites y mediciones con fecha.
