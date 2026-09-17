import { cn } from "cn"
import { Loader2Icon } from "lucide-react"

function Spinner({
  className,
  tone = "default",
  size = "default",
  ...props
}: React.ComponentProps<"svg"> & {
  tone?: "default" | "muted"
  size?: "default" | "lg"
}) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn(
        "size-4 animate-spin",
        tone === "muted" && "text-muted-foreground",
        size === "lg" && "size-6",
        className
      )}
      {...props}
    />
  )
}

export { Spinner }
