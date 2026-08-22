-- ============================================
-- Constraints que Prisma no puede expresar en el schema.
-- Aplicar con: pnpm db:constraints (prisma db execute)
-- Todo es idempotente (IF NOT EXISTS / guards) y NO destructivo.
-- Respeta .cursor/rules/seguridad-db.md: solo agrega validaciones.
-- ============================================

-- --------------------------------------------
-- 1) XOR animal/lote: los eventos aplican a un animal O a un lote,
--    nunca ambos, nunca ninguno (regla documentada en CLAUDE.md).
-- --------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evt_pesada_animal_xor_lote') THEN
    ALTER TABLE evt_pesada
      ADD CONSTRAINT evt_pesada_animal_xor_lote
      CHECK (num_nonnulls(animal_id, lote_id) = 1) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evt_sanidad_animal_xor_lote') THEN
    ALTER TABLE evt_sanidad
      ADD CONSTRAINT evt_sanidad_animal_xor_lote
      CHECK (num_nonnulls(animal_id, lote_id) = 1) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evt_movimiento_animal_xor_lote') THEN
    ALTER TABLE evt_movimiento
      ADD CONSTRAINT evt_movimiento_animal_xor_lote
      CHECK (num_nonnulls(animal_id, lote_id) = 1) NOT VALID;
  END IF;
END $$;

-- Los constraints se crean NOT VALID para no fallar si hay filas viejas
-- inconsistentes; validan solo filas nuevas. Cuando la data esté limpia:
--   ALTER TABLE evt_pesada     VALIDATE CONSTRAINT evt_pesada_animal_xor_lote;
--   ALTER TABLE evt_sanidad    VALIDATE CONSTRAINT evt_sanidad_animal_xor_lote;
--   ALTER TABLE evt_movimiento VALIDATE CONSTRAINT evt_movimiento_animal_xor_lote;

-- --------------------------------------------
-- 2) Historial temporal: a lo sumo UN intervalo abierto (hasta IS NULL)
--    por animal, para que "ubicación actual" / "lote actual" sea único.
-- --------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS ubicacion_hist_un_abierto_por_animal
  ON ubicacion_hist (animal_id)
  WHERE hasta IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS animal_lote_hist_un_abierto_por_animal
  ON animal_lote_hist (animal_id)
  WHERE hasta IS NULL;

-- Pastoreo: un lote no puede tener dos estadías abiertas en el mismo sector.
CREATE UNIQUE INDEX IF NOT EXISTS evt_pastoreo_abierto_por_lote_sector
  ON evt_pastoreo (lote_id, sector_id)
  WHERE egreso IS NULL;
