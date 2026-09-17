# Plan de mejora de AgroMonitor

La entrega actual habilita Flota, siembras/pasturas, reservas de forraje y preparación de información del animal, con diseño compartido y pruebas sobre un campo ficticio. Este plan distingue lo ya usable del trabajo necesario para operar un ERP rural completo.

## 1. Antes de cargar información real a diario

| Prioridad | Mejora | Cómo sabremos que está lista |
| --- | --- | --- |
| Alta | Preview estable en Vercel y separación de entornos | URL pública identificada; cada preview apunta a Neon de pruebas; producción conserva su propia base; inicio de sesión probado desde otro dispositivo |
| Alta | Recuperación de contraseña real | Proveedor de correo y dominio verificado; email recibido; token de un uso con expiración; límites de solicitudes; pruebas de cuenta inexistente, vencimiento y reutilización |
| Alta | Importación asistida de animales y catálogos | Plantilla Excel/CSV, vista previa con errores por fila, detección de caravanas duplicadas, confirmación y transacción; sin cargar parcialmente un lote |
| Alta | Reconciliar catálogos históricos sin organización | Confirmar a qué organización pertenecen la especie ovina, sus razas/categorías y tres productos históricos; migración revisable, sin asignar titularidad por suposición |
| Alta | Una jornada piloto acompañada | Dar de alta, pesar, mover, registrar sanidad y consumir forraje en el campo; contrastar con registro manual; ningún dato perdido o duplicado al reconectar |

Para el hosting hace falta identificar el proyecto/URL real de Vercel. Para correo hace falta elegir o conectar el proveedor y validar el remitente. Hasta entonces, el preview local permite probar y recuperación informa que no hay envío habilitado.

## 2. Completar las operaciones del campo

| Área | Próxima mejora | Criterio de aceptación |
| --- | --- | --- |
| Flota | Intervalos recurrentes, repuestos, combustible y costo por equipo; vincular un patrimonio existente | Un servicio programa el siguiente; costo acumulado comprobable; no duplica el activo; vehículo fuera de servicio identificado |
| Cultivos | Campañas planificadas, labores, cortes/cosechas, rendimiento y control de superficies superpuestas | Distingue planificado de implantado; no ocupa dos veces la misma superficie sin una asociación explícita |
| Forraje | Vincular la cosecha a la reserva desde la UI y alimentar un lote mediante relación estructurada | Producción suma stock una sola vez; consumo registra el lote destinatario; conciliación de kilos/fardos sin conversiones inventadas |
| Forraje | Correcciones reversibles y edición del stock mínimo | Un error se corrige con movimiento compensatorio, motivo y autor; nunca se borra el historial |
| Sanidad | Consolidar eventos individuales y grupales con vigencia y retiro | Veterinario puede revisar tratamientos aplicables al animal por historia de lote; ninguna etiqueta de salud deducida solo de una carga |
| SENASA | Checklist por tipo de movimiento, destino, especies y requisitos vigentes | Validación profesional del circuito; adjuntar DT-e oficial; ERP nunca confunde ficha interna con documento emitido por SENASA |
| Documentación | Archivos más grandes, versiones, búsqueda y vista previa | Almacenamiento privado con enlaces temporales, cuota por organización, control de contenido y recuperación; superar el límite inicial de 2 MiB sin cargar binarios en cada consulta |
| Tareas | Unificar alertas de mantenimiento, trámites, stock y sanidad | Bandeja por campo y responsable; avisos deduplicados, vencimiento y cierre trazables |

Hoy el movimiento de forraje lleva un motivo libre y la UI muestra los últimos diez movimientos o servicios. Son registros operativos básicos; faltan historial completo filtrable, enlace visual de cosecha/reserva y programación recurrente. Las campañas permiten registrar cada superficie individual, pero todavía no concilian la ocupación total simultánea del potrero.

## 3. Finanzas y gestión patrimonial

1. Incorporar renglones de factura, impuestos, pagos parciales, saldo y vencimientos. El comprobante actual registra importe total y estado; no representa todavía una cuenta corriente ni contabilidad completa.
2. Relacionar gastos con equipo, cultivo o lote, conservando moneda y tipo de cambio utilizado. No sumar ARS y USD como si fueran equivalentes.
3. Agregar titularidad, contratos, amortizaciones y valuaciones por fecha al patrimonio. No usar un precio fijo por kilo como valuación automática del ganado.
4. Diseñar importación de comprobantes y eventual OCR con revisión humana antes de confirmar. Integraciones con ARCA/SENASA necesitan credenciales, alcance y validación propios; no están implementadas por esta entrega.

## 4. Calidad, seguridad y mantenimiento

- Extender las pruebas HTTP a todas las transiciones de reproducción, ventas, movimientos entre campos y sanidad grupal. Revisar permisos por acción: el rol operario no tiene necesariamente la misma capacidad en todos los módulos históricos.
- Ejecutar pruebas de integración en CI contra una rama efímera de Neon; hoy CI ejecuta tipos, lint, unitarias, auditoría estática y build, mientras los ensayos de Neon se ejecutan de forma explícita.
- Ampliar validación de entrada en rutas históricas: fechas imposibles/futuras, identificadores repetidos, pesos y dosis fuera de dominio; devolver mensajes útiles sin errores genéricos.
- Fortalecer relaciones entre campo, cultivo, reserva y animal también en restricciones compuestas del motor, además de los filtros del API; ensayar carreras de concurrencia y migraciones.
- Reducir las advertencias históricas de dependencias de hooks; dividir las pantallas grandes de Ganado/Ventas y completar su migración al sistema de diseño. Medir tiempos de respuesta con muchos animales, sin consultar todos para cada resumen.
- Revisar cobertura del modo sin conexión y limpieza de caché al cambiar usuario. Flota, Cultivos y Administración requieren conexión para confirmar escrituras; no prometer que todo el ERP funciona offline.
- Registrar errores de servidor y acciones sensibles con identificadores de seguimiento, sin contraseñas ni archivos en logs. Definir retención y ensayo periódico de restauración de backups.
- Revisar el esquema y los casos de uso con el encargado y el veterinario antes de declarar listo el sistema para decisiones operativas o trámites reales.

## Orden propuesto

Primero probar juntos los recorridos de `DISENO_Y_PRUEBAS_CAMPO.md` y anotar dónde el lenguaje o los pasos no coinciden con el trabajo real. Luego estabilizar hosting/correo/importaciones. Después completar cosecha-consumo, mantenimiento y sanidad. Finalmente conectar finanzas e integraciones oficiales, con criterios de aceptación por circuito.
