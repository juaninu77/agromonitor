"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, MessageCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

/** Cargas por WhatsApp de operarios que esperan validación (solo para admin/encargado del campo). */
export function WhatsappValidar({ establecimientoId }: { establecimientoId: string }) {
  const { data: cantidad = 0 } = useQuery({
    queryKey: ["whatsapp", "pendientes", establecimientoId],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/borradores/pendientes?establecimientoId=${establecimientoId}`)
      return res.ok ? ((await res.json()).data.cantidad as number) : 0
    },
  })
  if (!cantidad) return null
  return (
    <Card className="border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20">
      <CardContent className="p-4">
        <Link href="/whatsapp" className="flex items-center gap-3 text-sm hover:underline">
          <MessageCircle className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
          <span className="min-w-0 flex-1"><strong>{cantidad} {cantidad === 1 ? "carga por WhatsApp espera" : "cargas por WhatsApp esperan"} tu validación</strong><span className="text-muted-foreground"> · hasta que las apruebes no se registran</span></span>
          <ArrowRight className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  )
}
