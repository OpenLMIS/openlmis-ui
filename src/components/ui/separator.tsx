import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"
import { cn } from "cn"

function Separator({
  className,
  orientation = "horizontal",
  spacing = "default",
  ...props
}: SeparatorPrimitive.Props & { spacing?: "default" | "toolbar" }) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        spacing === "toolbar" && "mx-2 h-4 data-vertical:self-center md:mx-4",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
