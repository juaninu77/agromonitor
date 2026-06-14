// Utilidades compartidas para normalizar lecturas de EID (caravana electrónica).
// Lo usan tanto el lector Web Serial (serial-reader.ts) como la entrada por
// teclado HID y el import de CSV, para que TODOS interpreten el número igual.

// ISO 11784/11785: el EID es un número decimal de 15 o 16 dígitos.
// El bastón puede mandar varios formatos:
//   - Decimal  -> "964 155000012939"  (con espacio entre país y nacional)
//   - Decimal2 -> "964155000012939"   (15 dígitos seguidos) [recomendado]
// Esta función tolera espacios/separadores y devuelve el EID limpio o null.
export function normalizeEID(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Quita espacios, tabs, saltos de línea y separadores comunes.
  const compact = raw.replace(/[\s.,;:_-]+/g, "");
  const match = compact.match(/(\d{15,16})/);
  return match ? match[1] : null;
}

// Devuelve true si la cadena contiene un EID válido (15-16 dígitos).
export function isValidEID(raw: string | null | undefined): boolean {
  return normalizeEID(raw) !== null;
}
