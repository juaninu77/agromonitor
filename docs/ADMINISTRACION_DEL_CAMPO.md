# Administración del campo

Elegí el campo desde el selector superior y abrí **Administración**. El acceso corresponde a propietarios, administradores y encargados de esa organización. Ser propietario de otra organización no permite consultar estos datos.

## Primera carga

1. En **Patrimonio**, elegí **Nuevo registro**. Cargá un bien (tractor, vehículo, instalación, inmueble o herramienta), su referencia, fecha de adquisición y valor opcional. El valor es informativo: no calcula amortizaciones ni valuaciones fiscales.
2. En **Comprobantes**, registrá la factura o recibo con número, proveedor/cliente, fecha, importe total, moneda y sentido (ingreso o egreso). Marcá pendiente, pagado o anulado. No se emiten comprobantes fiscales ni se informa a ARCA. No hay liquidación de impuestos ni pagos parciales en esta versión.
3. En **Trámites SENASA**, cargá la referencia de RENSPA, DT-e, vacunación o habilitación y su vencimiento. El estado es una anotación del usuario: no verifica ni presenta trámites ante SENASA. Los documentos de tránsito operativos existentes siguen en Ventas y Compras.
4. Usá el botón del clip en cualquier registro para adjuntar su respaldo. En **Documentos** también podés cargar escrituras, contratos o fichas vinculadas a un animal, o dejar el documento asociado solo al campo.
5. Buscá por título o referencia, editá con el lápiz y descargá los originales con la flecha. Los listados muestran 25 resultados por página. Para encontrar un vínculo que no aparece entre los primeros 25, escribí parte del título o caravana.

## Adjuntos y conservación

- PDF, JPG y PNG, hasta **2 MiB por archivo** y **100 MiB por organización**. El servidor comprueba tamaño real y firma básica del formato. Esto no es un antivirus.
- Descarga privada, autenticada, sin caché pública y como archivo adjunto. No hay enlaces públicos permanentes.
- El contenido se guarda en una tabla separada de PostgreSQL; los listados solo consultan metadatos. Esta primera etapa funciona con el proyecto Neon actual sin una cuenta de almacenamiento adicional. Antes de un archivo masivo, migrar los binarios a almacenamiento de objetos privado conservando las referencias.
- Neon Object Storage no estaba disponible en `aws-us-east-1` al implementar este módulo; disponibilidad comprobada en https://neon.com/docs/introduction/regions. No se trasladó el proyecto de región.
- Editar un documento no reemplaza su archivo original. Para otra versión, cargá un documento nuevo y archivá el anterior. Archivar no borra el archivo ni libera cuota.
- Los registros se archivan, anulan o dan de baja mediante su estado. No hay eliminación física desde esta pantalla.
- Los importes se almacenan como Decimal(14,2); ingresalos con punto decimal. No se suman monedas distintas.
- Una edición concurrente produce un aviso y exige recargar, en vez de sobrescribir cambios ajenos.

## Despliegue y pruebas

Migración aditiva: `20260917042000_administracion`. Crea cinco tablas y sus restricciones; no modifica ni elimina filas de los modelos ganaderos existentes. Ejecutar `prisma migrate deploy` con la conexión directa del entorno correcto antes de servir el código nuevo.

Rama de ensayo: `codex-erp-documentos-patrimonio` (`br-bold-meadow-ahvdc1b6`). Nunca usarla como producción: contiene copias de datos existentes y cuentas ficticias de las pruebas.

`scripts/test-administracion-http.ts` requiere servidor local, `ERP_TEST_WRITES=confirmed-test-branch` y un `ERP_TEST_DATABASE_HOST` que coincida con la conexión. Comprueba además que la cuenta recién registrada exista en esa misma base; rechaza el host conocido de main. Conserva datos ficticios exclusivamente en ensayo para inspección del preview.

La administración no sustituye las funcionalidades operativas de ganado, sanidad, manga y movimientos. Los catálogos históricos sin organización siguen pendientes de identificación de su dueño y no se asignan arbitrariamente.
