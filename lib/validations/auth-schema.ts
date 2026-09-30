import { z } from "zod"

/**
 * Schemas de autenticación compartidos entre cliente (formularios) y
 * servidor (API de registro, authorize de NextAuth, reset de contraseña).
 * Usar los mismos schemas en ambos lados evita que el formulario acepte
 * algo que después el servidor rechaza.
 */

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 72 // bcrypt ignora lo que pase de 72 bytes

/** Requisitos de contraseña, reutilizados por el indicador visual del formulario */
export const PASSWORD_REQUISITOS = [
  {
    id: "longitud",
    label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    test: (value: string) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "letra",
    label: "Una letra",
    test: (value: string) => /\p{L}/u.test(value),
  },
  {
    id: "numero",
    label: "Un número",
    test: (value: string) => /\d/.test(value),
  },
] as const

/** Normaliza emails: sin espacios y en minúsculas (los teclados móviles capitalizan) */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

export const emailSchema = z
  .string({ required_error: "El email es requerido" })
  .trim()
  .min(1, "El email es requerido")
  .email("Ingresá un email válido")
  .max(254, "El email es demasiado largo")
  .transform(normalizarEmail)

export const passwordSchema = z
  .string({ required_error: "La contraseña es requerida" })
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(PASSWORD_MAX_LENGTH, `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres`)
  .refine((value) => /\p{L}/u.test(value), "La contraseña debe incluir al menos una letra")
  .refine((value) => /\d/.test(value), "La contraseña debe incluir al menos un número")

/** Login: solo exige que haya contraseña (las cuentas viejas pueden tener otra política) */
export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: "La contraseña es requerida" })
    .min(1, "La contraseña es requerida")
    .max(PASSWORD_MAX_LENGTH, "La contraseña es demasiado larga"),
})

const nombreSchema = (campo: string) =>
  z
    .string({ required_error: `El ${campo} es requerido` })
    .trim()
    .min(1, `El ${campo} es requerido`)
    .max(80, `El ${campo} es demasiado largo`)

/** Payload que recibe POST /api/auth/register */
export const registerApiSchema = z.object({
  nombre: nombreSchema("nombre"),
  apellido: nombreSchema("apellido"),
  email: emailSchema,
  telefono: z
    .string()
    .trim()
    .max(30, "El teléfono es demasiado largo")
    .regex(/^[+\d\s()-]*$/, "El teléfono solo puede contener números, espacios, +, ( ) y -")
    .optional()
    .transform((value) => (value ? value : undefined)),
  password: passwordSchema,
})

/** Formulario de registro: agrega la confirmación de contraseña */
export const registerFormSchema = registerApiSchema
  .extend({
    confirmPassword: z.string().min(1, "Confirmá tu contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })

export const resetPasswordFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirmá tu contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })

export const resetPasswordApiSchema = z.object({
  token: z.string().min(1, "El token es requerido"),
  email: emailSchema,
  password: passwordSchema,
})

export type LoginInput = z.input<typeof loginSchema>
export type RegisterFormInput = z.input<typeof registerFormSchema>
export type ResetPasswordFormInput = z.input<typeof resetPasswordFormSchema>

/**
 * Valida el callbackUrl para evitar open redirects: solo rutas internas
 * relativas ("/ganado", no "//evil.com" ni "https://...").
 */
export function callbackUrlSeguro(url: string | null | undefined, fallback = "/"): string {
  if (!url || !url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) {
    return fallback
  }
  // No volver a las pantallas de auth después de loguearse
  if (/^\/(login|register|forgot-password|reset-password)(\/|\?|$)/.test(url)) {
    return fallback
  }
  return url
}

/**
 * Códigos que `authorize` devuelve al cliente (vía `CredentialsSignin.code`)
 * para poder mostrar un mensaje preciso sin filtrar si un email existe.
 */
export const AUTH_ERROR_CODES = {
  CREDENCIALES_INVALIDAS: "credenciales_invalidas",
  CUENTA_INACTIVA: "cuenta_inactiva",
  SERVICIO_NO_DISPONIBLE: "servicio_no_disponible",
} as const

export function mensajeErrorLogin(error?: string | null, code?: string | null): string {
  if (code === AUTH_ERROR_CODES.CUENTA_INACTIVA) {
    return "Tu cuenta está desactivada. Contactá al administrador de tu organización."
  }
  if (code === AUTH_ERROR_CODES.SERVICIO_NO_DISPONIBLE || error === "Configuration") {
    return "No pudimos conectar con el servidor. Intentá de nuevo en unos minutos."
  }
  return "Email o contraseña incorrectos"
}
