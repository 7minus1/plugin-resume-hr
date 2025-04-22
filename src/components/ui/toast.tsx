import * as React from "react"
import { cn } from "@/lib/utils"

interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  message: string
  type?: "success" | "error"
  duration?: number
  onClose?: () => void
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, message, type = "success", duration = 1500, onClose, ...props }, ref) => {
    React.useEffect(() => {
      const timer = setTimeout(() => {
        onClose?.()
      }, duration)

      return () => clearTimeout(timer)
    }, [duration, onClose])

    return (
      <div
        ref={ref}
        className={cn(
          "plasmo-fixed plasmo-top-1/2 plasmo-left-1/2 plasmo-transform plasmo--translate-x-1/2 plasmo--translate-y-1/2 plasmo-z-50 plasmo-px-6 plasmo-py-3 plasmo-rounded-lg plasmo-shadow-lg plasmo-transition-all plasmo-duration-300 plasmo-ease-in-out plasmo-min-w-[200px] plasmo-text-center",
          type === "success" ? "plasmo-bg-[#ff4500] plasmo-text-white" : "plasmo-bg-red-500 plasmo-text-white",
          className
        )}
        {...props}
      >
        {message}
      </div>
    )
  }
)
Toast.displayName = "Toast"

export { Toast } 