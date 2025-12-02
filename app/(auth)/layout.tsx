/**
 * Layout para páginas de autenticación
 * Sin sidebar ni header, diseño centrado
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900">
      {/* Patrón de fondo */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      
      {/* Contenido */}
      <div className="relative z-10 w-full max-w-md px-4">
        {children}
      </div>
    </div>
  )
}

