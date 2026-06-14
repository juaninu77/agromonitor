"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { BarChart3 } from "lucide-react"

interface CategoryDistributionChartProps {
  data: Array<{
    name: string
    value: number
  }>
}

const COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#ec4899', '#6366f1']

export function CategoryDistributionChart({ data }: CategoryDistributionChartProps) {
  const total = data.reduce((acc, item) => acc + item.value, 0)

  return (
    <Card className="border-2 border-gray-200">
      <CardHeader className="border-b-2 border-gray-100">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          Distribución por Categoría
        </CardTitle>
        <CardDescription>
          Composición del rodeo por categorías - Total: {total} animales
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>

        {/* Lista detallada */}
        <div className="mt-6 space-y-2">
          {data.map((category, index) => (
            <div key={category.name} className="flex items-center justify-between p-2 rounded bg-gray-50">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm font-medium">{category.name}</span>
              </div>
              <div className="text-sm text-gray-600">
                {category.value} ({((category.value / total) * 100).toFixed(1)}%)
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
