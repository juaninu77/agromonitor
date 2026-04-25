"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Weight } from "lucide-react"

interface WeightByCategoryChartProps {
  data: Array<{
    category: string
    avgWeight: number
    count: number
  }>
}

export function WeightByCategoryChart({ data }: WeightByCategoryChartProps) {
  return (
    <Card className="border-2 border-gray-200">
      <CardHeader className="border-b-2 border-gray-100">
        <CardTitle className="flex items-center gap-2">
          <Weight className="h-5 w-5 text-blue-600" />
          Peso Promedio por Categoría
        </CardTitle>
        <CardDescription>
          Análisis de peso promedio según categoría
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis label={{ value: 'Peso (kg)', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-white p-3 border-2 border-gray-200 rounded-lg shadow-lg">
                      <p className="font-semibold">{data.category}</p>
                      <p className="text-sm text-gray-600">
                        Peso promedio: <span className="font-medium text-blue-600">{data.avgWeight} kg</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Cantidad: <span className="font-medium">{data.count} animales</span>
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend />
            <Bar dataKey="avgWeight" fill="#2563eb" name="Peso Promedio (kg)" />
          </BarChart>
        </ResponsiveContainer>

        {/* Tabla resumen */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Categoría</th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">Cantidad</th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">Peso Promedio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((item) => (
                <tr key={item.category} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{item.category}</td>
                  <td className="px-4 py-2 text-right">{item.count}</td>
                  <td className="px-4 py-2 text-right font-medium text-blue-600">
                    {item.avgWeight} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
