import { Suspense } from "react"
import type { Metadata } from "next"
import { AyudaCliente } from "@/components/ayuda/ayuda-cliente"

export const metadata: Metadata = { title: "Ayuda · AgroMonitor" }

/** Documentación de uso: cómo hacer cada cosa en cada módulo. */
export default function AyudaPage() {
  return (
    <Suspense>
      <AyudaCliente />
    </Suspense>
  )
}
