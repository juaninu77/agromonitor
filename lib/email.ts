// Envío de correos opcional. Si están configuradas RESEND_API_KEY y EMAIL_FROM
// se envía por la API de Resend (sin dependencias); si no, se informa que no se
// envió y la interfaz ofrece copiar el enlace o compartirlo por WhatsApp.

export interface Correo { para: string; asunto: string; texto: string; html?: string }

export const correoConfigurado = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)

export async function enviarCorreo(c: Correo): Promise<{ enviado: boolean }> {
  if (!correoConfigurado()) return { enviado: false }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [c.para], subject: c.asunto, text: c.texto, ...(c.html ? { html: c.html } : {}) }),
      signal: AbortSignal.timeout(8000),
    })
    // Nunca se registra el contenido (lleva el enlace con el token)
    if (!res.ok) console.error("No se pudo enviar el correo", res.status)
    return { enviado: res.ok }
  } catch {
    console.error("No se pudo enviar el correo")
    return { enviado: false }
  }
}
