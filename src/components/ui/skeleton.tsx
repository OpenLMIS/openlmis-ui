import { cn } from "cn"

function Skeleton({
  className,
  shape = "default",
  fill = false,
  ...props
}: React.ComponentProps<"div"> & { shape?: "default" | "circle"; fill?: boolean }) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-md bg-muted",
        shape === "circle" && "rounded-full",
        fill && "size-full",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
