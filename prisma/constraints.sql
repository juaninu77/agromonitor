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

-- --------------------------------------------
-- 3) Dominios de valores ("enums" que en el schema son String).
--    El motor valida que no entren valores fuera del conjunto acordado.
--    NOT VALID: no falla con filas viejas; valida solo inserciones/updates nuevos.
--    Cuando la data esté saneada: ALTER TABLE ... VALIDATE CONSTRAINT ...;
-- --------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'animales_estado_vital_chk') THEN
    ALTER TABLE animales ADD CONSTRAINT animales_estado_vital_chk
      CHECK (estado_vital IN ('activo', 'vendido', 'baja', 'muerto')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'animales_sexo_chk') THEN
    ALTER TABLE animales ADD CONSTRAINT animales_sexo_chk
      CHECK (sexo IN ('M', 'F')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sectores_tipo_chk') THEN
    ALTER TABLE sectores ADD CONSTRAINT sectores_tipo_chk
      CHECK (tipo IN ('potrero', 'corral', 'manga', 'feedlot', 'embarcadero', 'enfermeria', 'otro')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evt_baja_motivo_chk') THEN
    ALTER TABLE evt_baja ADD CONSTRAINT evt_baja_motivo_chk
      CHECK (motivo IN ('venta', 'muerte', 'faena', 'descarte', 'robo', 'otro')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evt_tacto_resultado_chk') THEN
    ALTER TABLE evt_tacto ADD CONSTRAINT evt_tacto_resultado_chk
      CHECK (resultado IN ('preñada', 'vacia', 'dudosa', 'absorcion')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tareas_estado_chk') THEN
    ALTER TABLE tareas ADD CONSTRAINT tareas_estado_chk
      CHECK (estado IN ('pendiente', 'en_progreso', 'completada', 'cancelada')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tareas_prioridad_chk') THEN
    ALTER TABLE tareas ADD CONSTRAINT tareas_prioridad_chk
      CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_stock_tipo_chk') THEN
    ALTER TABLE movimientos_stock ADD CONSTRAINT movimientos_stock_tipo_chk
      CHECK (tipo IN ('entrada', 'salida', 'ajuste')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sesiones_manga_estado_chk') THEN
    ALTER TABLE sesiones_manga ADD CONSTRAINT sesiones_manga_estado_chk
      CHECK (estado IN ('activa', 'pausada', 'finalizada')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_log_accion_chk') THEN
    ALTER TABLE audit_log ADD CONSTRAINT audit_log_accion_chk
      CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE')) NOT VALID;
  END IF;
END $$;

-- --------------------------------------------
-- 4) Dinero no negativo (los campos son Decimal(12,2) nullable).
-- --------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evt_baja_precios_no_negativos_chk') THEN
    ALTER TABLE evt_baja ADD CONSTRAINT evt_baja_precios_no_negativos_chk
      CHECK (
        (precio_kg IS NULL OR precio_kg >= 0) AND
        (precio_total IS NULL OR precio_total >= 0)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lotes_producto_costo_no_negativo_chk') THEN
    ALTER TABLE lotes_producto ADD CONSTRAINT lotes_producto_costo_no_negativo_chk
      CHECK (costo IS NULL OR costo >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evt_sanidad_costo_no_negativo_chk') THEN
    ALTER TABLE evt_sanidad ADD CONSTRAINT evt_sanidad_costo_no_negativo_chk
      CHECK (costo IS NULL OR costo >= 0) NOT VALID;
  END IF;
END $$;
