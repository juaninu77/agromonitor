# Prompts para Cursor — pendientes del bastón XRS2i

Copiá/pegá cada bloque en Cursor (modo Agent). Hacelos **de a uno**, en este orden,
commiteando entre cada uno. Contexto en `.cursor/rules/baston-xrs2i.md` y
`docs/GUIA_XRS2i_INTEGRACION.md`. La normalización de EID ya existe en
`lib/hardware/eid.ts` (`normalizeEID`) — reutilizala, no la dupliques.

---

## PROMPT 1 — Caché local del rodeo (lectura offline)

```
Contexto: en el módulo manga, la búsqueda de animales por EID en
app/(app)/manga/components/manga-workspace.tsx (función searchAnimal) siempre hace
fetch a /api/ganado/bovinos, así que offline falla y trata a todo animal como nuevo.

Quiero que la lectura de un EID funcione SIN conexión.

1. Creá lib/hardware/herd-cache.ts (mismo patrón que lib/hardware/offline-queue.ts,
   IndexedDB) con:
   - saveHerd(establecimientoId, animales): guarda el rodeo en un object store
     'herd' indexado por EID y por establecimientoId.
   - findAnimalByEID(eid): devuelve el animal cacheado o null.
   - getHerdCount(establecimientoId): número de animales cacheados.
   Normalizá el EID con normalizeEID de lib/hardware/eid.ts antes de guardar y de buscar.

2. Al iniciar/abrir una sesión de manga (cuando hay establecimiento activo y hay
   conexión), descargá el rodeo desde /api/ganado/bovinos y llamá saveHerd(...).
   Mostrá un indicador chico tipo "Rodeo en caché: N animales".

3. En searchAnimal: si navigator.onLine es false (o el fetch falla), buscá con
   findAnimalByEID(eid) y usá ese resultado. Si está online, fetch normal y de paso
   refrescá el caché.

Respetá las convenciones de CLAUDE.md. Al terminar, corré `pnpm type-check` y `pnpm lint`
y arreglá lo que falle. No toques la base de datos.
```

---

## PROMPT 2 — Persistir el alta de animal nuevo (caravana/sexo/categoría)

```
Bug: en app/(app)/manga/components/action-panel.tsx el formulario de "Registro de animal
nuevo" recolecta regCaravanaVisual, regSexo y regCategoria, pero handleConfirmar NUNCA los
envía. Además el endpoint app/api/manga/[id]/items/route.ts (crearItemSchema) no tiene esos
campos, y el modelo SesionMangaItem en prisma/schema.prisma tampoco. Resultado: el alta se
pierde.

Quiero que el alta de un animal nuevo quede guardada de punta a punta.

1. prisma/schema.prisma: agregá a SesionMangaItem los campos opcionales
   caravanaVisual (String?), sexo (String?), categoria (String?). Es solo ADD COLUMN.
2. Endpoint items: sumalos a crearItemSchema y al create de Prisma.
3. action-panel.tsx: incluí esos campos en el payload (online y en la rama offline).
4. lib/hardware/offline-queue.ts: agregá esos 3 campos a PendingItem y al body de
   syncPendingItems.
5. Si esNuevoRegistro, que además se cree/actualice el Animal correspondiente con esos
   datos (revisá cómo se crea un Animal en el resto del código y reutilizá esa lógica/endpoint).

Después corré la migración con `pnpm db:push` (mostrame el SQL antes), `pnpm type-check`,
`pnpm lint`. Seguí las reglas de .cursor/rules/seguridad-db.md (solo ADD COLUMN, sin DROP).
```

---

## PROMPT 3 — "Modo escaneo" (foco fijo, dedupe, normalización, feedback)

```
En app/(app)/manga/components/manga-workspace.tsx el campo de EID se usa tanto para tipeo
manual como para el bastón en modo HID (teclado Bluetooth). Quiero un "modo escaneo" sólido:

1. Normalizá SIEMPRE la entrada con normalizeEID de lib/hardware/eid.ts antes de buscar
   (tanto en handleEidSubmit como en handleReaderEID), así "964 155000012939" del bastón
   queda en "964155000012939".
2. Foco fijo: mantené el foco en el input de EID después de cargar cada animal y al cerrar
   diálogos, para que el siguiente escaneo entre directo.
3. Dedupe: ignorá el mismo EID si se lee de nuevo dentro de los 3 segundos.
4. Feedback: un beep corto (Web Audio) y vibración (navigator.vibrate, si existe) al leer
   un EID válido; sonido distinto si el EID es inválido.

No rompas la API pública de ReaderConnect ni de EIDReaderService. Al terminar
`pnpm type-check`, `pnpm lint`, y probá el flujo con el plan de docs/PLAN_DE_PRUEBAS_BASTON.md.
```

---

## PROMPT 4 — Selector de modo de conexión (Teclado HID / Serial)

```
En el módulo manga quiero que el usuario elija cómo conecta el bastón, porque hay dos vías:
- "Teclado (HID)": el bastón está emparejado como teclado Bluetooth y tipea el EID en el
  campo con foco. Es la única vía en mobile. No usa Web Serial.
- "Avanzado (Serial)": usa la Web Serial API (EIDReaderService de lib/hardware/serial-reader.ts).
  Solo Chrome/Edge de escritorio.

1. Agregá un selector (toggle o Select) en la barra superior de
   app/(app)/manga/components/manga-workspace.tsx con esas dos opciones. Persistí la
   elección en localStorage.
2. Si el modo es "Teclado (HID)": NO muestres el botón de Web Serial; mostrá una ayuda corta
   ("Emparejá el bastón como teclado y escaneá en el campo de EID") y mantené el foco en el
   input. La lectura entra por el input normal (ya normalizado con normalizeEID).
3. Si el modo es "Avanzado (Serial)": mostrá el ReaderConnect actual.
4. Detectá automáticamente: si EIDReaderService.isSupported() es false (ej. mobile),
   forzá "Teclado (HID)" y ocultá la opción Serial.

No rompas la API pública de ReaderConnect ni de EIDReaderService. Al terminar corré
`pnpm type-check` y `pnpm lint`.
```

---

## Después de los 4 prompts
Seguí `docs/PLAN_DE_PRUEBAS_BASTON.md` para testear cada caso de uso en local y online, PC y mobile.
```
