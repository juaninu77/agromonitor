# Evidencia de validación — Flota, Cultivos y diseño

Entrega: PR #5, rama `codex/diseno-flota-forrajes`.

## Pruebas ejecutadas

| Prueba | Resultado |
| --- | --- |
| Vitest | 108 pruebas aprobadas en 13 archivos |
| Campo por HTTP + Neon | 69 comprobaciones aprobadas |
| Administración y archivos privados | 70 comprobaciones aprobadas |
| Ganado, catálogos y páginas | 50 comprobaciones aprobadas |
| Modelos y restricciones de Neon | 63 comprobaciones aprobadas; fixtures transaccionales revertidos |
| Auditoría estática del repositorio | 14/14 comprobaciones |
| TypeScript | Sin errores |
| Lint | Sin errores; advertencias históricas de hooks y entidades de texto |
| Build de producción | Compilación, tipos y generación de páginas aprobados |

Total de pruebas unitarias y comprobaciones HTTP/Neon: **360**. No equivale a demostrar ausencia de todos los defectos ni sustituye pruebas con dispositivos de campo.

La revisión visual cubre encabezado y navegación adaptables, panel por campo, búsqueda, ficha animal, formularios y estados de los módulos nuevos. Durante la revisión se corrigieron el encabezado móvil, el campo del panel, el porcentaje superior a 100 y el filtrado de resultados remotos del buscador.

## Base de datos

- Proyecto Neon: `sparkling-morning-18269506`.
- Rama de ensayo: `br-square-paper-ahs1bmse`, `codex-diseno-flota-forrajes`.
- Backup previo a main: `br-rough-bonus-aht1udy5`, `backup-before-campo-20260917`, sin compute.
- Migración `20260917193000_campo`: cuatro tablas nuevas, ampliación de `sector_forrajes`, índices, claves foráneas y trece CHECK.
- Migración aplicada primero en ensayo y luego en main mediante Prisma y conexión directa.
- Las firmas de filas completas de 49 tablas existentes coincidieron antes/después. Para `sector_forrajes` se compararon las columnas históricas excluyendo las tres columnas nuevas: los tres registros conservaron su contenido.
- Main mantiene 34 animales originales. Cero organizaciones demo, equipos o reservas de ensayo en main.

El respaldo no reemplaza una política de copias y restauración periódica. Los datos ficticios viven únicamente en la rama de ensayo y los scripts impiden ejecutarlos contra el host conocido de producción.

## Límites explícitos

La ficha no valida requisitos sanitarios ni emite DT-e. La recuperación de contraseña requiere configurar correo. No se verificó un despliegue en Vercel porque falta identificar su URL/proyecto. Flota y Forrajes confirman operaciones con conexión; no incorporan cola offline. Archivos privados conservan el límite de 2 MiB. El plan de mejora describe las siguientes entregas.
