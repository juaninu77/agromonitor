-- Reproducción E3: protocolos IATF aplicados a hembras de una torada; cada paso es una tarea.
-- Solo agrega tablas y columnas.

-- AlterTable
ALTER TABLE "tareas" ADD COLUMN     "paso_iatf" INTEGER,
ADD COLUMN     "protocolo_iatf_id" UUID;
-- CreateTable
CREATE TABLE "protocolos_iatf" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "plantilla" TEXT NOT NULL,
    "fecha_d0" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "inseminador" TEXT,
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_id" UUID,
    "establecimiento_id" UUID NOT NULL,
    "torada_id" UUID NOT NULL,
    "operacion_servicio_id" UUID,
    CONSTRAINT "protocolos_iatf_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "protocolos_iatf_hembras" (
    "protocolo_id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    CONSTRAINT "protocolos_iatf_hembras_pkey" PRIMARY KEY ("protocolo_id","animal_id")
);
-- CreateIndex
CREATE UNIQUE INDEX "protocolos_iatf_operacion_servicio_id_key" ON "protocolos_iatf"("operacion_servicio_id");
-- CreateIndex
CREATE INDEX "protocolos_iatf_establecimiento_id_fecha_d0_idx" ON "protocolos_iatf"("establecimiento_id", "fecha_d0");
-- CreateIndex
CREATE INDEX "protocolos_iatf_torada_id_idx" ON "protocolos_iatf"("torada_id");
-- CreateIndex
CREATE INDEX "protocolos_iatf_hembras_animal_id_idx" ON "protocolos_iatf_hembras"("animal_id");
-- CreateIndex
CREATE INDEX "tareas_protocolo_iatf_id_idx" ON "tareas"("protocolo_iatf_id");
-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_protocolo_iatf_id_fkey" FOREIGN KEY ("protocolo_iatf_id") REFERENCES "protocolos_iatf"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "protocolos_iatf" ADD CONSTRAINT "protocolos_iatf_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "protocolos_iatf" ADD CONSTRAINT "protocolos_iatf_torada_id_fkey" FOREIGN KEY ("torada_id") REFERENCES "toradas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "protocolos_iatf_hembras" ADD CONSTRAINT "protocolos_iatf_hembras_protocolo_id_fkey" FOREIGN KEY ("protocolo_id") REFERENCES "protocolos_iatf"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "protocolos_iatf_hembras" ADD CONSTRAINT "protocolos_iatf_hembras_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Estados del protocolo
ALTER TABLE "protocolos_iatf" ADD CONSTRAINT "protocolos_iatf_estado_chk" CHECK (estado IN ('activo', 'cerrado', 'cancelado'));
