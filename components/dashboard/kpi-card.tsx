import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { KpiCardData } from "@/lib/types"
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react"

export function KpiCard({ data }: { data: KpiCardData }) {
  const isIncrease = data.changeType === "increase"
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{data.title}</CardTitle>
        <data.icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{data.value}</div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <span className={cn("flex items-center gap-1", isIncrease ? "text-status-ok" : "text-status-alert")}>
            {isIncrease ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {data.change}
          </span>
          {data.description}
        </p>
      </CardContent>
      <CardFooter>
        <a href="#" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
          View Details <ArrowRight className="h-3 w-3" />
        </a>
      </CardFooter>
    </Card>
  )
}
