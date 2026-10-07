-- CreateTable
CREATE TABLE "operaciones_idempotentes" (
    "clave" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "ruta" TEXT NOT NULL,
    "resultado" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operaciones_idempotentes_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE INDEX "operaciones_idempotentes_created_at_idx" ON "operaciones_idempotentes"("created_at");

