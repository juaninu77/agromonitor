-- Reconciliación de pertenencias por evidencia; no asigna registros ambiguos.
-- Ejecutar dentro de una transacción, después de reconcile-neon-legacy.sql.
WITH sources AS (
  SELECT h.animal_id,l.establecimiento_id FROM animal_lote_hist h JOIN lotes l ON l.id=h.lote_id WHERE h.hasta IS NULL
  UNION SELECT h.animal_id,s.establecimiento_id FROM ubicacion_hist h JOIN sectores s ON s.id=h.sector_id WHERE h.hasta IS NULL
), candidates AS (
  SELECT animal_id,min(establecimiento_id::text)::uuid AS establecimiento_id FROM sources GROUP BY animal_id HAVING count(DISTINCT establecimiento_id)=1
)
UPDATE animales a SET establecimiento_id=c.establecimiento_id FROM candidates c WHERE a.id=c.animal_id AND a.establecimiento_id IS NULL;

WITH sources AS (
  SELECT a.especie_id,e.organizacion_id FROM animales a JOIN establecimientos e ON e.id=a.establecimiento_id
  UNION SELECT l.especie_id,e.organizacion_id FROM lotes l JOIN establecimientos e ON e.id=l.establecimiento_id
), candidates AS (
  SELECT especie_id,min(organizacion_id::text)::uuid AS organizacion_id FROM sources GROUP BY especie_id HAVING count(DISTINCT organizacion_id)=1
)
UPDATE especies s SET organizacion_id=c.organizacion_id FROM candidates c WHERE s.id=c.especie_id AND s.organizacion_id IS NULL;

UPDATE razas r SET organizacion_id=s.organizacion_id FROM especies s WHERE r.especie_id=s.id AND r.organizacion_id IS NULL AND s.organizacion_id IS NOT NULL;
UPDATE categorias c SET organizacion_id=s.organizacion_id FROM especies s WHERE c.especie_id=s.id AND c.organizacion_id IS NULL AND s.organizacion_id IS NOT NULL;

WITH sources AS (
  SELECT s.producto_id,e.organizacion_id FROM evt_sanidad s JOIN animales a ON a.id=s.animal_id JOIN establecimientos e ON e.id=a.establecimiento_id
  UNION SELECT s.producto_id,e.organizacion_id FROM evt_sanidad s JOIN lotes l ON l.id=s.lote_id JOIN establecimientos e ON e.id=l.establecimiento_id
  UNION SELECT s.producto_sanidad_id,e.organizacion_id FROM sesiones_manga s JOIN establecimientos e ON e.id=s.establecimiento_id WHERE s.producto_sanidad_id IS NOT NULL
), candidates AS (
  SELECT producto_id,min(organizacion_id::text)::uuid AS organizacion_id FROM sources GROUP BY producto_id HAVING count(DISTINCT organizacion_id)=1
)
UPDATE productos p SET organizacion_id=c.organizacion_id FROM candidates c WHERE p.id=c.producto_id AND p.organizacion_id IS NULL;

WITH sources AS (
  SELECT p.dieta_id,e.organizacion_id FROM planes_alimentacion p JOIN lotes l ON l.id=p.lote_id JOIN establecimientos e ON e.id=l.establecimiento_id
  UNION SELECT p.dieta_id,e.organizacion_id FROM evt_alimentacion p JOIN lotes l ON l.id=p.lote_id JOIN establecimientos e ON e.id=l.establecimiento_id WHERE p.dieta_id IS NOT NULL
), candidates AS (
  SELECT dieta_id,min(organizacion_id::text)::uuid AS organizacion_id FROM sources GROUP BY dieta_id HAVING count(DISTINCT organizacion_id)=1
)
UPDATE dietas d SET organizacion_id=c.organizacion_id FROM candidates c WHERE d.id=c.dieta_id AND d.organizacion_id IS NULL;
