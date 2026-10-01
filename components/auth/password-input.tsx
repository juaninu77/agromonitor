"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  /** Muestra un aviso cuando Bloq Mayús está activado */
  avisarBloqMayus?: boolean
}

/**
 * Input de contraseña con botón "ojito" para mostrar/ocultar el texto
 * y aviso opcional de Bloq Mayús.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      avisarBloqMayus = false,
      onKeyUp,
      onKeyDown,
      onBlur,
      disabled,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const [visible, setVisible] = React.useState(false)
    const [bloqMayus, setBloqMayus] = React.useState(false)
    const avisoId = React.useId()

    const detectarBloqMayus = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (avisarBloqMayus && typeof e.getModifierState === "function") {
        setBloqMayus(e.getModifierState("CapsLock"))
      }
    }

    return (
      <div className="space-y-1">
        <div className="relative">
          <Input
            ref={ref}
            type={visible ? "text" : "password"}
            disabled={disabled}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby={[ariaDescribedBy, bloqMayus ? avisoId : undefined].filter(Boolean).join(" ") || undefined}
            className={cn("pr-10", className)}
            onKeyUp={(e) => {
              detectarBloqMayus(e)
              onKeyUp?.(e)
            }}
            onKeyDown={(e) => {
              detectarBloqMayus(e)
              onKeyDown?.(e)
            }}
            onBlur={(e) => {
              setBloqMayus(false)
              onBlur?.(e)
            }}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            disabled={disabled}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={visible}
            title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-gray-500 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {avisarBloqMayus && bloqMayus && (
          <p id={avisoId} role="status" className="text-xs text-amber-700">
            Bloq Mayús está activado
          </p>
        )}
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"
