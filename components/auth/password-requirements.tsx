import { Check, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import { PASSWORD_REQUISITOS } from "@/lib/validations/auth-schema"

/** Checklist en vivo de los requisitos de contraseña */
export function PasswordRequirements({ password, id }: { password: string; id?: string }) {
  return (
    <ul id={id} className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-3" aria-label="Requisitos de la contraseña">
      {PASSWORD_REQUISITOS.map((req) => {
        const cumple = req.test(password)
        return (
          <li
            key={req.id}
            className={cn("flex items-center gap-1.5", cumple ? "text-emerald-700" : "text-gray-500")}
          >
            {cumple ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
            <span>{req.label}</span>
            <span className="sr-only">{cumple ? "(cumplido)" : "(pendiente)"}</span>
          </li>
        )
      })}
    </ul>
  )
}
