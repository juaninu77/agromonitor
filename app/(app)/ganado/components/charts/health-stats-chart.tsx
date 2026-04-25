"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import { Stethoscope } from "lucide-react"

interface HealthStatsChartProps {
  data: Array<{
    status: string
    count: number
  }>
}

const STATUS_COLORS: Record<string, string> = {
  'Saludable': '#059669',
  'Atención': '#d97706',
  'Tratamiento': '#ea580c',
  'Crítico': '#dc2626'
}

export function HealthStatsChart({ data }: HealthStatsChartProps) {
  const total = data.reduce((acc, item) => acc + item.count, 0)

  return (
    <Card className="border-2 border-gray-200">
      <CardHeader className="border-b-2 border-gray-100">
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-purple-600" />
          Estado de Salud del Rodeo
        </CardTitle>
        <CardDescription>
          Distribución de animales según estado de salud - Total: {total} animales
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="status" type="category" width={100} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  const percentage = ((data.count / total) * 100).toFixed(1)
                  return (
                    <div className="bg-white p-3 border-2 border-gray-200 rounded-lg shadow-lg">
                      <p className="font-semibold">{data.status}</p>
                      <p className="text-sm text-gray-600">
                        Cantidad: <span className="font-medium">{data.count} animales</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Porcentaje: <span className="font-medium">{percentage}%</span>
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend />
            <Bar dataKey="count" name="Cantidad de Animales">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Alertas y resumen */}
        <div className="mt-6 space-y-3">
          {data.map((item) => {
            const percentage = ((item.count / total) * 100).toFixed(1)
            const color = STATUS_COLORS[item.status] || '#6366f1'

            return (
              <div key={item.status} className="flex items-center justify-between p-3 rounded bg-gray-50">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-medium">{item.status}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">{item.count} animales</span>
                  <span className="text-sm font-medium" style={{ color }}>
                    {percentage}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Recomendaciones */}
        {data.some(item => item.status !== 'Saludable' && item.count > 0) && (
          <div className="mt-6 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-800 mb-2">
              ⚠️ Atención Requerida
            </p>
            <p className="text-sm text-amber-700">
              Hay {data.filter(i => i.status !== 'Saludable').reduce((acc, i) => acc + i.count, 0)} animales que requieren atención veterinaria.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
