# Diseño y ensayo de campo

## Convenciones de interfaz

El contenedor `AppShell` define el margen exterior una sola vez: 16 px en celular, 24 px en tablet y 32 px en escritorio, con ancho máximo de 1440 px. Las páginas no deben repetir ese padding. La navegación usa un lateral de 240 px desde 1024 px y un menú desplegable en pantallas menores.

Los tokens de `app/globals.css` y `tailwind.config.ts` son la fuente de colores. Usar `background`, `card`, `foreground`, `muted-foreground`, `border`, `primary` y los estados semánticos; evitar blanco, gris o azul fijos para superficies y texto. La acción principal usa verde. Un estado debe incluir texto además del color. El modo oscuro utiliza los mismos componentes.

| Elemento | Convención |
| --- | --- |
| Título de página | `PageHeading`: contexto del campo, título, explicación y acción principal |
| Tipografía | Fuente global; título 24/30 px, subtítulo 18 px, cuerpo 14/16 px, etiqueta 12/14 px |
| Espaciado | Escala de 4 px; 24 px entre secciones, 16 px entre controles |
| Formularios | `erp-field`, `Input`, `erp-select`; etiqueta visible, requerido explícito, error junto al formulario |
| Tarjetas | `Card`; borde fino, radio consistente, sombra discreta; sin animación de hover si no es interactiva |
| Estados | `StatusPill`; neutral, correcto, advertencia, error |
| Respuestas | `role=status` al guardar, `role=alert` al fallar; botón bloqueado mientras guarda |
| Datos ausentes | “Sin dato”, “Sin asignar” o “Sin definir”; no inventar salud ni valuaciones |
| Accesibilidad | Foco visible, enlace para saltar al contenido, etiquetas y menú por teclado, movimiento reducido |

Las pantallas nuevas usan estos componentes. Las pantallas históricas conservan su estructura especializada y adoptan contenedor y colores semánticos; su migración progresiva a `PageHeading` evita otra reescritura completa.

## Entorno ficticio

La rama Neon `codex-diseno-flota-forrajes` contiene el escenario de demostración. Los datos reales de main no reciben este seed. Los scripts verifican host de prueba y rechazan el host de producción.

- Propietario demo: `demo.campo@example.invalid`, contraseña `CampoDemo-2026!`.
- Operario demo: `operario.campo@example.invalid`, misma contraseña. Puede consultar Flota/Cultivos, pero no modificarlos. Otros módulos conservan sus permisos propios.
- Organización: **Campo de demostración**. Seleccionar **La Alameda · DEMO** en el encabezado.
- **El Molino · DEMO** empieza vacío: sirve para verificar el cambio de campo.
- El seed agrega 18 animales (bovinos y ovinos), 3 lotes, 3 sectores, 36 pesadas, 8 eventos sanitarios ficticios, 3 equipos y patrimonios, 2 cultivos, 2 reservas, un comprobante, un trámite y una tarea. Las pruebas posteriores agregan registros identificados como ensayo.
- Todas las caravanas, RENSPA, productos, importes y documentos de ensayo carecen de validez oficial.

## Recorridos para probar sin saber programar

| Recorrido | Pasos | Resultado esperado |
| --- | --- | --- |
| Identificar un animal | Ganado → buscar `DEMO-001` → abrir ficha | Caravana, categoría, peso, Vacas de cría y Potrero Norte coinciden |
| Preparar información | Ficha → Ficha / SENASA | Datos internos presentes; aviso explícito de que no autoriza traslados |
| Encontrar faltantes | Buscar `DEMO-012` → Ficha / SENASA | Faltan RFID, lote y ubicación; no se muestra “apto” |
| Alta de animal | Registrar → especie bovino, Angus, vaca, hembra, caravana nueva, lote y sector | Una sola alta; búsqueda por caravana y ficha reflejan lote/ubicación |
| Buscar rápido | Buscador superior → caravana → resultado | Se abre la ficha exacta del animal del campo seleccionado |
| Mantenimiento | Flota → Camioneta de recorridas | Servicio vencido por fecha y lectura; historial visible |
| Registrar servicio | Cargar fecha de hoy, lectura igual o superior a actual, detalle y próxima lectura mayor | Se agrega historial y recalcula el aviso; no acepta retroceder el medidor |
| Cultivo | Cultivos y Forrajes → Registrar siembra → sector, alfalfa/avena, fecha y superficie | La superficie debe ser positiva y no superar el área del sector |
| Cerrar campaña | Finalizar cultivo con fecha posterior a siembra | Queda finalizado; no se cierra dos veces |
| Controlar reservas | Reservas de forraje → Fardos de alfalfa → Salida / consumo de 10 | Saldo inicial 240 pasa a 230 y registra motivo e historial |
| Stock bajo | Revisar Rollos de avena | 8 rollos con mínimo 10 muestran aviso de reposición |
| Error de stock | Intentar consumir más que la existencia | Se rechaza y saldo/historial no cambian |
| Patrimonio | Administración → Patrimonio | Los equipos de Flota también existen como activos; no hay que duplicarlos |
| Comprobante y adjunto | Administración → Comprobantes → crear factura; Documentos → vincular y cargar PDF/JPG/PNG | Archivo privado descargable, vinculado al comprobante, máximo 2 MiB por archivo |
| Cambiar campo | Selector → El Molino · DEMO | Listas vacías y panel sin cifras de La Alameda |
| Permisos | Ingresar como operario demo | Flota/Cultivos consultables, botones de escritura deshabilitados |

## Pruebas reproducibles

`pnpm type-check`, `pnpm lint`, `pnpm test:ci`, `pnpm db:audit` y `pnpm build` validan código. Las pruebas HTTP requieren servidor local conectado a la **misma** rama de ensayo y variables `DATABASE_URL`, `ERP_TEST_DATABASE_HOST`, `ERP_TEST_WRITES=confirmed-test-branch` y `ERP_TEST_URL`.

- `pnpm exec tsx scripts/seed-demo-campo.ts`: escenario idempotente; conserva los cambios si ya existe.
- `pnpm exec tsx scripts/test-campo-http.ts`: mantenimiento, lecturas, cultivos, inventario de forrajes, consumo concurrente, reintentos, permisos, alta y ficha animal, alcance del panel y recuperación de contraseña.
- `pnpm exec tsx scripts/test-administracion-http.ts`: comprobantes, patrimonio, adjuntos, descargas, conflictos e aislamiento entre organizaciones.
- `pnpm exec tsx scripts/test-erp-http.ts`: registro, sesión, catálogos, alta atómica, pesadas y páginas principales.
- `pnpm exec tsx scripts/test-neon-integration.ts`: además requiere `NEON_TEST_DATABASE_HOST`; consulta todos los modelos y prueba restricciones con rollback.

Los scripts HTTP generan nuevos registros de ensayo en cada ejecución. El test de stock comprueba que dos consumos simultáneos no puedan vender o consumir la misma existencia. Las pruebas no sustituyen una jornada real con balanza, lector RFID, conectividad rural y revisión veterinaria.
