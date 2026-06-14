# Guía: Tru-Test XRS2i — cómo funciona, cómo se conecta y cómo integrarlo a Agromonitor

> Basado en la documentación oficial de Datamars/Tru-Test (manual del XRS2i y Knowledge Base de Datamars Livestock). Fuentes al final.

---

## 1. Cómo funciona el bastón

El XRS2i se puede usar de **dos formas**:

- **Standalone (autónomo):** guarda cada caravana escaneada en su memoria interna, en una *sesión*. Después transferís esos datos a la PC/teléfono/nube.
- **Connected (conectado):** transmite **cada caravana en el momento** a un dispositivo conectado (balanza, PC o teléfono). **Este es el modo que usa Agromonitor.**

### Conexiones físicas
- **Cable USB:** carga el bastón **y** lo conecta a la PC para usar **Data Link** (transferir sesiones, configurar, actualizar firmware).
- **Bluetooth:** lo conecta a balanzas, PC o teléfono.

### Modos de Bluetooth (Settings → Bluetooth)
- **Auto** (default): se reconecta solo al último dispositivo emparejado / a una balanza Tru-Test.
- **Manual:** buscás y aceptás conexiones manualmente (lo que usaste: "Bluetooth manual → conectar a dispositivo").
- **Off.**

### ⭐ El ajuste CLAVE para integrar: "Connect Mode" (Settings → Advanced → Connect Mode)
- **Default:** el bastón habla por un **protocolo serie** con balanzas y software. Por Bluetooth eso se expone como un **puerto serie (SPP / COM7)**. **→ Es lo que lee Agromonitor con la Web Serial API.**
- **HID (Human Interface Device):** el bastón se empareja como un **teclado Bluetooth** y "tipea" el EID en **cualquier** aplicación que tenga el foco (Excel, un input web, etc.). No necesita integración. **→ La forma más simple de usarlo.**

> ⚠️ Si lo dejás en HID, no funciona con balanzas. Para balanzas hay que volver a **Default**.

### ⭐ Formato del tag (Settings → Tag Reading → Tag Format)
Esto define **cómo llega el número** y es crítico para que Agromonitor lo parsee bien:

| Formato | Ejemplo | ¿Sirve para Agromonitor? |
|---|---|---|
| **Decimal** (default) | `964 155000012939` | ⚠️ Trae un **espacio** (país + nacional). Hay que limpiarlo. |
| **Decimal2** | `964155000012939` | ✅ **Recomendado** — 15 dígitos seguidos, sin espacio. |
| Hex | `8000F66416B8808B` | ❌ No es decimal. |
| ISO | `1000000964155000012939` | ✅ Sirve (más largo). |
| ISO23 | `A0000000964000000123456` | ❌ Trae prefijo de letra. |

**Recomendación:** poné el bastón en **Decimal2**. Si lo dejás en Decimal (default), el parseo debe quitar espacios antes de validar (ver sección 4).

---

## 2. El software de Datamars (con qué lo comparás)

- **Data Link PC** (solo **Windows**): transfiere sesiones del bastón a la PC, sube datos al bastón, exporta a `.csv/.xls/.xlsx/NLIS/NAIT`, actualiza firmware. Es donde se "arman" las plantillas/archivos.
- **Data Link App** (iOS/Android): emailear sesiones, registrar transacciones, subir a la nube. El teléfono también puede recibir los escaneos por Bluetooth.
- **Datamars Livestock (nube)** — `livestock.datamars.com`: ver datos online, pesos, metas, grupos. Es el equivalente "nube" de tu Agromonitor.

---

## 3. Cómo se arman las "plantillas" en Datamars (y cómo se mapean a Agromonitor)

En el mundo Datamars no hay una sola cosa llamada "plantilla": es la **combinación** de cuatro piezas. Esto es importante porque cada pieza tiene un equivalente directo en tu modelo de Agromonitor.

### a) Favourites (Favoritos) = tu "plantilla de sesión"
Configuraciones guardadas para una tarea (qué campos aparecen al escanear, modo de lectura, formato de tag…). Se aplican al **iniciar una sesión nueva**.
→ **En Agromonitor:** es tu **configuración de sesión de manga** (`tipo` + `accionesHabilitadas` + campos habilitados). Ya tenés este concepto.

### b) Animal Data fields = tus campos/atributos
Campos predefinidos (Breed, Date of birth, Sex, Condition score, Note) + **campos personalizados que vos creás en el bastón**. Cada campo es una columna.
→ **En Agromonitor:** tu tabla **`AnimalAttr` (EAV)** y los campos de los eventos. Mapeo 1 a 1.

### c) Tipos de dato: Life Data vs Session Data vs IDs
Datamars clasifica todo en tres tipos (¡idéntico a tu arquitectura de event-sourcing!):

| Tipo Datamars | Qué es | Ejemplos | Equivalente en Agromonitor |
|---|---|---|---|
| **Life Data** | No cambia en la vida del animal | Raza, Sexo, Fecha nac. | Atributos del `Animal` / `AnimalAttr` |
| **Session Data** | Cambia por sesión / hay varios | Pesos, BCS, tratamientos | Tus **eventos** (`EvtPesada`, `EvtSanidad`, `EvtTacto`…) |
| **IDs** | Identificadores únicos | EID, VID, LID | `caravana` / EID del animal |

### d) Alerts y Animal Lifetime Information (archivos precargados)
- **Alerts:** subís un CSV de EIDs y, al escanear ese animal, el bastón te avisa (ej. "descartar").
- **Animal lifetime info / ID bucket:** subís pares **EID↔VID** (u otros datos) para que, al escanear, el bastón muestre el VID/datos automáticamente.
→ **En Agromonitor:** son tus **notificaciones/flags** y la **búsqueda del animal por EID** (que ya hacés en vivo con `searchAnimal`, así que no necesitás precargar nada en el bastón).

### Cómo se "arman" físicamente en Data Link
Todo se hace con **archivos CSV** (preferido) / XLS / XLSX / TXT:
- Data Link usa el **nombre de la columna** para decidir si **crea** una columna nueva o **actualiza** una existente en el bastón.
- Si el nombre de columna coincide exactamente → actualiza esa columna. Si no coincide → crea una columna nueva.
- Se sube con: *Put information onto device* → **Session files** (campos nuevos quedan como Session Data) o **Animal lifetime information** (campos nuevos quedan como Life Data).

---

## 4. Cómo adaptar las plantillas a Agromonitor (lo que vos querés)

La idea: **no dependés de las plantillas del bastón**. Tu ERP hace de "cerebro" y el bastón solo aporta el **EID**. La equivalencia es:

1. **Tu "plantilla" = tu configuración de sesión de manga.** Definí por tipo de trabajo (pesada, vacunación, tacto…) qué acciones/campos se habilitan. Eso reemplaza a los *Favourites* + *Animal Data fields* del bastón.

2. **El bastón solo manda el EID.** Agromonitor busca el animal por EID en tu propia base (ya lo hace `searchAnimal`). No hace falta precargar EID↔VID ni alerts en el bastón: esos datos ya los tenés en tu DB y los mostrás en pantalla.

3. **Interoperabilidad por CSV (para no quedar encerrado).** Para importar/exportar con Data Link/Datamars Livestock, respetá sus convenciones de columnas:
   - Una columna **`EID`** (tipo ID) — la llave.
   - Columnas de **Life Data** (Raza, Sexo, FechaNac) → al importar, **actualizan** el animal.
   - Columnas de **Session Data** (Peso, BCS, Tratamiento) → al importar, **crean registros de evento**.
   - Guardá/leé en **CSV (delimitado por comas)**, que es el formato preferido.
   Tu pantalla "Importar desde bastón (CSV)" ya apunta a esto: alcanza con mapear esas columnas a tus eventos/atributos.

4. **Formato del EID:** poné el bastón en **Decimal2** (o ISO) para que el número llegue limpio. Si querés tolerar el Decimal con espacio, en el parser limpiá espacios antes de validar:

   ```ts
   // en serial-reader.ts, dentro del readLoop, antes de match:
   const clean = line.replace(/\s+/g, '');        // "964 155000012939" -> "964155000012939"
   const match = clean.match(/(\d{15,16})/);
   if (match) this.onEIDCallback?.(match[1]);
   ```
   (Te lo puedo dejar aplicado si querés — hace que funcione con cualquier formato decimal.)

---

## 5. Las dos formas de conectar el bastón a Agromonitor

### Opción A — Web Serial (Connect Mode = **Default**) — *la que ya tenés*
El bastón transmite el EID por **Bluetooth SPP (COM7)**; Agromonitor abre el puerto y lo lee en streaming.
- ✅ Programático: lectura continua, estado de conexión, reconexión automática.
- ⚠️ Solo Chrome/Edge, pide permiso de puerto serie, y depende del COM.
- **Requisito:** Tag Format en **Decimal2/ISO** (o limpiar espacios en el parser).

### Opción B — HID / "teclado Bluetooth" (Connect Mode = **HID**) — *la más simple*
El bastón se empareja como **teclado Bluetooth** y **tipea el EID + Enter** en el campo que tenga el foco.
- ✅ Súper simple: funciona en **cualquier navegador/SO**, **sin permisos, sin COM, sin código nuevo**.
- ✅ **Tu input de EID en `/manga` ya lo soporta:** el campo tiene `onKeyDown` con Enter → busca el animal. Poné el foco ahí y escaneá.
- ⚠️ Hay que mantener el **foco** en el input; no da estado ni streaming; es una sola vía.
- ⚠️ Requiere firmware del bastón **1.4.01 o superior**.
- ⚠️ Para volver a usarlo con balanzas, cambiá Connect Mode de nuevo a **Default**.

### Recomendación
- Para **"enchufar y usar ya, fácil"** → **HID** + tu campo de EID actual. Cero fricción.
- Para el **workspace integrado** (estado, lectura continua, reconexión) → **Web Serial (Default)**, que es lo que ya programamos.
- Ideal: soportar **las dos** y un selector "Modo de conexión: Teclado (HID) / Avanzado (Serial)".

---

## 6. Para "simplemente conectarlo y usarlo" hoy

1. En el bastón: **Settings → Advanced → Connect Mode → HID**.
2. Emparejalo como teclado: **Settings → Bluetooth → Manual → Search for devices → tu PC** (o que la PC lo agregue).
3. En Agromonitor, andá a `/manga`, abrí/iniciá la sesión, hacé clic en el **campo de EID** (que quede con foco).
4. Escaneá una caravana: el EID se tipea solo y Agromonitor busca el animal.
5. Cuando termines, si vas a usar balanza, volvé Connect Mode a **Default**.

---

## Fuentes
- Manual de usuario XRS2i (Tru-Test/Datamars): https://manuals.plus/tru-test/xrs2i-stick-reader-manual
- Página de producto XRS2i: https://us.tru-test.com/products/eid-readers/xrs2i-stick-reader
- HID mode — escanear EIDs a PC/Apple/Android: https://support.livestock.datamars.com/en/articles/9922780-scanning-eids-onto-your-windows-computer-apple-and-android-devices
- Subir archivos al dispositivo Tru-Test (formato de columnas / CSV): https://support.livestock.datamars.com/en/articles/9922747-uploading-files-onto-your-tru-test-device
- Tipos de dato: Life Data, Session Data, IDs: https://support.livestock.datamars.com/en/articles/9949703-types-of-data-life-data-session-data-and-animal-ids
- Data Link PC software: https://us.tru-test.com/products/software-apps/data-link-pc-software
- Datamars Livestock (nube): https://livestock.datamars.com
