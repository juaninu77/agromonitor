/** Mensaje de error de un campo, enlazado con aria-describedby */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-xs font-medium text-red-600">
      {message}
    </p>
  )
}
