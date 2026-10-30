import { cn } from "cn"

function Skeleton({
  className,
  shape = "default",
  fill = false,
  inline = false,
  ...props
}: React.ComponentProps<"div"> & { shape?: "default" | "circle"; fill?: boolean; inline?: boolean }) {
  const Element = inline ? "span" : "div"
  return (
    <Element
      data-slot="skeleton"
      className={cn(
        "block animate-pulse rounded-md bg-muted",
        shape === "circle" && "rounded-full",
        fill && "size-full",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
