-- Detección de celo (spec 03, Fase E5): un evento por hembra, turno mañana/tarde y método.

-- CreateTable
CREATE TABLE "evt_celo" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "momento" TEXT NOT NULL,
    "metodo" TEXT NOT NULL DEFAULT 'observado',
    "observ" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operacion_id" UUID,
    "anulado_at" TIMESTAMP(3),
    "anulado_por_id" UUID,
    "motivo_anulacion" TEXT,
    "hembra_id" UUID NOT NULL,
    "establecimiento_id" UUID NOT NULL,

    CONSTRAINT "evt_celo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evt_celo_establecimiento_id_fecha_idx" ON "evt_celo"("establecimiento_id", "fecha");

-- CreateIndex
CREATE INDEX "evt_celo_hembra_id_fecha_idx" ON "evt_celo"("hembra_id", "fecha");

-- CreateIndex
CREATE INDEX "evt_celo_operacion_id_idx" ON "evt_celo"("operacion_id");

-- AddForeignKey
ALTER TABLE "evt_celo" ADD CONSTRAINT "evt_celo_hembra_id_fkey" FOREIGN KEY ("hembra_id") REFERENCES "animales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_celo" ADD CONSTRAINT "evt_celo_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Valores válidos y anulación con motivo
ALTER TABLE "evt_celo" ADD CONSTRAINT "evt_celo_momento_chk" CHECK (momento IN ('manana', 'tarde'));
ALTER TABLE "evt_celo" ADD CONSTRAINT "evt_celo_metodo_chk" CHECK (metodo IN ('observado', 'pintura', 'parche', 'collar'));
ALTER TABLE "evt_celo" ADD CONSTRAINT "evt_celo_anulacion_chk" CHECK (anulado_at IS NULL OR motivo_anulacion IS NOT NULL);

-- Un celo vigente por hembra, día y turno
CREATE UNIQUE INDEX "evt_celo_hembra_turno_vigente_key" ON "evt_celo" ("hembra_id", "fecha", "momento") WHERE anulado_at IS NULL;
