import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

export function PageHeading({ title, description, icon: Icon, context, actions }: { title:string; description:string; icon?:LucideIcon; context?:string; actions?:ReactNode }) {
  return <header className="flex flex-wrap items-start justify-between gap-4">
    <div className="flex min-w-0 gap-3">
      {Icon && <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>}
      <div>{context && <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{context}</p>}<h1 className="erp-title">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>
    </div>{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
}
