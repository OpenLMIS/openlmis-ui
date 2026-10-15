import * as React from "react"
import { cn } from "cn"

function Table({
  className,
  density = "default",
  layout = "auto",
  width = "full",
  scroll = "x",
  ...props
}: React.ComponentProps<"table"> & {
  density?: "default" | "comfortable" | "compact"
  layout?: "auto" | "fixed"
  width?: "full" | "measured"
  scroll?: "x" | "both"
}) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        "relative w-full",
        scroll === "x" ? "overflow-x-auto" : "h-full overflow-auto"
      )}
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom text-sm [&_th:not(:last-child)]:border-e [&_td:not(:last-child)]:border-e",
          width === "measured" && "min-w-(--table-width)",
          density === "comfortable" &&
            "[&_td]:h-12 [&_td]:px-4 [&_td]:py-1.5 [&_th]:h-10 [&_th]:px-4",
          density === "compact" && "[&_td]:px-1.5 [&_th]:px-1.5",
          layout === "fixed" && "table-fixed [&_td]:truncate",
          scroll === "both" &&
            "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card [&_thead]:shadow-[inset_0_-1px_0_var(--color-border)] [&_thead_tr]:bg-muted/50",
          className
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({
  className,
  surface = "default",
  ...props
}: React.ComponentProps<"thead"> & { surface?: "default" | "muted" }) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "[&_tr]:border-b",
        surface === "muted" && "bg-muted/50 [&_tr]:hover:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({
  className,
  surface = "default",
  drag = false,
  ...props
}: React.ComponentProps<"tr"> & { surface?: "default" | "muted" | "primary"; drag?: boolean | "overlay" }) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        drag === true && "relative z-1 border-b-0 bg-card shadow-[inset_0_-1px_0_var(--color-border)] [transform:var(--row-transform)] [transition:var(--row-transition)] hover:bg-[color-mix(in_srgb,var(--muted)_50%,var(--card))] data-[dragging=true]:z-0 data-[dragging=true]:bg-muted data-[dragging=true]:hover:bg-muted [&[data-dragging=true]>td>*]:invisible",
        drag === "overlay" && "cursor-grabbing border-b-0 bg-[color-mix(in_srgb,var(--primary)_8%,var(--background))] shadow-lg hover:bg-[color-mix(in_srgb,var(--primary)_8%,var(--background))]",
        surface === "muted" && "bg-muted/30 font-medium has-aria-expanded:bg-muted/30",
        surface === "primary" && "bg-primary text-primary-foreground font-medium hover:bg-primary has-aria-expanded:bg-primary data-[state=selected]:bg-primary",
        className
      )}
      {...props}
    />
  )
}

function TableHead({
  className,
  width = "default",
  ...props
}: React.ComponentProps<"th"> & { width?: "default" | "icon" }) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-start align-middle font-medium whitespace-nowrap text-foreground",
        width === "icon" && "w-16",
        className
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  tone = "default",
  ...props
}: React.ComponentProps<"td"> & { tone?: "default" | "danger" }) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap",
        tone === "danger" && "bg-destructive/10 text-destructive",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
