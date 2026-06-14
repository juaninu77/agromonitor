# 📡 Integración del bastón Tru-Test XRS2i con Agromonitor

> Decisiones de arquitectura y pendientes acordados. Detalle completo en
> `docs/GUIA_XRS2i_INTEGRACION.md`. Mantener este archivo como fuente de verdad
> para cualquier trabajo sobre lectura de EID / módulo `manga`.

## Hechos del hardware
- Bastón: **Tru-Test XRS2i**, firmware **1.4.12.17** (soporta HID).
- Puerto serie por Bluetooth (SPP) en la PC del usuario: **COM7**.
- **Tag Format recomendado: Decimal2** (`964155000012939`, 15 dígitos sin espacio).
  El default "Decimal" trae un espacio (`964 155000012939`) → el parser debe
  limpiar espacios antes de validar el EID (regex `\d{15,16}`).

## Dos formas de conectar (ambas válidas)
- **HID (teclado Bluetooth)** — Connect Mode = HID en el bastón. El EID se "tipea"
  en el campo con foco. **Única opción en celular** (la Web Serial API NO existe en
  Android/iOS). Es la vía recomendada para uso inalámbrico en el campo.
- **Web Serial (Connect Mode = Default)** — solo Chrome/Edge de **escritorio**.
  Lector integrado en `lib/hardware/serial-reader.ts` (streaming, estado,
  reconexión con backoff). Abrir el puerto **una vez** y mantenerlo abierto.

## Arquitectura objetivo
- **Agromonitor es offline-first**: el celu/PC que corre la app es el almacén
  principal (IndexedDB). El **bastón es solo la fuente del EID**.
- La **memoria del bastón + import CSV** son la **red de seguridad** (no el almacén
  principal). No cargar datos ricos en el teclado del bastón (es lento).
- **Dos modos de sesión:**
  1. **Identificación / Alta:** escanear EID → asociar caravana visual, sexo,
     categoría, raza (se tipea cómodo en celu/PC).
  2. **Trabajo / Lectura:** escanear EID → ver info del animal → registrar evento
     (peso, tacto, CC, sanidad…).

## Pendientes prioritarios (gaps detectados)
1. **Caché local del rodeo (IndexedDB)** para que la búsqueda EID→animal
   (`searchAnimal`) funcione **offline**. Hoy solo se encolan escrituras, no lecturas.
2. **Bug de alta offline:** la rama offline de `ActionPanel.handleConfirmar` /
   `addPendingItem` **no guarda** `caravana visual`, `sexo` ni `categoría` del
   animal nuevo. Incluirlos en `PendingItem` y en el sync.
3. **"Modo escaneo" de primera clase:** mantener foco fijo en el input, normalizar
   formato (quitar espacios), dedupe de doble lectura, feedback (sonido/vibración).
   Sirve igual para HID y Web Serial.
4. **Reconciliación CSV:** al importar la sesión del bastón como respaldo, deduplicar
   por EID (+timestamp) contra lo ya capturado en vivo.

## Convenciones de interoperabilidad (CSV con Datamars/Data Link)
- Columna **`EID`** como llave. Life Data (Raza/Sexo/FechaNac) actualiza el animal;
  Session Data (Peso/CC/…) crea eventos. Formato preferido: CSV (coma).
