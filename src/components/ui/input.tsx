import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "plasmo-flex plasmo-h-10 plasmo-w-full plasmo-rounded-md plasmo-border plasmo-border-input plasmo-bg-background plasmo-px-3 plasmo-py-2 plasmo-text-base plasmo-ring-offset-background file:plasmo-border-0 file:plasmo-bg-transparent file:plasmo-text-sm file:plasmo-font-medium file:plasmo-text-foreground placeholder:plasmo-text-muted-foreground focus:plasmo-outline-none focus:plasmo-border-[#ff4500] focus:plasmo-ring-1 focus:plasmo-ring-[#ff4500] disabled:plasmo-cursor-not-allowed disabled:plasmo-opacity-50 md:plasmo-text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
