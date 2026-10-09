-- AlterTable
ALTER TABLE "movimientos_stock" ADD COLUMN     "concepto" TEXT;


-- Valores válidos y coherencia con el tipo (también en prisma/constraints.sql)
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_concepto_chk"
  CHECK (concepto IS NULL OR (concepto = 'transferencia' AND tipo IN ('entrada', 'salida')) OR (concepto = 'recuento' AND tipo = 'ajuste'));
