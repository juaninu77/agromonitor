-- AlterTable
ALTER TABLE "movimientos_stock" ADD COLUMN     "origen_id" UUID,
ADD COLUMN     "origen_tipo" TEXT;

-- CreateIndex
CREATE INDEX "movimientos_stock_origen_tipo_origen_id_idx" ON "movimientos_stock"("origen_tipo", "origen_id");


-- Origen válido (también en prisma/constraints.sql)
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_origen_chk"
  CHECK (origen_tipo IS NULL OR origen_tipo IN ('sanidad', 'manga', 'compra'));
