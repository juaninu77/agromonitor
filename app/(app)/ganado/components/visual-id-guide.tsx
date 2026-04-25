"use client"

import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function VisualIdGuide() {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center gap-4 shadow-sm">
      <div className="flex items-center justify-between w-full border-b border-slate-200 pb-2">
        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          Guía de Identificación
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-slate-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                <p className="text-xs">Ubicación estándar de las caravanas y marcas oficiales.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h4>
      </div>

      <div className="relative w-full aspect-square max-w-[200px]">
        {/* SVG de una vaca simplificada con indicadores */}
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full text-slate-300"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Cuerpo básico */}
          <path d="M40 80 Q 40 40 100 40 Q 160 40 160 80 L 160 140 Q 160 160 140 160 L 60 160 Q 40 160 40 140 Z" />
          {/* Cabeza */}
          <path d="M70 40 Q 100 10 130 40 L 130 90 Q 100 110 70 90 Z" fill="currentColor" />
          {/* Oreja Izquierda (nuestra derecha) */}
          <path d="M130 50 Q 155 40 145 65 Z" className="text-slate-400" />
          {/* Oreja Derecha (nuestra izquierda) */}
          <path d="M70 50 Q 45 40 55 65 Z" className="text-slate-400" />
          
          {/* Marcadores de Identificación */}
          {/* Caravana Visual (Oreja Izquierda del animal) */}
          <circle cx="145" cy="55" r="8" className="text-amber-400 animate-pulse" fill="currentColor" />
          <text x="158" y="58" className="text-[10px] font-bold fill-amber-700">Visual</text>
          
          {/* Caravana RFID (Oreja Derecha del animal) */}
          <circle cx="55" cy="55" r="6" className="text-blue-400" fill="currentColor" />
          <text x="5" y="58" className="text-[10px] font-bold fill-blue-700">RFID/Botón</text>

          {/* CUIG / Marca de Fuego (En el anca) */}
          <rect x="135" y="110" width="15" height="15" rx="2" className="text-slate-500" fill="currentColor" />
          <text x="155" y="122" className="text-[10px] font-bold fill-slate-600">CUIG</text>
        </svg>
      </div>

      <div className="grid grid-cols-1 gap-2 w-full text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="text-slate-600 font-medium">Caravana Visual:</span>
          <span className="text-slate-400 italic">Identificación externa rápida</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-400" />
          <span className="text-slate-600 font-medium">RFID/Botón:</span>
          <span className="text-slate-400 italic">Lectura electrónica (IoT)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-slate-500" />
          <span className="text-slate-600 font-medium">CUIG/Marca:</span>
          <span className="text-slate-400 italic">Registro oficial SENASA</span>
        </div>
      </div>
    </div>
  )
}

