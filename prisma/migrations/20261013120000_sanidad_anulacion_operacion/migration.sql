-- Sanidad: aplicaciones masivas (operacion_id compartido) y anulación sin borrar
ALTER TABLE "evt_sanidad" ADD COLUMN     "anulado_at" TIMESTAMP(3),
ADD COLUMN     "anulado_por_id" UUID,
ADD COLUMN     "motivo_anulacion" TEXT,
ADD COLUMN     "operacion_id" UUID;

-- CreateIndex
CREATE INDEX "evt_sanidad_operacion_id_idx" ON "evt_sanidad"("operacion_id");

-- Una anulación siempre lleva su motivo
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evt_sanidad_anulacion_chk') THEN
    ALTER TABLE "evt_sanidad" ADD CONSTRAINT evt_sanidad_anulacion_chk CHECK (anulado_at IS NULL OR motivo_anulacion IS NOT NULL);
  END IF;
END $$;
