-- Reproducción: cada evento guarda el campo donde ocurrió (el del animal al registrarlo), para
-- que el historial y los conteos del campo no cambien si el animal se mueve a otro campo.
-- Se agrega la columna, se completa con el campo del animal (solo filas sin campo) y recién
-- entonces se exige.

ALTER TABLE "evt_servicio" ADD COLUMN "establecimiento_id" UUID;
ALTER TABLE "evt_tacto" ADD COLUMN "establecimiento_id" UUID;
ALTER TABLE "evt_paricion" ADD COLUMN "establecimiento_id" UUID;
ALTER TABLE "evt_destete" ADD COLUMN "establecimiento_id" UUID;

UPDATE "evt_servicio" e SET "establecimiento_id" = a."establecimiento_id" FROM "animales" a WHERE a."id" = e."hembra_id" AND e."establecimiento_id" IS NULL;
UPDATE "evt_tacto" e SET "establecimiento_id" = a."establecimiento_id" FROM "animales" a WHERE a."id" = e."hembra_id" AND e."establecimiento_id" IS NULL;
UPDATE "evt_paricion" e SET "establecimiento_id" = a."establecimiento_id" FROM "animales" a WHERE a."id" = e."madre_id" AND e."establecimiento_id" IS NULL;
UPDATE "evt_destete" e SET "establecimiento_id" = a."establecimiento_id" FROM "animales" a WHERE a."id" = e."animal_id" AND e."establecimiento_id" IS NULL;

ALTER TABLE "evt_servicio" ALTER COLUMN "establecimiento_id" SET NOT NULL;
ALTER TABLE "evt_tacto" ALTER COLUMN "establecimiento_id" SET NOT NULL;
ALTER TABLE "evt_paricion" ALTER COLUMN "establecimiento_id" SET NOT NULL;
ALTER TABLE "evt_destete" ALTER COLUMN "establecimiento_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "evt_destete_establecimiento_id_fecha_idx" ON "evt_destete"("establecimiento_id", "fecha");
CREATE INDEX "evt_paricion_establecimiento_id_fecha_idx" ON "evt_paricion"("establecimiento_id", "fecha");
CREATE INDEX "evt_servicio_establecimiento_id_fecha_idx" ON "evt_servicio"("establecimiento_id", "fecha");
CREATE INDEX "evt_tacto_establecimiento_id_fecha_idx" ON "evt_tacto"("establecimiento_id", "fecha");

-- AddForeignKey
ALTER TABLE "evt_paricion" ADD CONSTRAINT "evt_paricion_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evt_destete" ADD CONSTRAINT "evt_destete_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evt_servicio" ADD CONSTRAINT "evt_servicio_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evt_tacto" ADD CONSTRAINT "evt_tacto_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
