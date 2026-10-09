import * as React from "react"
import { cn } from "cn"

function Textarea({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"textarea"> & { size?: "default" | "inline" }) {
  return (
    <textarea
      data-slot="textarea"
      data-size={size}
      className={cn(
        "flex resize-none field-sizing-content w-full rounded-lg border border-input bg-transparent px-2.5 transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        size === "inline" ? "min-h-8 py-1.5 text-sm leading-[18px]" : "min-h-16 py-2 text-base md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
