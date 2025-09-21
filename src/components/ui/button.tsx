import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "md-button-filled",
        destructive: "md-ripple md-state-layer bg-error text-error-foreground font-medium px-6 py-3 rounded-full md-elevation-1 hover:md-elevation-2 transition-all duration-200",
        outline: "md-button-outlined",
        secondary: "md-ripple md-state-layer bg-secondary text-secondary-foreground font-medium px-6 py-3 rounded-full md-elevation-1 hover:md-elevation-2 transition-all duration-200",
        ghost: "md-button-text",
        link: "text-primary underline-offset-4 hover:underline font-medium px-4 py-2 transition-all duration-200",
        fab: "md-fab",
        icon: "md-ripple md-state-layer rounded-full p-3 hover:bg-muted transition-all duration-200",
        success: "md-ripple md-state-layer bg-success text-success-foreground font-medium px-6 py-3 rounded-full md-elevation-1 hover:md-elevation-2 transition-all duration-200",
        warning: "md-ripple md-state-layer bg-warning text-warning-foreground font-medium px-6 py-3 rounded-full md-elevation-1 hover:md-elevation-2 transition-all duration-200",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 px-4 py-2 text-xs",
        lg: "h-14 px-8 py-4 text-base",
        icon: "h-12 w-12",
        fab: "h-14 w-14",
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
  ({ className, variant, size, asChild = false, children, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Create ripple effect for Material Design buttons
      if (variant === "default" || variant === "outline" || variant === "ghost" || variant === "fab" || variant === "icon") {
        const button = e.currentTarget
        const rect = button.getBoundingClientRect()
        const size = Math.max(rect.width, rect.height)
        const x = e.clientX - rect.left - size / 2
        const y = e.clientY - rect.top - size / 2
        
        const ripple = document.createElement("span")
        ripple.style.cssText = `
          position: absolute;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.3;
          pointer-events: none;
          left: ${x}px;
          top: ${y}px;
          width: ${size}px;
          height: ${size}px;
          animation: ripple 0.6s linear;
        `
        
        button.appendChild(ripple)
        setTimeout(() => ripple.remove(), 600)
      }
      
      onClick?.(e)
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        {...props}
      >
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
