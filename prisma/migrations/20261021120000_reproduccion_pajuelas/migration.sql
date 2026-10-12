-- Reproducción E2: el servicio de IA/IATF guarda la pajuela usada (producto tipo semen y su
-- partida) y se descuenta del stock con origen 'servicio'. Solo agrega.

-- AlterTable
ALTER TABLE "evt_servicio" ADD COLUMN     "lote_producto_id" UUID,
ADD COLUMN     "producto_semen_id" UUID;

-- CreateIndex
CREATE INDEX "evt_servicio_producto_semen_id_idx" ON "evt_servicio"("producto_semen_id");

-- AddForeignKey
ALTER TABLE "evt_servicio" ADD CONSTRAINT "evt_servicio_producto_semen_id_fkey" FOREIGN KEY ("producto_semen_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evt_servicio" ADD CONSTRAINT "evt_servicio_lote_producto_id_fkey" FOREIGN KEY ("lote_producto_id") REFERENCES "lotes_producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Amplía el dominio del CHECK de origen del stock
ALTER TABLE "movimientos_stock" DROP CONSTRAINT IF EXISTS "movimientos_stock_origen_chk",
  ADD CONSTRAINT "movimientos_stock_origen_chk" CHECK (origen_tipo IS NULL OR origen_tipo IN ('sanidad', 'manga', 'compra', 'senalada', 'servicio')) NOT VALID;
