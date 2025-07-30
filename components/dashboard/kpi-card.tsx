import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { KpiCardData } from "@/lib/types"
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react"

export function KpiCard({ data }: { data: KpiCardData }) {
  const isIncrease = data.changeType === "increase"
  const TrendIcon = isIncrease ? TrendingUp : TrendingDown

  return (
    <Card className="group hover:scale-[1.02] transition-all duration-300 border-2 border-border bg-gradient-to-br from-card to-card/50 backdrop-blur-sm hover:border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{data.title}</CardTitle>
        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors border border-primary/20">
          <data.icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="text-3xl font-bold text-foreground mb-2">{data.value}</div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border",
              isIncrease
                ? "bg-status-ok/10 text-status-ok border-status-ok/30"
                : "bg-status-alert/10 text-status-alert border-status-alert/30",
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {data.change}
          </div>
          <span className="text-xs text-muted-foreground">{data.description}</span>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 group/link transition-colors border border-transparent hover:border-border/50 rounded px-2 py-1">
          Ver Detalles
          <ArrowRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
        </button>
      </CardFooter>
    </Card>
  )
}
