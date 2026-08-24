-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN     "datos_nuevos" JSONB,
ADD COLUMN     "datos_previos" JSONB;

-- CreateIndex
CREATE INDEX "audit_log_usuario_id_idx" ON "audit_log"("usuario_id");

-- CreateIndex
CREATE INDEX "audit_log_tabla_row_pk_idx" ON "audit_log"("tabla", "row_pk");

