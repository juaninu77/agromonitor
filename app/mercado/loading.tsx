import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { BreadcrumbNav } from "@/components/dashboard/breadcrumb-nav"
import { DollarSign } from "lucide-react"

const breadcrumbItems = [
  { label: "Panel Principal", href: "/" },
  { label: "Mercado", href: "/mercado" },
]

function MarketItemSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div className="space-y-1">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <Skeleton className="h-16 w-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-4 w-32" />
      </CardContent>
    </Card>
  )
}

export default function MercadoLoading() {
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
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Overview Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filter Skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-10 w-48" />
      </div>

      {/* Tabs Skeleton */}
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />

        {/* Market Items Grid Skeleton */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <MarketItemSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
