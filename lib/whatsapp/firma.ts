import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Meta firma cada POST del webhook con HMAC-SHA256 del cuerpo crudo usando el
 * App Secret: `X-Hub-Signature-256: sha256=<hex>`. Se compara en tiempo constante.
 */
export function verificarFirma(cuerpo: string, header: string | null, secreto: string): boolean {
  if (!secreto || !header?.startsWith("sha256=")) return false
  const esperada = createHmac("sha256", secreto).update(cuerpo, "utf8").digest()
  const recibida = Buffer.from(header.slice(7), "hex")
  return recibida.length === esperada.length && timingSafeEqual(new Uint8Array(recibida), new Uint8Array(esperada))
}
