-- Índice para "última pesada por animal" (listado, estadísticas y filtros por peso).
CREATE INDEX IF NOT EXISTS "evt_pesada_animal_id_fecha_idx" ON "evt_pesada"("animal_id", "fecha");

-- Alinea con schema.prisma las FKs creadas a mano en 20260919210000_potreros_operacion
-- (les faltaba ON UPDATE CASCADE, que es el default de Prisma). Sólo cambia la
-- definición de la restricción; no toca datos.
ALTER TABLE "movimientos_stock" DROP CONSTRAINT IF EXISTS "movimientos_stock_sector_id_fkey";
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_sector_id_fkey"
  FOREIGN KEY ("sector_id") REFERENCES "sectores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservas_forraje" DROP CONSTRAINT IF EXISTS "reservas_forraje_deposito_id_fkey";
ALTER TABLE "reservas_forraje" ADD CONSTRAINT "reservas_forraje_deposito_id_fkey"
  FOREIGN KEY ("deposito_id") REFERENCES "sectores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sector_registros" DROP CONSTRAINT IF EXISTS "sector_registros_sector_id_fkey";
ALTER TABLE "sector_registros" ADD CONSTRAINT "sector_registros_sector_id_fkey"
  FOREIGN KEY ("sector_id") REFERENCES "sectores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
