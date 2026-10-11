-- Reproducción Fase C: cargas por grupo (operacionId), torada/encarnerada y señalada de corderos.
-- Solo agrega.

-- AlterTable
ALTER TABLE "evt_destete" ADD COLUMN     "operacion_id" UUID;

-- AlterTable
ALTER TABLE "evt_servicio" ADD COLUMN     "operacion_id" UUID;

-- AlterTable
ALTER TABLE "evt_tacto" ADD COLUMN     "operacion_id" UUID;

-- AlterTable
ALTER TABLE "toradas" ADD COLUMN     "tipo_grupo" TEXT NOT NULL DEFAULT 'torada';

-- CreateTable
CREATE TABLE "evt_senalada" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "corderos_senalados" INTEGER NOT NULL,
    "corderos_muertos" INTEGER NOT NULL DEFAULT 0,
    "machos_mantenidos" INTEGER NOT NULL DEFAULT 0,
    "machos_castrados" INTEGER NOT NULL DEFAULT 0,
    "hembras" INTEGER NOT NULL DEFAULT 0,
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clave" UUID,
    "lote_id" UUID NOT NULL,
    "torada_id" UUID,
    "producto_clostridial_id" UUID,
    "anulado_at" TIMESTAMP(3),
    "anulado_por_id" UUID,
    "motivo_anulacion" TEXT,

    CONSTRAINT "evt_senalada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evt_senalada_clave_key" ON "evt_senalada"("clave");

-- CreateIndex
CREATE INDEX "evt_senalada_lote_id_idx" ON "evt_senalada"("lote_id");

-- CreateIndex
CREATE INDEX "evt_senalada_torada_id_idx" ON "evt_senalada"("torada_id");

-- CreateIndex
CREATE INDEX "evt_senalada_fecha_idx" ON "evt_senalada"("fecha");

-- CreateIndex
CREATE INDEX "evt_destete_operacion_id_idx" ON "evt_destete"("operacion_id");

-- CreateIndex
CREATE INDEX "evt_servicio_operacion_id_idx" ON "evt_servicio"("operacion_id");

-- CreateIndex
CREATE INDEX "evt_tacto_operacion_id_idx" ON "evt_tacto"("operacion_id");

-- AddForeignKey
ALTER TABLE "evt_senalada" ADD CONSTRAINT "evt_senalada_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_senalada" ADD CONSTRAINT "evt_senalada_torada_id_fkey" FOREIGN KEY ("torada_id") REFERENCES "toradas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_senalada" ADD CONSTRAINT "evt_senalada_producto_clostridial_id_fkey" FOREIGN KEY ("producto_clostridial_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Torada (bovinos) o encarnerada (ovinos)
ALTER TABLE "toradas" ADD CONSTRAINT "toradas_tipo_grupo_chk" CHECK ("tipo_grupo" IN ('torada', 'encarnerada'));

-- Señalada: cantidades no negativas, el desglose suma el total (o no se carga) y la anulación lleva motivo
ALTER TABLE "evt_senalada" ADD CONSTRAINT "evt_senalada_cantidades_chk" CHECK (
  "corderos_senalados" >= 0 AND "corderos_muertos" >= 0 AND "machos_mantenidos" >= 0 AND "machos_castrados" >= 0 AND "hembras" >= 0
  AND ("machos_mantenidos" + "machos_castrados" + "hembras" = 0 OR "machos_mantenidos" + "machos_castrados" + "hembras" = "corderos_senalados")
);
ALTER TABLE "evt_senalada" ADD CONSTRAINT "evt_senalada_anulacion_chk" CHECK ("anulado_at" IS NULL OR "motivo_anulacion" IS NOT NULL);
