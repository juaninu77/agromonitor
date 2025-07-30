"use client"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const chartData = [
  { day: "Monday", cash: 186, fill: "hsl(var(--chart-1))" },
  { day: "Tuesday", cash: 305, fill: "hsl(var(--chart-1))" },
  { day: "Wednesday", cash: 237, fill: "hsl(var(--chart-1))" },
  { day: "Thursday", cash: 73, fill: "hsl(var(--chart-1))" },
  { day: "Friday", cash: 209, fill: "hsl(var(--chart-1))" },
  { day: "Saturday", cash: 214, fill: "hsl(var(--chart-1))" },
  { day: "Sunday", cash: 350, fill: "hsl(var(--chart-2))" },
]

const chartConfig = {
  cash: {
    label: "Cash Flow",
    color: "hsl(var(--chart-1))",
  },
}

export function SparklineChart() {
  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <BarChart
        accessibilityLayer
        data={chartData}
        margin={{
          top: 5,
          right: 10,
          left: 10,
          bottom: 0,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => value.slice(0, 3)}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
        <Bar dataKey="cash" radius={8} />
      </BarChart>
    </ChartContainer>
  )
}
