-- Asistente de WhatsApp. Las tablas se crearon a mano en cada base cuando salió la
-- entrega 1 (#153); esta migración las registra (IF NOT EXISTS: no toca lo que ya existe)
-- y agrega el uso de Claude por consulta. Solo agrega: nunca borra ni modifica datos.

CREATE TABLE IF NOT EXISTS "whatsapp_vinculos" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "wa_id" TEXT,
    "codigo_hash" TEXT,
    "codigo_expira" TIMESTAMP(3),
    "verificado_at" TIMESTAMP(3),
    "establecimiento_activo_id" UUID,
    "recordatorios" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_vinculos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "whatsapp_mensajes" (
    "id" UUID NOT NULL,
    "wamid" TEXT,
    "vinculo_id" UUID,
    "wa_id" TEXT NOT NULL,
    "sentido" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT,
    "respuesta_id" TEXT,
    "media_id" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'recibido',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_mensajes_pkey" PRIMARY KEY ("id")
);

-- Uso del asistente por consulta
ALTER TABLE "whatsapp_mensajes" ADD COLUMN IF NOT EXISTS "establecimiento_id" UUID;
ALTER TABLE "whatsapp_mensajes" ADD COLUMN IF NOT EXISTS "modelo" TEXT;
ALTER TABLE "whatsapp_mensajes" ADD COLUMN IF NOT EXISTS "tokens_entrada" INTEGER;
ALTER TABLE "whatsapp_mensajes" ADD COLUMN IF NOT EXISTS "tokens_salida" INTEGER;
ALTER TABLE "whatsapp_mensajes" ADD COLUMN IF NOT EXISTS "tokens_cache_leidos" INTEGER;
ALTER TABLE "whatsapp_mensajes" ADD COLUMN IF NOT EXISTS "tokens_cache_escritos" INTEGER;
ALTER TABLE "whatsapp_mensajes" ADD COLUMN IF NOT EXISTS "costo_usd" DECIMAL(12,6);
ALTER TABLE "whatsapp_mensajes" ADD COLUMN IF NOT EXISTS "llamadas_ia" INTEGER;
ALTER TABLE "whatsapp_mensajes" ADD COLUMN IF NOT EXISTS "herramientas" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "whatsapp_mensajes" ADD COLUMN IF NOT EXISTS "duracion_ms" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_vinculos_usuario_id_key" ON "whatsapp_vinculos"("usuario_id");
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_vinculos_wa_id_key" ON "whatsapp_vinculos"("wa_id");
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_vinculos_codigo_hash_key" ON "whatsapp_vinculos"("codigo_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_mensajes_wamid_key" ON "whatsapp_mensajes"("wamid");
CREATE INDEX IF NOT EXISTS "whatsapp_mensajes_wa_id_created_at_idx" ON "whatsapp_mensajes"("wa_id", "created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_mensajes_vinculo_id_created_at_idx" ON "whatsapp_mensajes"("vinculo_id", "created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_mensajes_created_at_idx" ON "whatsapp_mensajes"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_vinculos_usuario_id_fkey') THEN
    ALTER TABLE "whatsapp_vinculos" ADD CONSTRAINT "whatsapp_vinculos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_vinculos_establecimiento_activo_id_fkey') THEN
    ALTER TABLE "whatsapp_vinculos" ADD CONSTRAINT "whatsapp_vinculos_establecimiento_activo_id_fkey" FOREIGN KEY ("establecimiento_activo_id") REFERENCES "establecimientos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_mensajes_vinculo_id_fkey') THEN
    ALTER TABLE "whatsapp_mensajes" ADD CONSTRAINT "whatsapp_mensajes_vinculo_id_fkey" FOREIGN KEY ("vinculo_id") REFERENCES "whatsapp_vinculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
