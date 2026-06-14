# Plan de pruebas — Bastón XRS2i + Agromonitor

Cómo testear que todo funciona, **caso por caso**, en **local** y **online**, en **PC** y **mobile**.
Marcá cada casilla a medida que pase. Detalle de la integración en `GUIA_XRS2i_INTEGRACION.md`.

---

## 0. Preparación (una sola vez)

**Bastón (Settings):**
- [ ] Firmware ≥ 1.4.01 (el tuyo: 1.4.12.17 ✅)
- [ ] **Tag Format = Decimal2** (Settings → Tag Reading)
- [ ] Connect Mode según la prueba:
  - **HID** → para mobile y para la prueba "teclado"
  - **Default** → para la prueba Web Serial en PC
- [ ] Bluetooth = Manual o Auto

**Software:**
- [ ] `pnpm install` hecho
- [ ] `pnpm type-check` sin errores
- [ ] `pnpm lint` sin errores
- [ ] `pnpm build` OK (esto valida que compila para producción)

---

## 1. Cómo correr cada entorno

### Local (tu PC, desarrollo)
```bash
pnpm dev          # http://localhost:3000
```
- PC: abrí `http://localhost:3000/manga` en Chrome/Edge.
- Mobile en la MISMA red: averiguá la IP de tu PC (`ipconfig`) y entrá desde el celu a
  `http://<IP-de-tu-PC>:3000/manga`.
  ⚠️ **Web Serial y HID en mobile necesitan HTTPS o localhost.** Por IP HTTP, HID
  (teclado) funciona igual; para Web Serial real en mobile no aplica (no existe en mobile).

### Online (producción / Vercel)
```bash
pnpm build        # verificar que compila
git push          # despliega en Vercel (si está conectado)
```
- Entrá a la URL de Vercel (`https://...vercel.app/manga`). Al ser HTTPS, el celu permite
  PWA "instalar app", y el HID funciona pleno.

---

## 2. Cómo simular las condiciones

- **Sin conexión (offline):** Chrome DevTools (F12) → pestaña **Network** → selector
  **"No throttling" → "Offline"**. En celu: modo avión dejando el Bluetooth ON.
- **Volver online:** misma opción → "Online". Debe dispararse el **sync automático**.
- **Ver la cola offline:** DevTools → **Application → IndexedDB → `agromonitor-manga` →
  `pending-items`** (ahí ves los registros guardados localmente).

---

## 3. Casos de uso a probar

> Hay **2 modos de sesión**: **Alta/Identificación** y **Trabajo/Lectura**.
> Se prueban en **4 combinaciones**: PC-online, PC-offline, Mobile-online, Mobile-offline.

### CASO A — Alta / Identificación de animales
Objetivo: escanear EID de un animal **nuevo** y cargarle caravana visual, sexo, categoría.

Pasos:
1. Nueva sesión → tipo que incluya **Registro** (alta).
2. Conectá el bastón (HID o Web Serial).
3. Escaneá una caravana de un animal que **no** existe en la base.
4. Completá caravana visual, sexo y categoría en pantalla.
5. **Confirmar y Siguiente**.

Resultado esperado:
- [ ] El EID aparece **limpio** (15 dígitos, sin espacios) en el campo.
- [ ] Se marca como "animal nuevo".
- [ ] Al confirmar, **se guarda el animal con caravana/sexo/categoría** (verificar en /ganado).
- [ ] El foco vuelve al campo de EID listo para el siguiente.

### CASO B — Trabajo / Lectura
Objetivo: escanear EID de un animal **existente**, ver su info y registrar un evento (peso, tacto…).

Pasos:
1. Nueva sesión → tipo con **Peso** (o Tacto/Sanidad).
2. Conectá el bastón.
3. Escaneá la caravana de un animal **existente**.
4. Verificá que aparece la **info del animal**.
5. Cargá el peso (u otro dato) → **Confirmar y Siguiente**.

Resultado esperado:
- [ ] Muestra los datos del animal correcto.
- [ ] Guarda el evento (verificar en la lista "Animales procesados" y en /ganado).
- [ ] Doble escaneo del mismo animal seguido **no** duplica (dedupe).

---

## 4. Matriz de pruebas (marcá cada celda)

| Caso | PC online | PC offline | Mobile online | Mobile offline |
|---|---|---|---|---|
| **A — Alta** | ☐ | ☐ | ☐ | ☐ |
| **B — Lectura** | ☐ | ☐ | ☐ | ☐ |

**Qué validar en cada celda:**
- **Online:** el dato llega al servidor (aparece en /ganado o en el resumen de sesión).
- **Offline:** aparece el cartel "Sin conexión — guardado localmente"; el registro queda en
  IndexedDB (`pending-items`); al volver online se sincroniza solo y el contador "pendientes"
  baja a 0.
- **PC:** probar **ambas** conexiones del bastón (Web Serial en Default, y HID en teclado).
- **Mobile:** probar **HID** (única vía en celu).

---

## 5. Pruebas específicas de conexión del bastón

### Web Serial (PC, Connect Mode = Default)
- [ ] "Conectar bastón" → en el selector aparece el **COM del XRS2i** (sin filtro) → elegir.
- [ ] Estado pasa a "Conectado / Leyendo".
- [ ] Al escanear, el EID entra solo.
- [ ] Apagar y prender el bastón (o alejarlo y acercarlo): **se reconecta solo** (backoff).

### HID (PC y Mobile, Connect Mode = HID)
- [ ] Emparejar el bastón como **teclado Bluetooth** del dispositivo.
- [ ] Hacer clic en el campo de EID (que quede con foco).
- [ ] Escanear → el EID se "tipea" y se dispara la búsqueda (Enter).
- [ ] Volver Connect Mode a **Default** si después usás balanza.

---

## 6. Checklist final (todo verde = listo)
- [ ] Caso A y B funcionan en las 4 celdas de la matriz.
- [ ] Offline → online sincroniza sin perder datos (incluido el **alta** con caravana/sexo/categoría).
- [ ] EID siempre llega normalizado (sin espacios) en HID y en Web Serial.
- [ ] No hay duplicados por doble lectura.
- [ ] `pnpm type-check`, `pnpm lint` y `pnpm build` pasan.
- [ ] Probado en PC (Chrome/Edge) y en celu (PWA por HTTPS).
