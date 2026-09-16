-- Ejecutar SOLO después de confirmar con neon-catalog.sql que existen estas
-- tablas y columnas. Devuelve conteos, no registros personales.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT 'animales_sin_establecimiento' AS check_name, count(*) AS affected_rows FROM animales WHERE establecimiento_id IS NULL
UNION ALL SELECT 'productos_sin_organizacion', count(*) FROM productos WHERE organizacion_id IS NULL
UNION ALL SELECT 'dietas_sin_organizacion', count(*) FROM dietas WHERE organizacion_id IS NULL
UNION ALL SELECT 'especies_sin_organizacion', count(*) FROM especies WHERE organizacion_id IS NULL
UNION ALL SELECT 'razas_sin_organizacion', count(*) FROM razas WHERE organizacion_id IS NULL
UNION ALL SELECT 'categorias_sin_organizacion', count(*) FROM categorias WHERE organizacion_id IS NULL
UNION ALL SELECT 'transito_sin_establecimiento', count(*) FROM documentos_transito WHERE establecimiento_id IS NULL
UNION ALL SELECT 'pesadas_sin_destinatario_unico', count(*) FROM evt_pesada WHERE num_nonnulls(animal_id, lote_id) <> 1
UNION ALL SELECT 'sanidad_sin_destinatario_unico', count(*) FROM evt_sanidad WHERE num_nonnulls(animal_id, lote_id) <> 1
UNION ALL SELECT 'movimientos_sin_destinatario_unico', count(*) FROM evt_movimiento WHERE num_nonnulls(animal_id, lote_id) <> 1
UNION ALL SELECT 'intervalos_lote_invertidos', count(*) FROM animal_lote_hist WHERE hasta < desde
UNION ALL SELECT 'intervalos_ubicacion_invertidos', count(*) FROM ubicacion_hist WHERE hasta < desde;

SELECT 'animales_con_varios_lotes_abiertos' AS check_name, count(*) AS affected_rows
FROM (SELECT animal_id FROM animal_lote_hist WHERE hasta IS NULL GROUP BY animal_id HAVING count(*) > 1) conflicts
UNION ALL
SELECT 'animales_con_varias_ubicaciones_abiertas', count(*)
FROM (SELECT animal_id FROM ubicacion_hist WHERE hasta IS NULL GROUP BY animal_id HAVING count(*) > 1) conflicts;

SELECT 'lote_actual_otro_establecimiento' AS check_name, count(*) AS affected_rows
FROM animal_lote_hist h JOIN animales a ON a.id = h.animal_id JOIN lotes l ON l.id = h.lote_id
WHERE h.hasta IS NULL AND a.establecimiento_id IS DISTINCT FROM l.establecimiento_id;

SELECT 'especie_animal_otra_organizacion' AS check_name, count(*) AS affected_rows
FROM animales a JOIN establecimientos e ON e.id = a.establecimiento_id JOIN especies s ON s.id = a.especie_id
WHERE s.organizacion_id IS DISTINCT FROM e.organizacion_id;

SELECT 'contador_manga_inconsistente' AS check_name, count(*) AS affected_rows
FROM sesiones_manga s
WHERE s.total_animales <> (SELECT count(*) FROM sesion_manga_items i WHERE i.sesion_id = s.id);

SELECT 'lecturas_manga_sin_animal' AS check_name, count(*) AS affected_rows
FROM sesion_manga_items WHERE animal_id IS NULL;
COMMIT;
