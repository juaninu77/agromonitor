-- DropForeignKey
ALTER TABLE "categorias" DROP CONSTRAINT "categorias_organizacion_id_fkey";

-- DropForeignKey
ALTER TABLE "especies" DROP CONSTRAINT "especies_organizacion_id_fkey";

-- DropForeignKey
ALTER TABLE "productos" DROP CONSTRAINT "productos_organizacion_id_fkey";

-- DropForeignKey
ALTER TABLE "razas" DROP CONSTRAINT "razas_organizacion_id_fkey";

-- AddForeignKey
ALTER TABLE "especies" ADD CONSTRAINT "especies_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "razas" ADD CONSTRAINT "razas_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

