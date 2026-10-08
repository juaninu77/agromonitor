-- AlterTable
ALTER TABLE "lotes_producto" ALTER COLUMN "cantidad" SET DATA TYPE DECIMAL(14,3);

-- AlterTable
ALTER TABLE "movimientos_stock" ADD COLUMN     "operacion_id" UUID,
ALTER COLUMN "cantidad" SET DATA TYPE DECIMAL(14,3);

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "costo_referencia" DECIMAL(12,2),
ADD COLUMN     "moneda_costo" TEXT NOT NULL DEFAULT 'ARS',
ADD COLUMN     "stock_minimo" DECIMAL(14,3),
ADD COLUMN     "unidad" TEXT NOT NULL DEFAULT 'unidades';

-- CreateIndex
CREATE INDEX "movimientos_stock_operacion_id_idx" ON "movimientos_stock"("operacion_id");


-- Cantidades válidas (también en prisma/constraints.sql)
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_cantidad_chk"
  CHECK (cantidad <> 0 AND (tipo = 'ajuste' OR cantidad > 0));
ALTER TABLE "lotes_producto" ADD CONSTRAINT "lotes_producto_cantidad_chk" CHECK (cantidad IS NULL OR cantidad >= 0);
ALTER TABLE "productos" ADD CONSTRAINT "productos_stock_minimo_chk" CHECK (stock_minimo IS NULL OR stock_minimo >= 0);
ALTER TABLE "productos" ADD CONSTRAINT "productos_costo_referencia_chk" CHECK (costo_referencia IS NULL OR costo_referencia >= 0);
ALTER TABLE "productos" ADD CONSTRAINT "productos_moneda_costo_chk" CHECK (moneda_costo IN ('ARS', 'USD'));
