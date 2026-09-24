"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useDirection } from "@/components/ui/direction"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const dir = useDirection()

  return (
    <Sonner
      closeButton
      dir={dir}
      theme={theme as ToasterProps["theme"]}
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
        } as React.CSSProperties
      }
      toastOptions={{
        // A short title over a description of at most two lines, and a plain X at the end edge.
        classNames: {
          toast: "cn-toast pe-10!",
          title: "font-medium",
          description: "line-clamp-2 text-muted-foreground!",
          closeButton:
            "start-auto! end-2! top-2! transform-none! size-6! rounded-md! border-0! bg-transparent! text-muted-foreground! hover:bg-muted! hover:text-foreground!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
