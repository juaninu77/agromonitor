-- CreateTable
CREATE TABLE "activos_patrimoniales" (
    "id" UUID NOT NULL,
    "establecimiento_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "referencia" TEXT,
    "fecha" DATE,
    "importe" DECIMAL(14,2),
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "notas" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activos_patrimoniales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes" (
    "id" UUID NOT NULL,
    "establecimiento_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "contraparte" TEXT NOT NULL,
    "cuit" TEXT,
    "fecha" DATE NOT NULL,
    "vencimiento" DATE,
    "importe" DECIMAL(14,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "sentido" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "notas" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tramites" (
    "id" UUID NOT NULL,
    "establecimiento_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "referencia" TEXT,
    "fecha" DATE NOT NULL,
    "vencimiento" DATE,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "notas" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tramites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_archivo" (
    "id" UUID NOT NULL,
    "establecimiento_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "referencia" TEXT,
    "fecha" DATE,
    "vencimiento" DATE,
    "notas" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "version" INTEGER NOT NULL DEFAULT 1,
    "nombre_archivo" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "activo_id" UUID,
    "comprobante_id" UUID,
    "tramite_id" UUID,
    "animal_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_archivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archivos_contenido" (
    "documento_id" UUID NOT NULL,
    "datos" BYTEA NOT NULL,

    CONSTRAINT "archivos_contenido_pkey" PRIMARY KEY ("documento_id")
);

-- CreateIndex
CREATE INDEX "activos_patrimoniales_establecimiento_id_created_at_idx" ON "activos_patrimoniales"("establecimiento_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "activos_patrimoniales_id_establecimiento_id_key" ON "activos_patrimoniales"("id", "establecimiento_id");

-- CreateIndex
CREATE INDEX "comprobantes_establecimiento_id_fecha_idx" ON "comprobantes"("establecimiento_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_id_establecimiento_id_key" ON "comprobantes"("id", "establecimiento_id");

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_establecimiento_id_tipo_referencia_contraparte_key" ON "comprobantes"("establecimiento_id", "tipo", "referencia", "contraparte", "sentido");

-- CreateIndex
CREATE INDEX "tramites_establecimiento_id_vencimiento_idx" ON "tramites"("establecimiento_id", "vencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "tramites_id_establecimiento_id_key" ON "tramites"("id", "establecimiento_id");

-- CreateIndex
CREATE INDEX "documentos_archivo_establecimiento_id_created_at_idx" ON "documentos_archivo"("establecimiento_id", "created_at");

-- CreateIndex
CREATE INDEX "documentos_archivo_activo_id_idx" ON "documentos_archivo"("activo_id");

-- CreateIndex
CREATE INDEX "documentos_archivo_comprobante_id_idx" ON "documentos_archivo"("comprobante_id");

-- CreateIndex
CREATE INDEX "documentos_archivo_tramite_id_idx" ON "documentos_archivo"("tramite_id");

-- CreateIndex
CREATE INDEX "documentos_archivo_animal_id_idx" ON "documentos_archivo"("animal_id");

-- AddForeignKey
ALTER TABLE "activos_patrimoniales" ADD CONSTRAINT "activos_patrimoniales_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramites" ADD CONSTRAINT "tramites_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_archivo" ADD CONSTRAINT "documentos_archivo_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_archivo" ADD CONSTRAINT "documentos_archivo_activo_id_establecimiento_id_fkey" FOREIGN KEY ("activo_id", "establecimiento_id") REFERENCES "activos_patrimoniales"("id", "establecimiento_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documentos_archivo" ADD CONSTRAINT "documentos_archivo_comprobante_id_establecimiento_id_fkey" FOREIGN KEY ("comprobante_id", "establecimiento_id") REFERENCES "comprobantes"("id", "establecimiento_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documentos_archivo" ADD CONSTRAINT "documentos_archivo_tramite_id_establecimiento_id_fkey" FOREIGN KEY ("tramite_id", "establecimiento_id") REFERENCES "tramites"("id", "establecimiento_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documentos_archivo" ADD CONSTRAINT "documentos_archivo_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archivos_contenido" ADD CONSTRAINT "archivos_contenido_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documentos_archivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Database constraints also protect data written outside the API.
ALTER TABLE activos_patrimoniales ADD CONSTRAINT activo_importe CHECK (importe IS NULL OR importe > 0), ADD CONSTRAINT activo_moneda CHECK (moneda IN ('ARS','USD')), ADD CONSTRAINT activo_estado CHECK (estado IN ('activo','vendido','baja'));
ALTER TABLE comprobantes ADD CONSTRAINT comprobante_importe CHECK (importe > 0), ADD CONSTRAINT comprobante_moneda CHECK (moneda IN ('ARS','USD')), ADD CONSTRAINT comprobante_sentido CHECK (sentido IN ('ingreso','egreso')), ADD CONSTRAINT comprobante_estado CHECK (estado IN ('pendiente','pagado','anulado')), ADD CONSTRAINT comprobante_fechas CHECK (vencimiento IS NULL OR vencimiento >= fecha);
ALTER TABLE tramites ADD CONSTRAINT tramite_estado CHECK (estado IN ('pendiente','presentado','aprobado','rechazado','cancelado')), ADD CONSTRAINT tramite_fechas CHECK (vencimiento IS NULL OR vencimiento >= fecha);
ALTER TABLE documentos_archivo ADD CONSTRAINT documento_estado CHECK (estado IN ('activo','archivado')), ADD CONSTRAINT documento_bytes CHECK (bytes BETWEEN 1 AND 2097152), ADD CONSTRAINT documento_mime CHECK (mime IN ('application/pdf','image/png','image/jpeg')), ADD CONSTRAINT documento_vinculo CHECK (num_nonnulls(activo_id, comprobante_id, tramite_id, animal_id) <= 1), ADD CONSTRAINT documento_fechas CHECK (fecha IS NULL OR vencimiento IS NULL OR vencimiento >= fecha);
ALTER TABLE archivos_contenido ADD CONSTRAINT archivo_tamano CHECK (octet_length(datos) BETWEEN 1 AND 2097152);
