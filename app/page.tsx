import { KpiCard } from "@/components/dashboard/kpi-card"
import { kpiData } from "@/lib/mocks"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertList } from "@/components/dashboard/alert-list"
import { SparklineChart } from "@/components/dashboard/sparkline-chart"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold md:text-3xl">Dashboard</h1>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <KpiCard key={kpi.title} data={kpi} />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Cash Flow (7-day)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <SparklineChart />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Critical Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertList isMenu={false} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
