-- AlterTable
ALTER TABLE "tareas" ADD COLUMN     "sector_id" UUID;

-- CreateIndex
CREATE INDEX "tareas_sector_id_idx" ON "tareas"("sector_id");

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_sector_id_establecimiento_id_fkey" FOREIGN KEY ("sector_id", "establecimiento_id") REFERENCES "sectores"("id", "establecimiento_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

