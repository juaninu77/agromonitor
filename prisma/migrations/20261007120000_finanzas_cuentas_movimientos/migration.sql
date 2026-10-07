-- CreateTable
CREATE TABLE "cuentas_financieras" (
    "id" UUID NOT NULL,
    "establecimiento_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "banco" TEXT,
    "numero" TEXT,
    "saldo_inicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_financieras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_financieros" (
    "id" UUID NOT NULL,
    "establecimiento_id" UUID NOT NULL,
    "cuenta_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "subcategoria" TEXT,
    "fecha" DATE NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "contraparte" TEXT,
    "cuit" TEXT,
    "medio_pago" TEXT,
    "notas" TEXT,
    "comprobante_id" UUID,
    "baja_id" UUID,
    "transferencia_id" UUID,
    "creado_por_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movimientos_financieros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_financieras_id_establecimiento_id_key" ON "cuentas_financieras"("id", "establecimiento_id");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_financieras_establecimiento_id_nombre_key" ON "cuentas_financieras"("establecimiento_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_financieros_baja_id_key" ON "movimientos_financieros"("baja_id");

-- CreateIndex
CREATE INDEX "movimientos_financieros_establecimiento_id_fecha_idx" ON "movimientos_financieros"("establecimiento_id", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_financieros_cuenta_id_fecha_idx" ON "movimientos_financieros"("cuenta_id", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_financieros_transferencia_id_idx" ON "movimientos_financieros"("transferencia_id");

-- CreateIndex
CREATE INDEX "movimientos_financieros_comprobante_id_idx" ON "movimientos_financieros"("comprobante_id");

-- AddForeignKey
ALTER TABLE "cuentas_financieras" ADD CONSTRAINT "cuentas_financieras_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_cuenta_id_establecimiento_id_fkey" FOREIGN KEY ("cuenta_id", "establecimiento_id") REFERENCES "cuentas_financieras"("id", "establecimiento_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_comprobante_id_establecimiento_id_fkey" FOREIGN KEY ("comprobante_id", "establecimiento_id") REFERENCES "comprobantes"("id", "establecimiento_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_baja_id_fkey" FOREIGN KEY ("baja_id") REFERENCES "evt_baja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

