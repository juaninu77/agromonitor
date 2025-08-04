import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function GanadoLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header Loading */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      {/* Summary Cards Loading */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-2">
            <CardHeader className="pb-2 border-b-2 border-gray-100">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded" />
                <div>
                  <Skeleton className="h-6 w-12 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Loading */}
      <Card className="border-2">
        <CardContent className="p-6">
          {/* Tabs Loading */}
          <div className="grid w-full grid-cols-3 border-2 border-gray-200 rounded-lg mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-none" />
            ))}
          </div>

          {/* Search and Filters Loading */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Skeleton className="flex-1 h-10" />
            <div className="flex gap-2">
              <Skeleton className="w-48 h-10" />
            </div>
          </div>

          {/* Animal Cards Loading */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border-2">
                <CardHeader className="pb-3 border-b-2 border-gray-100">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-4 w-40" />
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <div className="grid grid-cols-2 gap-4">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <div key={j}>
                          <Skeleton className="h-3 w-16 mb-1" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Skeleton className="flex-1 h-8" />
                      <Skeleton className="flex-1 h-8" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
