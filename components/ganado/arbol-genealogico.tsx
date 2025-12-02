"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// ============================================
// TIPOS
// ============================================

interface AnimalGenealogico {
  id: string
  numero: string
  cuig?: string | null
  categoria: string
  raza?: string | null
  fechaNacimiento?: Date | null
  estado: string
  // Padre
  padre?: AnimalGenealogico | null
  padreExterno?: string | null
  // Madre  
  madre?: AnimalGenealogico | null
  madreExterna?: string | null
}

interface ArbolGenealogicoProps {
  animal: AnimalGenealogico
  className?: string
}

// ============================================
// COMPONENTE TARJETA DE ANIMAL
// ============================================

function TarjetaAnimal({ 
  animal, 
  rol,
  className 
}: { 
  animal: AnimalGenealogico | null | undefined
  textoExterno?: string | null
  rol: "principal" | "padre" | "madre" | "abuelo"
  className?: string
}) {
  if (!animal) return null

  const colores = {
    principal: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
    padre: "border-blue-400 bg-blue-50 dark:bg-blue-950/30",
    madre: "border-pink-400 bg-pink-50 dark:bg-pink-950/30",
    abuelo: "border-gray-300 bg-gray-50 dark:bg-gray-800/50",
  }

  const iconos = {
    principal: "🐄",
    padre: "🐂",
    madre: "🐄",
    abuelo: "👴",
  }

  return (
    <div className={cn(
      "p-3 rounded-lg border-2 text-center min-w-[140px]",
      colores[rol],
      className
    )}>
      <div className="text-2xl mb-1">{iconos[rol]}</div>
      <div className="font-bold text-sm">#{animal.numero}</div>
      {animal.cuig && (
        <div className="text-xs text-muted-foreground truncate" title={animal.cuig}>
          CUIG: {animal.cuig.slice(-8)}
        </div>
      )}
      <Badge variant="outline" className="mt-1 text-xs">
        {animal.categoria}
      </Badge>
      {animal.raza && (
        <div className="text-xs text-muted-foreground mt-1">{animal.raza}</div>
      )}
    </div>
  )
}

// ============================================
// COMPONENTE PLACEHOLDER PARA PADRE/MADRE EXTERNOS
// ============================================

function PlaceholderExterno({ 
  texto, 
  tipo 
}: { 
  texto: string | null | undefined
  tipo: "padre" | "madre" 
}) {
  if (!texto) return null

  return (
    <div className={cn(
      "p-3 rounded-lg border-2 border-dashed text-center min-w-[140px]",
      tipo === "padre" ? "border-blue-300 bg-blue-50/50" : "border-pink-300 bg-pink-50/50"
    )}>
      <div className="text-2xl mb-1 opacity-50">
        {tipo === "padre" ? "🐂" : "🐄"}
      </div>
      <div className="text-xs text-muted-foreground italic">
        {texto}
      </div>
      <Badge variant="secondary" className="mt-1 text-xs">
        Externo
      </Badge>
    </div>
  )
}

// ============================================
// COMPONENTE CONECTOR (líneas del árbol)
// ============================================

function Conector({ tipo }: { tipo: "vertical" | "horizontal" | "t" }) {
  if (tipo === "vertical") {
    return <div className="w-0.5 h-6 bg-gray-300 mx-auto" />
  }
  if (tipo === "horizontal") {
    return <div className="h-0.5 w-8 bg-gray-300 my-auto" />
  }
  // T connector
  return (
    <div className="flex items-center justify-center">
      <div className="h-0.5 w-full bg-gray-300" />
    </div>
  )
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function ArbolGenealogico({ animal, className }: ArbolGenealogicoProps) {
  const tienePadre = animal.padre || animal.padreExterno
  const tieneMadre = animal.madre || animal.madreExterna
  const tieneAbuelos = animal.padre?.padre || animal.padre?.madre || 
                       animal.madre?.padre || animal.madre?.madre

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          🌳 Árbol Genealógico
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-2">
          
          {/* NIVEL 3: Abuelos (si existen) */}
          {tieneAbuelos && (
            <>
              <div className="flex gap-8 justify-center flex-wrap">
                {/* Abuelos paternos */}
                <div className="flex gap-2">
                  {animal.padre?.padre && (
                    <TarjetaAnimal animal={animal.padre.padre} rol="abuelo" />
                  )}
                  {animal.padre?.madre && (
                    <TarjetaAnimal animal={animal.padre.madre} rol="abuelo" />
                  )}
                </div>
                
                {/* Abuelos maternos */}
                <div className="flex gap-2">
                  {animal.madre?.padre && (
                    <TarjetaAnimal animal={animal.madre.padre} rol="abuelo" />
                  )}
                  {animal.madre?.madre && (
                    <TarjetaAnimal animal={animal.madre.madre} rol="abuelo" />
                  )}
                </div>
              </div>
              <Conector tipo="vertical" />
            </>
          )}

          {/* NIVEL 2: Padres */}
          {(tienePadre || tieneMadre) && (
            <>
              <div className="flex gap-8 items-end justify-center flex-wrap">
                {/* Padre */}
                <div className="flex flex-col items-center">
                  {animal.padre ? (
                    <TarjetaAnimal animal={animal.padre} rol="padre" />
                  ) : animal.padreExterno ? (
                    <PlaceholderExterno texto={animal.padreExterno} tipo="padre" />
                  ) : (
                    <div className="p-3 rounded-lg border-2 border-dashed border-gray-200 text-center min-w-[140px]">
                      <div className="text-2xl mb-1 opacity-30">❓</div>
                      <div className="text-xs text-muted-foreground">
                        Padre desconocido
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-blue-600 font-medium mt-1">PADRE</div>
                </div>

                {/* Madre */}
                <div className="flex flex-col items-center">
                  {animal.madre ? (
                    <TarjetaAnimal animal={animal.madre} rol="madre" />
                  ) : animal.madreExterna ? (
                    <PlaceholderExterno texto={animal.madreExterna} tipo="madre" />
                  ) : (
                    <div className="p-3 rounded-lg border-2 border-dashed border-gray-200 text-center min-w-[140px]">
                      <div className="text-2xl mb-1 opacity-30">❓</div>
                      <div className="text-xs text-muted-foreground">
                        Madre desconocida
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-pink-600 font-medium mt-1">MADRE</div>
                </div>
              </div>
              
              {/* Línea conectora */}
              <div className="flex items-center justify-center w-full max-w-xs">
                <div className="flex-1 h-0.5 bg-gray-300" />
                <div className="w-0.5 h-6 bg-gray-300" />
                <div className="flex-1 h-0.5 bg-gray-300" />
              </div>
            </>
          )}

          {/* NIVEL 1: Animal principal */}
          <div className="flex flex-col items-center">
            <TarjetaAnimal animal={animal} rol="principal" />
            <div className="text-xs text-emerald-600 font-bold mt-1">
              ANIMAL SELECCIONADO
            </div>
          </div>

          {/* Información adicional */}
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg w-full max-w-md">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Número:</span>{" "}
                <span className="font-medium">#{animal.numero}</span>
              </div>
              {animal.cuig && (
                <div>
                  <span className="text-muted-foreground">CUIG:</span>{" "}
                  <span className="font-mono text-xs">{animal.cuig}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Categoría:</span>{" "}
                <span className="font-medium capitalize">{animal.categoria}</span>
              </div>
              {animal.raza && (
                <div>
                  <span className="text-muted-foreground">Raza:</span>{" "}
                  <span className="font-medium">{animal.raza}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// COMPONENTE COMPACTO (para listas)
// ============================================

export function ArbolGenealogicoCompacto({ animal }: { animal: AnimalGenealogico }) {
  const padreTexto = animal.padre?.numero 
    ? `#${animal.padre.numero}` 
    : animal.padreExterno || "—"
  
  const madreTexto = animal.madre?.numero 
    ? `#${animal.madre.numero}` 
    : animal.madreExterna || "—"

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        <span className="text-blue-500">🐂</span>
        <span className="text-muted-foreground">Padre:</span>
        <span className="font-medium">{padreTexto}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-pink-500">🐄</span>
        <span className="text-muted-foreground">Madre:</span>
        <span className="font-medium">{madreTexto}</span>
      </div>
    </div>
  )
}

