# Validación de Ganado por especie

Fecha: 18/09/2026. Rama de código: `codex/ganado-especies-ux`.

## Entorno

- Preview local en `http://127.0.0.1:3101`.
- Neon: proyecto AgroMonitor `sparkling-morning-18269506`, rama aislada `br-rapid-lab-ah0ys0ns` (`codex-ganado-especies-ux`).
- La rama copia el escenario de ensayo anterior `br-square-paper-ahs1bmse`; no se modificaron datos ni esquema de la rama principal.
- No se agregaron migraciones. La separación utiliza la relación de especie ya existente.
- Credenciales y conexiones quedan fuera del repositorio. Los scripts de datos requieren confirmar explícitamente el host de ensayo y `ERP_TEST_WRITES=confirmed-test-branch`.

## Comprobaciones

| Comprobación | Resultado |
| --- | --- |
| TypeScript | Aprobado |
| Vitest: 16 archivos | 129 tests aprobados |
| `scripts/test-ganado-especies-http.ts` | 49 comprobaciones aprobadas |
| Regresión `scripts/test-erp-http.ts` | 50 comprobaciones aprobadas |
| Auditoría estática de código y esquema | 14/14; no es una auditoría de datos de producción |
| Compilación de producción y lint | Aprobados; continúan advertencias históricas de hooks en otros módulos |

Las 228 pruebas funcionales son 129 + 49 + 50. La auditoría estática se informa por separado. No se afirma que todos los escenarios posibles del ERP estén cubiertos.

## Casos comprobados contra PostgreSQL

La prueba genera un campo `Ensayo especies …` separado de La Alameda, con 30 ovinos activos, un bovino y un ovino vendido, además de un alta individual. Comprueba:

- Listas, resúmenes y reportes separados por especie y campo.
- Segunda página sin duplicados, búsqueda por RFID de un animal que no estaba en la primera página y orden estable.
- Consulta de vendidos, vista conjunta y campo vacío.
- Rechazo de filtros inválidos y acceso a un campo de otra organización.
- Alta ovina; rechazo de raza y lote bovinos en ese alta.
- Edición de notas y rechazo de cambio de especie desde la edición común.
- Rechazo de movimiento a lote de otra especie y movimiento válido a una majada.
- Dos pesadas del mismo día: prevalece la última registrada.
- Evento sanitario con el producto exacto de su organización; rechazo de producto ajeno.
- Ficha con historia de pesadas y sanidad y endpoint de preparación documental.
- Promedio y cantidad de pesadas calculados sobre todas las páginas.

## Revisión en navegador

Se recorrieron El Molino vacío y La Alameda poblada. Se creó `UX-OV-1809` desde el asistente ovino y se registró una pesada. Se registraron `UX-MAJ-01` y `UX-MAJ-02` desde Masivo. Se comprobó la preselección de especie, raza Merino y categoría oveja; la selección en pesada devolvió la oveja buscada. La última pesada se mostró en el listado después de corregir el desempate por fecha.

La revisión responsive incluyó 390 × 844 y la vista de escritorio del navegador. En celular se usan tarjetas y filtros desplegables. La revisión no equivale a una certificación completa de accesibilidad ni a pruebas con usuarios independientes.

`scripts/seed-demo-especies.ts` completa de forma repetible las categorías faltantes de machos y hembras de la organización ficticia, sin reemplazar registros existentes. Permite probar altas de carneros y corderos además de ovejas.

## Alcance y límites

El nombre histórico `/api/ganado/bovinos` se mantiene por compatibilidad: el parámetro `especie` filtra las vistas nuevas. Otros consumidores existentes pueden seguir consultando varias especies. Los filtros avanzados históricos de peso/condición corporal no se ampliaron en esta entrega. La carga documental y el checklist de SENASA siguen siendo preparación de información, sin emisión de trámites oficiales.

La exportación recorre páginas del mismo filtro. No proporciona una instantánea transaccional frente a altas o bajas simultáneas durante una exportación grande. Para grandes volúmenes, el siguiente paso es una exportación en servidor con consistencia de instantánea.

El estudio y las mejoras siguientes están en `ESTUDIO_UX_GANADO_2026-09-18.md`.
