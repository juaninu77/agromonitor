import { cn } from "@/lib/utils"
export function StatusPill({ children, tone="neutral" }: { children:React.ReactNode; tone?:"neutral"|"success"|"warning"|"danger" }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",{
    "border-border bg-muted text-muted-foreground":tone==="neutral",
    "border-status-ok/20 bg-status-ok/10 text-status-ok":tone==="success",
    "border-status-warn/20 bg-status-warn/10 text-status-warn":tone==="warning",
    "border-destructive/20 bg-destructive/10 text-destructive":tone==="danger",
  })}>{children}</span>
}
