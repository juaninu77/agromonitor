"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

interface LoadingStateProps {
  message?: string
  submessage?: string
}

export function LoadingState({
  message = "Cargando...",
  submessage
}: LoadingStateProps) {
  return (
    <Card className="border-2 border-gray-200">
      <CardContent className="py-12">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900">{message}</p>
            {submessage && (
              <p className="text-sm text-gray-600 mt-1">{submessage}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface LoadingCardsProps {
  message?: string
}

export function LoadingCards({ message = "Cargando estadísticas..." }: LoadingCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i} className="border-2 border-gray-200 animate-pulse">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-gray-200 rounded" />
              <div className="flex-1">
                <div className="h-6 bg-gray-200 rounded w-16 mb-1" />
                <div className="h-3 bg-gray-200 rounded w-12" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {message && (
        <div className="col-span-full flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 text-blue-600 animate-spin mr-2" />
          <p className="text-sm text-gray-600">{message}</p>
        </div>
      )}
    </div>
  )
}
