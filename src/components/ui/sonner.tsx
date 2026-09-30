"use client"

import { useResolvedAppearance } from "@/lib/appearance"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useDirection } from "@/components/ui/direction"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Just below the app header, whose height is `--app-header-height` in globals.css.
const belowHeader = (gap: string) => ({ top: `calc(${gap} + var(--app-header-height, 0px))` })

// Sonner's rich colours, drawn from the theme's status tokens so they follow light and dark.
const tinted = (token: string, text: string) => ({
  bg: `color-mix(in oklab, var(${token}) 10%, var(--popover))`,
  border: `color-mix(in oklab, var(${token}) 35%, var(--popover))`,
  text: `var(${text})`,
})
const success = tinted("--success", "--success-strong")
const error = tinted("--destructive", "--destructive")
const warning = tinted("--warning", "--warning-strong")
const info = tinted("--info", "--info")

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const theme = useResolvedAppearance()
  const dir = useDirection()

  return (
    <Sonner
      closeButton
      dir={dir}
      position={dir === "rtl" ? "top-left" : "top-right"}
      offset={belowHeader("16px")}
      mobileOffset={belowHeader("12px")}
      richColors
      theme={theme}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--success-bg": success.bg,
          "--success-border": success.border,
          "--success-text": success.text,
          "--error-bg": error.bg,
          "--error-border": error.border,
          "--error-text": error.text,
          "--warning-bg": warning.bg,
          "--warning-border": warning.border,
          "--warning-text": warning.text,
          "--info-bg": info.bg,
          "--info-border": info.border,
          "--info-text": info.text,
        } as React.CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        // A short title over a description of at most two lines, and a plain X at the end edge.
        classNames: {
          toast:
            "cn-toast pe-10! items-start! shadow-none! focus-visible:ring-3 focus-visible:ring-ring/50",
          icon: "mt-0.5!",
          title: "font-medium",
          description: "line-clamp-2 text-muted-foreground!",
          closeButton:
            "start-auto! end-2! top-2! transform-none! size-6! rounded-md! border-0! bg-transparent! text-muted-foreground! hover:bg-muted! hover:text-foreground!",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
