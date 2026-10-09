-- AlterTable
ALTER TABLE "movimientos_stock" ADD COLUMN     "anula_a_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_stock_anula_a_id_key" ON "movimientos_stock"("anula_a_id");

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_anula_a_id_fkey" FOREIGN KEY ("anula_a_id") REFERENCES "movimientos_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

