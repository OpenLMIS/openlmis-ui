import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cn } from "cn"

function RadioGroup({
  className,
  columns,
  variant = "default",
  ...props
}: RadioGroupPrimitive.Props & {
  columns?: "tiles" | "row"
  variant?: "default" | "segmented"
}) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn(
        variant === "segmented"
          ? "flex h-8 w-full gap-0.5 rounded-lg border border-input bg-background p-0.5"
          : "grid w-full gap-2",
        columns === "tiles" && "grid-cols-3 @md/main:grid-cols-4 @2xl/main:grid-cols-6",
        columns === "row" && "@md/main:auto-cols-fr @md/main:grid-flow-col",
        className
      )}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  variant = "default",
  children,
  ...props
}: RadioPrimitive.Root.Props & { variant?: "default" | "segmented" }) {
  if (variant === "segmented") {
    return (
      <RadioPrimitive.Root
        data-slot="radio-group-item"
        className={cn(
          "flex flex-1 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-secondary data-checked:text-secondary-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:hover:text-muted-foreground",
          className
        )}
        {...props}
      >
        {children}
      </RadioPrimitive.Root>
    )
  }
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-input outline-none group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary dark:data-checked:bg-primary",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex size-4 items-center justify-center"
      >
        <span className="absolute top-1/2 start-1/2 size-2 -translate-x-1/2 rtl:translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
