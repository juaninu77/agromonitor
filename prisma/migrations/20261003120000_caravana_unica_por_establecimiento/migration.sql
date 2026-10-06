-- La caravana visual es una numeración interna de cada campo: deja de ser
-- única a nivel global y pasa a ser única por establecimiento. RFID y CUIG
-- siguen siendo únicos globales (identificadores oficiales de por vida).
DROP INDEX IF EXISTS "animales_caravana_visual_key";
CREATE UNIQUE INDEX "animales_establecimiento_id_caravana_visual_key"
  ON "animales"("establecimiento_id", "caravana_visual");

-- Índice compuesto para el listado por defecto (campo + estado)
CREATE INDEX IF NOT EXISTS "animales_establecimiento_id_estado_vital_idx"
  ON "animales"("establecimiento_id", "estado_vital");
