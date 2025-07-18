import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "~/lib/utils"

const buttonVariants = cva(
  "plasmo-inline-flex plasmo-items-center plasmo-justify-center plasmo-gap-2 plasmo-whitespace-nowrap plasmo-rounded-md plasmo-text-sm plasmo-font-medium plasmo-ring-offset-background plasmo-transition-colors focus-visible:plasmo-outline-none focus-visible:plasmo-ring-2 focus-visible:plasmo-ring-ring focus-visible:plasmo-ring-offset-2 disabled:plasmo-pointer-events-none disabled:plasmo-opacity-50 [&_svg]:plasmo-pointer-events-none [&_svg]:plasmo-size-4 [&_svg]:plasmo-shrink-0",
  {
    variants: {
      variant: {
        default: "plasmo-bg-primary plasmo-text-primary-foreground hover:plasmo-bg-primary/90",
        destructive:
          "plasmo-bg-destructive plasmo-text-destructive-foreground hover:plasmo-bg-destructive/90",
        outline:
          "plasmo-border plasmo-border-input plasmo-bg-background hover:plasmo-bg-accent hover:plasmo-text-accent-foreground",
        secondary:
          "plasmo-bg-secondary plasmo-text-secondary-foreground hover:plasmo-bg-secondary/80",
        ghost: "hover:plasmo-bg-accent hover:plasmo-text-accent-foreground",
        link: "plasmo-text-primary plasmo-underline-offset-4 hover:plasmo-underline",
      },
      size: {
        default: "plasmo-h-10 plasmo-px-4 plasmo-py-2",
        sm: "plasmo-h-9 plasmo-rounded-md plasmo-px-3",
        lg: "plasmo-h-11 plasmo-rounded-md plasmo-px-8",
        icon: "plasmo-h-10 plasmo-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
