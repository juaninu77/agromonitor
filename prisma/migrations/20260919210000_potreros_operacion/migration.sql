CREATE UNIQUE INDEX "sectores_id_establecimiento_id_key" ON "sectores"("id", "establecimiento_id");
CREATE TABLE "sector_registros" (
  "id" UUID NOT NULL, "clave" UUID NOT NULL, "sector_id" UUID NOT NULL,
  "tipo" TEXT NOT NULL, "detalle" TEXT NOT NULL, "estado" TEXT NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resuelto_at" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sector_registros_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sector_registros_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectores"("id") ON DELETE RESTRICT,
  CONSTRAINT "sector_registros_tipo_chk" CHECK ("tipo" IN ('nota','tarea','revision_agua','descanso','labor')),
  CONSTRAINT "sector_registros_estado_chk" CHECK ("estado" IN ('registrado','pendiente','completada','disponible','sin_agua','requiere_revision','inicio','fin'))
);
CREATE UNIQUE INDEX "sector_registros_clave_key" ON "sector_registros"("clave");
CREATE INDEX "sector_registros_sector_id_fecha_idx" ON "sector_registros"("sector_id", "fecha");
ALTER TABLE "documentos_archivo" ADD COLUMN "sector_id" UUID,
  ADD CONSTRAINT "documentos_archivo_sector_id_establecimiento_id_fkey" FOREIGN KEY ("sector_id", "establecimiento_id") REFERENCES "sectores"("id", "establecimiento_id") ON DELETE RESTRICT;
ALTER TABLE "movimientos_stock" ADD COLUMN "sector_id" UUID, ADD COLUMN "clave" UUID,
  ADD CONSTRAINT "movimientos_stock_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectores"("id") ON DELETE RESTRICT;
CREATE UNIQUE INDEX "movimientos_stock_clave_key" ON "movimientos_stock"("clave");
CREATE INDEX "movimientos_stock_sector_id_idx" ON "movimientos_stock"("sector_id");
ALTER TABLE "reservas_forraje" ADD COLUMN "deposito_id" UUID,
  ADD CONSTRAINT "reservas_forraje_deposito_id_fkey" FOREIGN KEY ("deposito_id") REFERENCES "sectores"("id") ON DELETE RESTRICT;
ALTER TABLE "sectores" DROP CONSTRAINT IF EXISTS "sectores_tipo_chk",
  ADD CONSTRAINT "sectores_tipo_chk" CHECK (tipo IN ('potrero','corral','manga','feedlot','embarcadero','enfermeria','otro','cultivo','galpon','aguada','casa','camino','tranquera','limite')) NOT VALID;
