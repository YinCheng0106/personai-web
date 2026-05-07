import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        info: "border-info/20 bg-info/10 text-info",
        success: "border-success/20 bg-success/10 text-success",
        warning: "border-warning/30 bg-warning/15 text-warning-foreground",
        danger: "border-destructive/20 bg-destructive/10 text-destructive",
        primary: "border-primary/20 bg-primary/10 text-primary",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
)

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>

function Badge({ className, tone, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone, className }))} {...props} />
  )
}

export { Badge, badgeVariants }
