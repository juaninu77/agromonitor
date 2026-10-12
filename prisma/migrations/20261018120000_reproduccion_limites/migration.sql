-- Reproducción: el destete guarda su pesada (anularlo puede quitarla) y la vacuna de la
-- señalada descuenta stock (origen 'senalada'). Solo agrega; no modifica filas.

-- AlterTable
ALTER TABLE "evt_destete" ADD COLUMN     "pesada_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "evt_destete_pesada_id_key" ON "evt_destete"("pesada_id");

-- AddForeignKey
ALTER TABLE "evt_destete" ADD CONSTRAINT "evt_destete_pesada_id_fkey" FOREIGN KEY ("pesada_id") REFERENCES "evt_pesada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Amplía el dominio del CHECK de origen del stock
ALTER TABLE "movimientos_stock" DROP CONSTRAINT IF EXISTS "movimientos_stock_origen_chk",
  ADD CONSTRAINT "movimientos_stock_origen_chk" CHECK (origen_tipo IS NULL OR origen_tipo IN ('sanidad', 'manga', 'compra', 'senalada')) NOT VALID;
