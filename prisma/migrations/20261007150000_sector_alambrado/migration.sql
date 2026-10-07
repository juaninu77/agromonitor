-- Nuevo tipo de lugar: alambrado / división (línea dentro del campo).
-- Solo amplía el dominio del CHECK; no modifica filas.
ALTER TABLE "sectores" DROP CONSTRAINT IF EXISTS "sectores_tipo_chk",
  ADD CONSTRAINT "sectores_tipo_chk" CHECK (tipo IN ('potrero','corral','manga','feedlot','embarcadero','enfermeria','otro','cultivo','galpon','aguada','casa','camino','tranquera','limite','alambrado')) NOT VALID;
