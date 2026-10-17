-- Asistente de WhatsApp, entrega 3: eventos de hacienda propuestos por WhatsApp que esperan
-- confirmación o validación, y el costo de transcribir notas de voz. Solo agrega (una tabla y
-- una columna): nunca borra ni modifica datos.

ALTER TABLE "whatsapp_mensajes" ADD COLUMN IF NOT EXISTS "costo_audio_usd" DECIMAL(12,6);

CREATE TABLE IF NOT EXISTS "whatsapp_borradores" (
    "id" UUID NOT NULL,
    "vinculo_id" UUID,
    "usuario_id" UUID NOT NULL,
    "establecimiento_id" UUID NOT NULL,
    "accion" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "resumen" TEXT NOT NULL,
    "origen" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "expira" TIMESTAMP(3) NOT NULL,
    "error" TEXT,
    "resultado" JSONB,
    "validado_por_id" UUID,
    "validado_at" TIMESTAMP(3),
    "motivo_rechazo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_borradores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "whatsapp_borradores_establecimiento_id_estado_idx" ON "whatsapp_borradores"("establecimiento_id", "estado");
CREATE INDEX IF NOT EXISTS "whatsapp_borradores_usuario_id_created_at_idx" ON "whatsapp_borradores"("usuario_id", "created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_borradores_vinculo_id_estado_idx" ON "whatsapp_borradores"("vinculo_id", "estado");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_borradores_vinculo_id_fkey') THEN
    ALTER TABLE "whatsapp_borradores" ADD CONSTRAINT "whatsapp_borradores_vinculo_id_fkey" FOREIGN KEY ("vinculo_id") REFERENCES "whatsapp_vinculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_borradores_usuario_id_fkey') THEN
    ALTER TABLE "whatsapp_borradores" ADD CONSTRAINT "whatsapp_borradores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_borradores_validado_por_id_fkey') THEN
    ALTER TABLE "whatsapp_borradores" ADD CONSTRAINT "whatsapp_borradores_validado_por_id_fkey" FOREIGN KEY ("validado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_borradores_establecimiento_id_fkey') THEN
    ALTER TABLE "whatsapp_borradores" ADD CONSTRAINT "whatsapp_borradores_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
