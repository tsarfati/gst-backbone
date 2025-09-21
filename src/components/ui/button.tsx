import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "ripple relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-elevation-sm hover:bg-[hsl(var(--button-hover))] hover:shadow-elevation-md active:shadow-elevation-sm transform hover:-translate-y-0.5 active:translate-y-0",
        destructive: "bg-destructive text-destructive-foreground shadow-elevation-sm hover:bg-destructive/90 hover:shadow-elevation-md active:shadow-elevation-sm transform hover:-translate-y-0.5 active:translate-y-0",
        outline: "border border-input bg-background shadow-elevation-xs hover:bg-[hsl(var(--button-hover)/0.1)] hover:text-accent-foreground hover:shadow-elevation-sm transform hover:-translate-y-0.5 active:translate-y-0",
        secondary: "bg-secondary text-secondary-foreground shadow-elevation-xs hover:bg-[hsl(var(--button-hover)/0.1)] hover:shadow-elevation-sm transform hover:-translate-y-0.5 active:translate-y-0",
        ghost: "hover:bg-[hsl(var(--button-hover)/0.1)] hover:text-accent-foreground transform hover:-translate-y-0.5 active:translate-y-0",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-success-foreground shadow-elevation-sm hover:bg-success/90 hover:shadow-elevation-md active:shadow-elevation-sm transform hover:-translate-y-0.5 active:translate-y-0",
        warning: "bg-warning text-warning-foreground shadow-elevation-sm hover:bg-warning/90 hover:shadow-elevation-md active:shadow-elevation-sm transform hover:-translate-y-0.5 active:translate-y-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
