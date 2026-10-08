-- AlterTable
ALTER TABLE "membresias" ADD COLUMN     "acceso_total" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "invitado_por_id" UUID;

-- CreateTable
CREATE TABLE "membresia_establecimientos" (
    "membresia_id" UUID NOT NULL,
    "establecimiento_id" UUID NOT NULL,

    CONSTRAINT "membresia_establecimientos_pkey" PRIMARY KEY ("membresia_id","establecimiento_id")
);

-- CreateTable
CREATE TABLE "invitaciones" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "acceso_total" BOOLEAN NOT NULL DEFAULT true,
    "establecimiento_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "mensaje" TEXT,
    "token_hash" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "expira_at" TIMESTAMP(3) NOT NULL,
    "invitado_por_id" UUID NOT NULL,
    "aceptada_por_id" UUID,
    "aceptada_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "membresia_establecimientos_establecimiento_id_idx" ON "membresia_establecimientos"("establecimiento_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitaciones_token_hash_key" ON "invitaciones"("token_hash");

-- CreateIndex
CREATE INDEX "invitaciones_organizacion_id_estado_idx" ON "invitaciones"("organizacion_id", "estado");

-- CreateIndex
CREATE INDEX "invitaciones_email_idx" ON "invitaciones"("email");

-- AddForeignKey
ALTER TABLE "membresia_establecimientos" ADD CONSTRAINT "membresia_establecimientos_membresia_id_fkey" FOREIGN KEY ("membresia_id") REFERENCES "membresias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresia_establecimientos" ADD CONSTRAINT "membresia_establecimientos_establecimiento_id_fkey" FOREIGN KEY ("establecimiento_id") REFERENCES "establecimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_invitado_por_id_fkey" FOREIGN KEY ("invitado_por_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Valores válidos (también en prisma/constraints.sql)
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_rol_chk" CHECK (rol IN ('admin', 'encargado', 'vet', 'operario'));
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_estado_chk" CHECK (estado IN ('pendiente', 'aceptada', 'revocada'));
-- Una sola invitación pendiente por persona y organización
CREATE UNIQUE INDEX "invitaciones_pendiente_unica" ON "invitaciones" ("organizacion_id", lower("email")) WHERE estado = 'pendiente';
