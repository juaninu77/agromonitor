"use client"

import { Cloud, Wind, Book, Thermometer } from "lucide-react"
import { biblicalVerses } from "@/lib/mocks"
import { useEffect, useState } from "react"

export function Ticker() {
  const [currentVerse, setCurrentVerse] = useState(biblicalVerses[0])

  useEffect(() => {
    const today = new Date()
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
    const verseIndex = dayOfYear % biblicalVerses.length
    setCurrentVerse(biblicalVerses[verseIndex])
  }, [])

  return (
    <div className="bg-primary text-primary-foreground border-b-2 border-primary-foreground/20 overflow-hidden">
      <div className="flex items-center h-10 px-4">
        <div className="flex items-center gap-6 animate-marquee whitespace-nowrap">
          {/* Clima */}
          <div className="flex items-center gap-2 border-r border-primary-foreground/20 pr-6">
            <Thermometer className="h-4 w-4" />
            <span className="text-sm font-medium">24°C</span>
            <Cloud className="h-4 w-4 ml-2" />
            <span className="text-sm">Parcialmente Nublado</span>
          </div>

          {/* Viento */}
          <div className="flex items-center gap-2 border-r border-primary-foreground/20 pr-6">
            <Wind className="h-4 w-4" />
            <span className="text-sm font-medium">12 km/h NE</span>
            <span className="text-sm">Viento Moderado</span>
          </div>

          {/* Texto Bíblico */}
          <div className="flex items-center gap-2">
            <Book className="h-4 w-4" />
            <span className="text-sm font-medium">Versículo del Día:</span>
            <span className="text-sm italic">"{currentVerse.text}"</span>
            <span className="text-sm font-medium">- {currentVerse.reference}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
