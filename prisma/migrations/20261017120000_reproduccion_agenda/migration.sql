-- Reproducción Fase D: tareas de la agenda reproductiva con clave estable (solo agrega).

-- AlterTable
ALTER TABLE "tareas" ADD COLUMN     "clave_reproduccion" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tareas_clave_reproduccion_key" ON "tareas"("clave_reproduccion");

