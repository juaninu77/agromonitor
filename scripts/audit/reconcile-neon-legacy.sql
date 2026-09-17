-- DropIndex
DROP INDEX "especies_nombre_key";

-- DropIndex
DROP INDEX "usuarios_email_idx";

-- AlterTable
ALTER TABLE "animal_lote_hist" ALTER COLUMN "desde" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "desde" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "hasta" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "animales" ADD COLUMN     "establecimiento_id" UUID;

-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN     "organizacion_id" UUID;

-- AlterTable
ALTER TABLE "categorias" ADD COLUMN     "organizacion_id" UUID;

-- AlterTable
ALTER TABLE "dietas" ADD COLUMN     "organizacion_id" UUID;

-- AlterTable
ALTER TABLE "documentos_transito" ADD COLUMN     "establecimiento_id" UUID;

-- AlterTable
ALTER TABLE "especies" ADD COLUMN     "organizacion_id" UUID;

-- AlterTable
ALTER TABLE "evt_baja" ALTER COLUMN "precio_kg" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "precio_total" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "evt_sanidad" ALTER COLUMN "costo" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "lotes_producto" ADD COLUMN     "proveedor_id" UUID,
ALTER COLUMN "costo" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "organizacion_id" UUID;

-- AlterTable
ALTER TABLE "razas" ADD COLUMN     "organizacion_id" UUID;

-- CreateIndex
CREATE INDEX "animal_lote_hist_animal_id_hasta_idx" ON "animal_lote_hist"("animal_id", "hasta");

-- CreateIndex
CREATE INDEX "animales_establecimiento_id_idx" ON "animales"("establecimiento_id");

-- CreateIndex
CREATE INDEX "animales_raza_id_idx" ON "animales"("raza_id");

-- CreateIndex
CREATE INDEX "animales_categoria_id_idx" ON "animales"("categoria_id");

-- CreateIndex
CREATE INDEX "animales_proveedor_id_idx" ON "animales"("proveedor_id");

-- CreateIndex
CREATE INDEX "audit_log_organizacion_id_idx" ON "audit_log"("organizacion_id");

-- CreateIndex
CREATE INDEX "categorias_organizacion_id_idx" ON "categorias"("organizacion_id");

-- CreateIndex
CREATE INDEX "dietas_organizacion_id_idx" ON "dietas"("organizacion_id");

-- CreateIndex
CREATE INDEX "documentos_transito_establecimiento_id_idx" ON "documentos_transito"("establecimiento_id");

-- CreateIndex
CREATE INDEX "especies_organizacion_id_idx" ON "especies"("organizacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "especies_organizacion_id_nombre_key" ON "especies"("organizacion_id", "nombre");

-- CreateIndex
CREATE INDEX "evt_alimentacion_dieta_id_idx" ON "evt_alimentacion"("dieta_id");

-- CreateIndex
CREATE INDEX "evt_baja_cliente_id_idx" ON "evt_baja"("cliente_id");

-- CreateIndex
CREATE INDEX "evt_destete_lote_destete_id_idx" ON "evt_destete"("lote_destete_id");

-- CreateIndex
CREATE INDEX "evt_sanidad_lote_producto_id_idx" ON "evt_sanidad"("lote_producto_id");

-- CreateIndex
CREATE INDEX "evt_servicio_torada_id_idx" ON "evt_servicio"("torada_id");

-- CreateIndex
CREATE INDEX "lotes_producto_proveedor_id_idx" ON "lotes_producto"("proveedor_id");

-- CreateIndex
CREATE INDEX "planes_alimentacion_dieta_id_idx" ON "planes_alimentacion"("dieta_id");

-- CreateIndex
CREATE INDEX "productos_organizacion_id_idx" ON "productos"("organizacion_id");

-- CreateIndex
CREATE INDEX "razas_organizacion_id_idx" ON "razas"("organizacion_id");

-- CreateIndex
CREATE INDEX "sector_forrajes_forraje_id_idx" ON "sector_forrajes"("forraje_id");

-- CreateIndex
CREATE INDEX "ubicacion_hist_animal_id_hasta_idx" ON "ubicacion_hist"("animal_id", "hasta");

-- AddForeignKey
ALTER TABLE "especies" ADD CONSTRAINT "especies_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "razas" ADD CONSTRAINT "razas_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_producto" ADD CONSTRAINT "lotes_producto_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animales" ADD CONSTRAINT "animales_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dietas" ADD CONSTRAINT "dietas_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_transito" ADD CONSTRAINT "documentos_transito_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_manga" ADD CONSTRAINT "sesiones_manga_producto_sanidad_id_fkey" FOREIGN KEY ("producto_sanidad_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion_manga_items" ADD CONSTRAINT "sesion_manga_items_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
