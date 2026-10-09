-- Moneda del costo de cada lote (el costo es por unidad del producto)
ALTER TABLE "lotes_producto" ADD COLUMN     "moneda" TEXT NOT NULL DEFAULT 'ARS';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lotes_producto_moneda_chk') THEN
    ALTER TABLE "lotes_producto" ADD CONSTRAINT lotes_producto_moneda_chk CHECK (moneda IN ('ARS', 'USD'));
  END IF;
END $$;
