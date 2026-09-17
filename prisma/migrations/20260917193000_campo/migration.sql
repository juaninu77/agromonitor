-- AlterTable
ALTER TABLE "sector_forrajes" ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'implantado',
ADD COLUMN     "superficie_ha" DOUBLE PRECISION,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "equipos_flota" (
    "activo_id" UUID NOT NULL,
    "patente" TEXT,
    "marca_modelo" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "lectura" DECIMAL(12,1) NOT NULL DEFAULT 0,
    "proximo_servicio_fecha" DATE,
    "proximo_servicio_lectura" DECIMAL(12,1),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "equipos_flota_pkey" PRIMARY KEY ("activo_id")
);

-- CreateTable
CREATE TABLE "mantenimientos_flota" (
    "id" UUID NOT NULL,
    "equipo_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "lectura" DECIMAL(12,1) NOT NULL,
    "detalle" TEXT NOT NULL,
    "costo" DECIMAL(14,2),
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mantenimientos_flota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_forraje" (
    "id" UUID NOT NULL,
    "establecimiento_id" UUID NOT NULL,
    "forraje_id" UUID NOT NULL,
    "cultivo_id" UUID,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "stock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minimo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservas_forraje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_forraje" (
    "id" UUID NOT NULL,
    "reserva_id" UUID NOT NULL,
    "clave" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "fecha" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_forraje_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mantenimientos_flota_equipo_id_fecha_idx" ON "mantenimientos_flota"("equipo_id", "fecha");

-- CreateIndex
CREATE INDEX "reservas_forraje_establecimiento_id_created_at_idx" ON "reservas_forraje"("establecimiento_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_forraje_clave_key" ON "movimientos_forraje"("clave");

-- CreateIndex
CREATE INDEX "movimientos_forraje_reserva_id_fecha_idx" ON "movimientos_forraje"("reserva_id", "fecha");

-- AddForeignKey
ALTER TABLE "equipos_flota" ADD CONSTRAINT "equipos_flota_activo_id_fkey" FOREIGN KEY ("activo_id") REFERENCES "activos_patrimoniales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos_flota" ADD CONSTRAINT "mantenimientos_flota_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos_flota"("activo_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_forraje" ADD CONSTRAINT "reservas_forraje_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_forraje" ADD CONSTRAINT "reservas_forraje_forraje_id_fkey" FOREIGN KEY ("forraje_id") REFERENCES "forrajes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_forraje" ADD CONSTRAINT "reservas_forraje_cultivo_id_fkey" FOREIGN KEY ("cultivo_id") REFERENCES "sector_forrajes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_forraje" ADD CONSTRAINT "movimientos_forraje_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas_forraje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE equipos_flota ADD CONSTRAINT flota_unidad CHECK (unidad IN ('km','horas')), ADD CONSTRAINT flota_lectura CHECK (lectura>=0), ADD CONSTRAINT flota_proxima_lectura CHECK (proximo_servicio_lectura IS NULL OR proximo_servicio_lectura>=0);
ALTER TABLE mantenimientos_flota ADD CONSTRAINT mantenimiento_lectura CHECK (lectura>=0), ADD CONSTRAINT mantenimiento_costo CHECK (costo IS NULL OR costo>=0), ADD CONSTRAINT mantenimiento_moneda CHECK (moneda IN ('ARS','USD'));
ALTER TABLE reservas_forraje ADD CONSTRAINT reserva_stock CHECK (stock>=0), ADD CONSTRAINT reserva_minimo CHECK (minimo>=0), ADD CONSTRAINT reserva_unidad CHECK (unidad IN ('fardos','rollos','kg'));
ALTER TABLE movimientos_forraje ADD CONSTRAINT movimiento_forraje_cantidad CHECK (cantidad>0), ADD CONSTRAINT movimiento_forraje_tipo CHECK (tipo IN ('entrada','salida'));
ALTER TABLE sector_forrajes ADD CONSTRAINT cultivo_superficie CHECK (superficie_ha IS NULL OR superficie_ha>0), ADD CONSTRAINT cultivo_estado CHECK (estado IN ('implantado','finalizado'));
UPDATE sector_forrajes SET estado='finalizado' WHERE hasta IS NOT NULL;
