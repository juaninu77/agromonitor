-- Manga: el tratamiento de la sesión (producto y dosis ya existían) suma unidad, vía, motivo y
-- carencia, que se registran en Sanidad al finalizar. Solo agrega columnas.
ALTER TABLE "sesiones_manga" ADD COLUMN     "carencia_sanidad" INTEGER,
ADD COLUMN     "motivo_sanidad" TEXT,
ADD COLUMN     "unidad_sanidad" TEXT,
ADD COLUMN     "via_sanidad" TEXT;
