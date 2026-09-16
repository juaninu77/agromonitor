# Revisión funcional y refactor de AgroMonitor

Base revisada: `5faecc9` (rama `main`). Trabajo: `codex/agromonitor-refactor`.

## Alcance

Revisión del código de autenticación compartida, selección de organización,
movimientos de ganado, inventario y flujo de manga (pantalla, API, CSV y cola
sin conexión). No es una certificación de todos los módulos del ERP ni una
auditoría completa de seguridad.

## Errores corregidos

| Problema anterior | Comportamiento corregido |
| --- | --- |
| El botón Finalizar hacía PATCH del estado, sin ejecutar la generación de eventos. | Llama a POST `/api/manga/:id/finalizar`, que registra pesadas, sanidad y tactos. |
| PATCH permitía finalizar sin eventos y reabrir sesiones ya procesadas. | PATCH permite activa/pausada; una sesión finalizada no admite escrituras. |
| Dos cierres podían generar eventos duplicados. El cierre podía competir con altas o importaciones. | Todas las escrituras toman el mismo bloqueo de fila dentro de una transacción. Una operación sobre una sesión finalizada recibe 409. |
| Un alta creaba el animal fuera de la transacción que guardaba la lectura. | Animal, lectura y contador se guardan juntos; el fallo aborta toda la operación. |
| La sesión podía referenciar un animal de otro establecimiento accesible. | El animal debe pertenecer al establecimiento de la sesión. |
| Las lecturas CSV no se vinculaban a los animales existentes. | Se buscan sus EID en el establecimiento de la sesión y se guarda el animal asociado. |
| El CSV guardaba lecturas y contador por separado; aceptaba fechas inválidas. | Inserción por lote y contador dentro de la misma transacción, con validación de fechas y tamaño. |
| Se podía finalizar con lecturas pendientes locales. | Primero se intenta sincronizarlas; si quedan pendientes, se impide el cierre. |
| La cola offline informaba éxito antes del commit de IndexedDB y abría conexiones sin cerrarlas. | Espera `oncomplete`, rechaza abortos y cierra las conexiones de las operaciones refactorizadas. |
| Dos disparadores de sincronización en una misma pestaña podían enviar la misma cola. | Comparten una promesa por sesión mientras la sincronización está en curso. |
| Un movimiento de lote podía combinar establecimientos, rechazar IDs repetidos y descartar el motivo. | Valida el establecimiento, deduplica IDs y conserva el motivo. Rechaza fechas inválidas o anteriores a movimientos registrados. |
| Paginación de movimientos de inventario aceptaba ceros, negativos, texto y límites ilimitados. | Valida enteros positivos, límites de hasta 100 y rangos numéricos seguros antes de consultar Prisma. |
| `withAuth` no capturaba rechazos asíncronos del handler. | Espera el handler dentro del `try` y devuelve un error JSON controlado. |
| El segundo argumento opcional de `withAuth` impedía compilar las rutas con los tipos generados por Next.js 15. | El controlador expone el contexto requerido por Next.js; las pruebas usan esa misma firma. |
| Selección de organización podía aplicar respuestas viejas en cambios A→B→A, conservar datos al salir o ignorar recargas tras altas. | Cancela solicitudes anteriores, limpia el contexto al cambiar de usuario y permite recargar establecimientos. |

También se declaran explícitamente los tipos globales de TypeScript para evitar
que un paquete transitivo de tipos obsoleto (`@types/minimatch`) impida la
comprobación en instalaciones con dependencias aplanadas.

## Validación

- `pnpm test:ci`: 46 pruebas aprobadas en 8 archivos; 40 pruebas nuevas.
- `pnpm type-check`: aprobado.
- `pnpm lint`: aprobado con advertencias existentes de hooks y JSX.
- `pnpm build`: aprobado en una copia temporal con código y dependencias fuera
  del disco D:, con 61 páginas generadas. Los primeros intentos en D: fallaron
  por `EISDIR` al leer archivos. Al aislar el entorno se detectó y corrigió el
  error real de la firma de las rutas de Next.js 15.
- No se ejecutaron migraciones ni operaciones sobre una base de datos real.

Las pruebas de API usan dobles de Prisma: verifican validaciones, alcance por
establecimiento, límites transaccionales y las respuestas. No sustituyen una
prueba concurrente contra PostgreSQL. IndexedDB se verifica con dobles de sus
eventos de commit/abort. La selección de organizaciones requiere además una
prueba manual en navegador con varias organizaciones.

## Hallazgos pendientes y decisiones de producto

1. **Recuperación de contraseña sin entrega de correo.**
   `app/api/auth/forgot-password/route.ts` crea un token y muestra un mensaje
   de envío, pero solo implementa logs y un token de desarrollo. Falta elegir
   y configurar el proveedor de correo, implementar la entrega y probarla.
   Los tokens no deben registrarse en logs de producción.
2. **Reintentos offline entre pestañas/dispositivos.** La exclusión agregada
   cubre llamadas simultáneas dentro de una pestaña. Si el servidor guarda una
   lectura y se pierde la respuesta, el reintento todavía puede duplicarla.
   Hace falta un identificador estable de lectura y una restricción única
   persistente; requiere migración y un contrato de idempotencia de la API.
3. **EID desconocidos en CSV.** La importación conserva lecturas sin animal
   asociado cuando el EID no existe. El cierre no genera eventos para ellas.
   Falta un flujo de conciliación o alta que solicite los datos obligatorios;
   no se deben inventar animales para resolverlo automáticamente.
4. **Sesiones finalizadas por el flujo anterior.** Esta corrección evita nuevos
   cierres incompletos; no reconstruye eventos históricos. Antes de cualquier
   reparación de datos se debe identificar cuáles sesiones tienen eventos ya
   generados, para no duplicarlos.
5. **Prueba funcional con datos de ensayo.** Revisar los cambios de organización,
   pesadas y tratamientos desde la interfaz, y la concurrencia en PostgreSQL,
   con una base de pruebas independiente.
6. **Autenticación y Edge Runtime.** La compilación advierte que `auth.config.ts`
   importa Prisma, utilizado para reparar JWT antiguos, y ese archivo también
   se carga desde el middleware Edge. Conviene separar esa recuperación en el
   runtime Node o invalidar explícitamente las sesiones antiguas; requiere
   decidir la política de transición de sesiones.

## Prueba manual sugerida

1. Abrir una sesión con un animal conocido; registrar peso y finalizar.
   Comprobar que aparece una sola pesada en su historial.
2. Repetir el cierre desde otra pestaña: debe devolver 409 y no duplicar eventos.
3. Importar CSV con EID conocido y desconocido; verificar asociación del conocido.
4. Registrar una lectura sin conexión e intentar finalizar; debe impedirlo hasta
   que la lectura se sincronice.
5. Cambiar rápidamente de organización A→B→A; verificar que el establecimiento
   seleccionado pertenece a A. Crear un establecimiento y actualizar la lista.
6. Intentar un movimiento a un lote de otro establecimiento; debe rechazarlo.
