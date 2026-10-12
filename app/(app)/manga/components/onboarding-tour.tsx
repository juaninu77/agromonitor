"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  HelpCircle,
  X,
  ChevronRight,
  ChevronLeft,
  ScanBarcode,
  Bluetooth,
  FileSpreadsheet,
  Wifi,
  WifiOff,
  Scale,
  Syringe,
  Stethoscope,
  FileDown,
  Sparkles,
} from "lucide-react"

const STORAGE_KEY = "agromonitor-manga-onboarding-seen"

interface OnboardingStep {
  icon: React.ReactNode
  title: string
  description: string
  color: string
}

const STEPS: OnboardingStep[] = [
  {
    icon: <ScanBarcode className="h-6 w-6" />,
    title: "Sesión de Manga",
    description:
      "Creá sesiones de trabajo para procesar hacienda. Elegí el tipo (pesada, vacunación, tacto, etc.) y las acciones que necesitás registrar.",
    color: "from-emerald-500 to-green-600",
  },
  {
    icon: <Bluetooth className="h-6 w-6" />,
    title: "Bastón Tru-Test XRS2i",
    description:
      "Vinculá el bastón por Bluetooth como teclado (HID) en el celular o la tablet, o usá el modo Avanzado (Serial) en Chrome o Edge de escritorio. Al pasar la caravana electrónica, el EID se carga solo y busca al animal en el rodeo.",
    color: "from-blue-500 to-indigo-600",
  },
  {
    icon: <Scale className="h-6 w-6" />,
    title: "Registrar datos en la manga",
    description:
      "Registrá peso, condición corporal (1 a 9), tacto, dentición y apartado de cada animal. Con Sanidad, el producto y la dosis se eligen al crear la sesión y marcás «Aplicar tratamiento» por animal. Un EID que no está en el rodeo se da de alta con «Registrar».",
    color: "from-amber-500 to-orange-600",
  },
  {
    icon: <FileSpreadsheet className="h-6 w-6" />,
    title: "Importar desde CSV",
    description:
      "Si trabajaste con el bastón en modo standalone, exportá el archivo desde Tru-test Data Link y subilo acá. Se importan automáticamente los EIDs y pesos.",
    color: "from-purple-500 to-violet-600",
  },
  {
    icon: <WifiOff className="h-6 w-6" />,
    title: "Funciona sin internet",
    description:
      "En el campo no siempre hay señal. Los datos se guardan localmente y se sincronizan automáticamente cuando vuelve la conexión.",
    color: "from-rose-500 to-red-600",
  },
  {
    icon: <FileDown className="h-6 w-6" />,
    title: "Resumen y PDF",
    description:
      "Al finalizar la sesión se generan los eventos (pesadas, tratamientos en Sanidad con su descuento de stock, tactos) y podés exportar un resumen en PDF para el encargado.",
    color: "from-teal-500 to-cyan-600",
  },
]

export function OnboardingTour() {
  const [visible, setVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasSeenTour, setHasSeenTour] = useState(true)

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      setHasSeenTour(false)
      setVisible(true)
    } else {
      setHasSeenTour(true)
    }
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, "true")
    setHasSeenTour(true)
  }, [])

  const resetTour = useCallback(() => {
    setCurrentStep(0)
    setVisible(true)
  }, [])

  const next = () => setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1))
  const prev = () => setCurrentStep((s) => Math.max(s - 1, 0))
  const isLast = currentStep === STEPS.length - 1

  const step = STEPS[currentStep]

  return (
    <>
      {/* Floating tour overlay */}
      {visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <Card className="w-full max-w-lg mx-4 shadow-2xl border-0 overflow-hidden">
            {/* Gradient header */}
            <div className={`bg-gradient-to-r ${step.color} p-6 text-white relative`}>
              <Button
                variant="ghost"
                size="icon"
                onClick={dismiss}
                className="absolute top-3 right-3 text-white/80 hover:text-white hover:bg-card/20 h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-xl bg-card/20 flex items-center justify-center">
                  {step.icon}
                </div>
                <div>
                  <p className="text-xs text-white/70 font-medium uppercase tracking-wider">
                    Paso {currentStep + 1} de {STEPS.length}
                  </p>
                  <h3 className="text-xl font-bold">{step.title}</h3>
                </div>
              </div>

              {/* Progress dots */}
              <div className="flex gap-1.5 mt-2">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentStep(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentStep
                        ? "w-6 bg-card"
                        : i < currentStep
                          ? "w-3 bg-card/60"
                          : "w-3 bg-card/30"
                    }`}
                  />
                ))}
              </div>
            </div>

            <CardContent className="p-6">
              <p className="text-muted-foreground leading-relaxed mb-6">
                {step.description}
              </p>

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prev}
                  disabled={currentStep === 0}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>

                {isLast ? (
                  <Button onClick={dismiss} className="gap-2 bg-gradient-to-r from-emerald-600 to-green-600">
                    <Sparkles className="h-4 w-4" />
                    Empezar a trabajar
                  </Button>
                ) : (
                  <Button onClick={next} className="gap-1">
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Help tooltip button - always visible after tour */}
      {hasSeenTour && !visible && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={resetTour}
                className="h-9 w-9 rounded-full border-2 text-muted-foreground hover:text-primary hover:border-primary/50"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Ver guía de funcionalidades</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </>
  )
}
