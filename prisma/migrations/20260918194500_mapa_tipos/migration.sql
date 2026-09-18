-- Amplía el catálogo conservando todos los tipos anteriores. Un único ALTER
-- reemplaza la validación de forma atómica; no elimina sectores ni sus relaciones.
ALTER TABLE "sectores"
  DROP CONSTRAINT IF EXISTS "sectores_tipo_chk",
  ADD CONSTRAINT "sectores_tipo_chk" CHECK (tipo IN (
    'potrero', 'corral', 'manga', 'feedlot', 'embarcadero', 'enfermeria', 'otro',
    'cultivo', 'galpon', 'aguada', 'casa'
  )) NOT VALID;
