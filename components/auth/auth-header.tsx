import type { LucideIcon } from "lucide-react"
import { Sprout } from "lucide-react"
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** Encabezado común (logo + título) de las pantallas de autenticación */
export function AuthHeader({
  title,
  description,
  icon: Icon = Sprout,
}: {
  title: string
  description?: React.ReactNode
  icon?: LucideIcon
}) {
  return (
    <CardHeader className="space-y-1 text-center pb-2">
      <div className="flex justify-center mb-4">
        <div className="p-3 rounded-full bg-emerald-100">
          <Icon className="h-10 w-10 text-emerald-600" aria-hidden="true" />
        </div>
      </div>
      <CardTitle className="text-2xl font-bold text-gray-900">{title}</CardTitle>
      {description && <CardDescription className="text-gray-600">{description}</CardDescription>}
    </CardHeader>
  )
}
