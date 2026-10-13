import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function InputSizer({ placeholder, sizing = "minimum" }: { placeholder: string; sizing?: "full" | "minimum" }) {
  const contentSize = Math.max(5, placeholder.length)
  return <span aria-hidden className={cn("block shrink-0 text-base md:text-sm", sizing === "minimum" ? "w-[max(3.25rem,calc(var(--input-content-size)*1ch+0.9375rem))]" : "w-[max(3.25rem,calc(var(--input-content-size)*1ch+1.4375rem))]")} style={{ "--input-content-size": contentSize } as React.CSSProperties} />
}

function Input({ className, type, controlSize = "default", sizing = "full", style, ...props }: React.ComponentProps<"input"> & { controlSize?: "default" | "sm"; sizing?: "full" | "minimum" | "full-minimum" }) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      style={sizing !== "full" ? { "--input-content-size": Math.max(5, props.placeholder?.length ?? 0), ...style } as React.CSSProperties : style}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        controlSize === "sm" && "h-7",
        sizing === "minimum" && "min-w-[max(3.25rem,calc(var(--input-content-size)*1ch+0.9375rem))] px-1.5",
        sizing === "full-minimum" && "min-w-[max(3.25rem,calc(var(--input-content-size)*1ch+1.4375rem))]",
        className
      )}
      {...props}
    />
  )
}

export { Input, InputSizer }
