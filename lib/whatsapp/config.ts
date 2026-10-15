// Configuración del asistente de WhatsApp (WhatsApp Cloud API de Meta + Claude).
// Todo sale de variables de entorno; sin ellas el webhook responde 503 y la
// tarjeta de «Mi cuenta» avisa que el asistente no está configurado.

export const whatsappConfig = () => ({
  token: process.env.WHATSAPP_TOKEN ?? "",
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  appSecret: process.env.WHATSAPP_APP_SECRET ?? "",
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
  /** Número del bot en dígitos (código de país incluido), para el enlace wa.me */
  numero: (process.env.WHATSAPP_NUMERO ?? "").replace(/\D/g, ""),
  graphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0",
})

export const whatsappConfigurado = () => {
  const c = whatsappConfig()
  return !!(c.token && c.phoneNumberId && c.appSecret && c.verifyToken)
}

export const asistenteConfigurado = () => !!process.env.ANTHROPIC_API_KEY

/** Modelo de Claude del asistente (se puede cambiar sin tocar código). */
export const MODELO_ASISTENTE = process.env.WHATSAPP_MODELO || "claude-opus-5-5"

/** Límite de mensajes por número para acotar el costo: 30 cada 10 minutos. */
export const LIMITE_MENSAJES = { cantidad: 30, minutos: 10 }
/** Intentos desde números sin vincular (para que no se pueda adivinar un código). */
export const LIMITE_SIN_VINCULAR = { cantidad: 8, minutos: 60 }
