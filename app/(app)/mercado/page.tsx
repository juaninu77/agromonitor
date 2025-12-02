"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BreadcrumbNav } from "@/components/dashboard/breadcrumb-nav"
import {
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  RefreshCw,
  DollarSign,
  BarChart3,
  Clock,
  MapPin,
  Package,
  Truck,
  Wheat,
  Bot,
} from "lucide-react"
import { marketData } from "@/lib/mocks"
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts"
import { ChartContainer } from "@/components/ui/chart"

const breadcrumbItems = [
  { label: "Panel Principal", href: "/" },
  { label: "Mercado", href: "/mercado" },
]

interface MarketItem {
  id: string
  name: string
  category: string
  currentPrice: number
  previousPrice: number
  change: number
  changeType: "increase" | "decrease"
  unit: string
  supplier?: string
  market?: string
  trend: number[]
  volume: number
  lastUpdate: string
}

function MarketItemCard({ item }: { item: MarketItem }) {
  const chartData = item.trend.map((value, index) => ({
    time: index,
    price: value,
  }))

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">{item.name}</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">{item.category}</CardDescription>
          </div>
          <Badge variant={item.changeType === "increase" ? "default" : "destructive"} className="ml-2">
            {item.changeType === "increase" ? (
              <TrendingUp className="w-3 h-3 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-1" />
            )}
            {item.change > 0 ? "+" : ""}
            {item.change.toFixed(2)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">${item.currentPrice.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">{item.unit}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Anterior</div>
            <div className="text-sm font-medium">${item.previousPrice.toLocaleString()}</div>
          </div>
        </div>

        <div className="h-16">
          <ChartContainer
            config={{
              price: {
                label: "Precio",
                color: "hsl(var(--chart-1))",
              },
            }}
            className="h-full w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line type="monotone" dataKey="price" stroke="var(--color-price)" strokeWidth={2} dot={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-md">
                          <p className="text-sm font-medium">${payload[0].value?.toLocaleString()}</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            <span>Vol: {item.volume.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{item.lastUpdate}</span>
          </div>
        </div>

        {(item.supplier || item.market) && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{item.supplier || item.market}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MarketOverview() {
  const totalItems = Object.values(marketData).flat().length
  const increasingItems = Object.values(marketData)
    .flat()
    .filter((item) => item.changeType === "increase").length
  const decreasingItems = Object.values(marketData)
    .flat()
    .filter((item) => item.changeType === "decrease").length
  const avgChange =
    Object.values(marketData)
      .flat()
      .reduce((acc, item) => acc + item.change, 0) / totalItems

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalItems}</div>
          <p className="text-xs text-muted-foreground">productos en mercado</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">En Alza</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{increasingItems}</div>
          <p className="text-xs text-muted-foreground">productos subiendo</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">En Baja</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{decreasingItems}</div>
          <p className="text-xs text-muted-foreground">productos bajando</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cambio Promedio</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${avgChange >= 0 ? "text-green-600" : "text-red-600"}`}>
            {avgChange >= 0 ? "+" : ""}
            {avgChange.toFixed(2)}%
          </div>
          <p className="text-xs text-muted-foreground">variación general</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function MercadoPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("name")

  const filterAndSortItems = (items: MarketItem[]) => {
    return items
      .filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.category.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .sort((a, b) => {
        switch (sortBy) {
          case "price":
            return b.currentPrice - a.currentPrice
          case "change":
            return Math.abs(b.change) - Math.abs(a.change)
          case "name":
          default:
            return a.name.localeCompare(b.name)
        }
      })
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <BreadcrumbNav items={breadcrumbItems} />
          <div className="flex items-center gap-2 mt-2">
            <DollarSign className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Mercado Agropecuario</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Precios en tiempo real de insumos, productos, maquinaria y ganado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      <MarketOverview />

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Nombre</SelectItem>
            <SelectItem value="price">Precio</SelectItem>
            <SelectItem value="change">Variación</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="insumos" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="insumos" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Insumos
          </TabsTrigger>
          <TabsTrigger value="productos" className="flex items-center gap-2">
            <Wheat className="h-4 w-4" />
            Productos
          </TabsTrigger>
          <TabsTrigger value="ganado" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Ganado
          </TabsTrigger>
          <TabsTrigger value="maquinaria" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Maquinaria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insumos" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filterAndSortItems(marketData.insumos).map((item) => (
              <MarketItemCard key={item.id} item={item} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="productos" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filterAndSortItems(marketData.productos).map((item) => (
              <MarketItemCard key={item.id} item={item} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ganado" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filterAndSortItems(marketData.ganado).map((item) => (
              <MarketItemCard key={item.id} item={item} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="maquinaria" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filterAndSortItems(marketData.maquinaria).map((item) => (
              <MarketItemCard key={item.id} item={item} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

