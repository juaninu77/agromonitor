-- Reproducción Fase B: anulación de eventos, mellizos agrupados por parto y toros de la torada.
-- Solo agrega; el único de destete pasa a parcial (un destete vigente por animal).


-- AlterTable
ALTER TABLE "evt_destete" ADD COLUMN     "anulado_at" TIMESTAMP(3),
ADD COLUMN     "anulado_por_id" UUID,
ADD COLUMN     "motivo_anulacion" TEXT;

-- Un destete vigente por animal: el índice parcial se crea antes de quitar el único total
CREATE UNIQUE INDEX "evt_destete_animal_vigente_key" ON "evt_destete"("animal_id") WHERE "anulado_at" IS NULL;
DROP INDEX "evt_destete_animal_id_key";

-- AlterTable
ALTER TABLE "evt_paricion" ADD COLUMN     "anulado_at" TIMESTAMP(3),
ADD COLUMN     "anulado_por_id" UUID,
ADD COLUMN     "motivo_anulacion" TEXT,
ADD COLUMN     "parto_id" UUID;

-- AlterTable
ALTER TABLE "evt_servicio" ADD COLUMN     "anulado_at" TIMESTAMP(3),
ADD COLUMN     "anulado_por_id" UUID,
ADD COLUMN     "motivo_anulacion" TEXT;

-- AlterTable
ALTER TABLE "evt_tacto" ADD COLUMN     "anulado_at" TIMESTAMP(3),
ADD COLUMN     "anulado_por_id" UUID,
ADD COLUMN     "motivo_anulacion" TEXT;

-- CreateTable
CREATE TABLE "toradas_machos" (
    "torada_id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "toradas_machos_pkey" PRIMARY KEY ("torada_id","animal_id")
);

-- CreateIndex
CREATE INDEX "toradas_machos_animal_id_idx" ON "toradas_machos"("animal_id");

-- CreateIndex
CREATE INDEX "evt_destete_animal_id_idx" ON "evt_destete"("animal_id");

-- CreateIndex
CREATE INDEX "evt_paricion_parto_id_idx" ON "evt_paricion"("parto_id");

-- AddForeignKey
ALTER TABLE "toradas_machos" ADD CONSTRAINT "toradas_machos_torada_id_fkey" FOREIGN KEY ("torada_id") REFERENCES "toradas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toradas_machos" ADD CONSTRAINT "toradas_machos_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Una anulación siempre lleva motivo
ALTER TABLE "evt_servicio" ADD CONSTRAINT "evt_servicio_anulacion_chk" CHECK ("anulado_at" IS NULL OR "motivo_anulacion" IS NOT NULL);
ALTER TABLE "evt_tacto" ADD CONSTRAINT "evt_tacto_anulacion_chk" CHECK ("anulado_at" IS NULL OR "motivo_anulacion" IS NOT NULL);
ALTER TABLE "evt_paricion" ADD CONSTRAINT "evt_paricion_anulacion_chk" CHECK ("anulado_at" IS NULL OR "motivo_anulacion" IS NOT NULL);
ALTER TABLE "evt_destete" ADD CONSTRAINT "evt_destete_anulacion_chk" CHECK ("anulado_at" IS NULL OR "motivo_anulacion" IS NOT NULL);

-- Resultado del parto (los datos existentes se validan aparte: NOT VALID)
ALTER TABLE "evt_paricion" ADD CONSTRAINT "evt_paricion_resultado_chk" CHECK ("resultado" IN ('vivo', 'muerto', 'aborto')) NOT VALID;
