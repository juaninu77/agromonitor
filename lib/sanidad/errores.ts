// Error de dominio de Sanidad (status HTTP y código opcional para la interfaz).
export class SanidadError extends Error { constructor(message: string, public status = 400, public codigo?: string) { super(message) } }
