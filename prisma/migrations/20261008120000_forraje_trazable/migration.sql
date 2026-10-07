-- AlterTable
ALTER TABLE "movimientos_forraje" ADD COLUMN     "concepto" TEXT,
ADD COLUMN     "cultivo_id" UUID,
ADD COLUMN     "lote_id" UUID,
ADD COLUMN     "sector_id" UUID,
ADD COLUMN     "transferencia_id" UUID;

-- CreateIndex
CREATE INDEX "movimientos_forraje_cultivo_id_idx" ON "movimientos_forraje"("cultivo_id");

-- CreateIndex
CREATE INDEX "movimientos_forraje_sector_id_fecha_idx" ON "movimientos_forraje"("sector_id", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_forraje_lote_id_idx" ON "movimientos_forraje"("lote_id");

-- CreateIndex
CREATE INDEX "movimientos_forraje_transferencia_id_idx" ON "movimientos_forraje"("transferencia_id");

-- AddForeignKey
ALTER TABLE "movimientos_forraje" ADD CONSTRAINT "movimientos_forraje_cultivo_id_fkey" FOREIGN KEY ("cultivo_id") REFERENCES "sector_forrajes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_forraje" ADD CONSTRAINT "movimientos_forraje_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_forraje" ADD CONSTRAINT "movimientos_forraje_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Valores válidos del concepto y coherencia con el tipo (también en prisma/constraints.sql)
ALTER TABLE "movimientos_forraje" ADD CONSTRAINT "movimientos_forraje_concepto_chk"
  CHECK (concepto IS NULL OR (tipo = 'entrada' AND concepto IN ('cosecha', 'compra', 'ajuste', 'transferencia'))
                          OR (tipo = 'salida' AND concepto IN ('consumo', 'venta', 'ajuste', 'transferencia')));
ALTER TABLE "movimientos_forraje" ADD CONSTRAINT "movimientos_forraje_cultivo_chk"
  CHECK (cultivo_id IS NULL OR concepto = 'cosecha');
