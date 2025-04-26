import React, { useEffect } from 'react'
import { cn } from "@/lib/utils"

interface ToastProps {
  message: string
  type: 'success' | 'error'
  onClose: () => void
  duration?: number
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: type === 'success' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '4px',
        zIndex: 10001,
        fontSize: '14px',
        transition: 'opacity 0.3s ease',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
      }}>
      {message}
    </div>
  )
}

Toast.displayName = "Toast"

export { Toast } 