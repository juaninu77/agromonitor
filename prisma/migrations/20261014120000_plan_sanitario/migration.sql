-- Plan sanitario (spec 02): protocolos, ítems, calendarios, zona de aftosa por campo y vínculos con tareas y eventos
-- AlterTable
ALTER TABLE "establecimientos" ADD COLUMN     "zona_aftosa" TEXT;

-- AlterTable
ALTER TABLE "evt_sanidad" ADD COLUMN     "item_protocolo_id" UUID,
ADD COLUMN     "tarea_id" UUID;

-- AlterTable
ALTER TABLE "tareas" ADD COLUMN     "calendario_sanitario_id" UUID,
ADD COLUMN     "item_protocolo_id" UUID;

-- CreateTable
CREATE TABLE "protocolos_sanitarios" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "especie" TEXT NOT NULL,
    "zona_aplicable" TEXT,
    "plantilla" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_por_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organizacion_id" UUID NOT NULL,

    CONSTRAINT "protocolos_sanitarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_protocolo" (
    "id" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "momento" TEXT NOT NULL,
    "mes" INTEGER,
    "dia" INTEGER,
    "dias_offset" INTEGER NOT NULL DEFAULT 0,
    "repetir_cada_dias" INTEGER,
    "destinatarios" TEXT,
    "producto_tipo" TEXT,
    "producto_id" UUID,
    "dosis" DOUBLE PRECISION,
    "unidad" TEXT,
    "via" TEXT,
    "es_aftosa" BOOLEAN NOT NULL DEFAULT false,
    "obligatorio" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "protocolo_id" UUID NOT NULL,

    CONSTRAINT "items_protocolo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendarios_sanitarios" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_inicio" DATE NOT NULL,
    "fecha_campania_otono" DATE,
    "fecha_campania_primavera" DATE,
    "fecha_pre_servicio" DATE,
    "fecha_destete" DATE,
    "fecha_pre_esquila" DATE,
    "creado_por_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolo_id" UUID NOT NULL,
    "establecimiento_id" UUID NOT NULL,
    "lote_id" UUID,

    CONSTRAINT "calendarios_sanitarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "protocolos_sanitarios_organizacion_id_nombre_key" ON "protocolos_sanitarios"("organizacion_id", "nombre");

-- CreateIndex
CREATE INDEX "items_protocolo_protocolo_id_idx" ON "items_protocolo"("protocolo_id");

-- CreateIndex
CREATE INDEX "calendarios_sanitarios_establecimiento_id_anio_idx" ON "calendarios_sanitarios"("establecimiento_id", "anio");

-- CreateIndex
CREATE INDEX "calendarios_sanitarios_protocolo_id_idx" ON "calendarios_sanitarios"("protocolo_id");

-- CreateIndex
CREATE INDEX "evt_sanidad_tarea_id_idx" ON "evt_sanidad"("tarea_id");

-- CreateIndex
CREATE INDEX "tareas_calendario_sanitario_id_idx" ON "tareas"("calendario_sanitario_id");

-- AddForeignKey
ALTER TABLE "evt_sanidad" ADD CONSTRAINT "evt_sanidad_item_protocolo_id_fkey" FOREIGN KEY ("item_protocolo_id") REFERENCES "items_protocolo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evt_sanidad" ADD CONSTRAINT "evt_sanidad_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_calendario_sanitario_id_fkey" FOREIGN KEY ("calendario_sanitario_id") REFERENCES "calendarios_sanitarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_item_protocolo_id_fkey" FOREIGN KEY ("item_protocolo_id") REFERENCES "items_protocolo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocolos_sanitarios" ADD CONSTRAINT "protocolos_sanitarios_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_protocolo" ADD CONSTRAINT "items_protocolo_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_protocolo" ADD CONSTRAINT "items_protocolo_protocolo_id_fkey" FOREIGN KEY ("protocolo_id") REFERENCES "protocolos_sanitarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendarios_sanitarios" ADD CONSTRAINT "calendarios_sanitarios_protocolo_id_fkey" FOREIGN KEY ("protocolo_id") REFERENCES "protocolos_sanitarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendarios_sanitarios" ADD CONSTRAINT "calendarios_sanitarios_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendarios_sanitarios" ADD CONSTRAINT "calendarios_sanitarios_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Valores válidos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'establecimientos_zona_aftosa_chk') THEN
    ALTER TABLE "establecimientos" ADD CONSTRAINT establecimientos_zona_aftosa_chk
      CHECK (zona_aftosa IS NULL OR zona_aftosa IN ('libre_sin_vacunacion', 'libre_con_vacunacion', 'con_vacunacion'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_protocolo_momento_chk') THEN
    ALTER TABLE "items_protocolo" ADD CONSTRAINT items_protocolo_momento_chk
      CHECK (momento IN ('fecha', 'inicio', 'campania_otono', 'campania_primavera', 'pre_servicio', 'destete', 'pre_esquila')
        AND (momento <> 'fecha' OR (mes BETWEEN 1 AND 12 AND dia BETWEEN 1 AND 31))
        AND (repetir_cada_dias IS NULL OR repetir_cada_dias >= 1));
  END IF;
END $$;
