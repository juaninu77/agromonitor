import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardHeader, CardContent } from "@/components/ui/card"

export default function TareasLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-8 w-48 mb-4" />
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, col) => (
          <div key={col} className="space-y-3">
            <Skeleton className="h-6 w-32 mb-4" />
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

