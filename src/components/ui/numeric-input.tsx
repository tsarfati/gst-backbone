import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Button } from "./button";
import { Eye, EyeOff } from "lucide-react";

interface NumericInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  masked?: boolean;
  maskChar?: string;
  showMasked?: boolean;
  canToggleMask?: boolean;
  onToggleMask?: (show: boolean) => void;
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ 
    className, 
    value, 
    onChange, 
    masked = false, 
    maskChar = "*", 
    showMasked = false, 
    canToggleMask = false,
    onToggleMask,
    ...props 
  }, ref) => {
    const [internalValue, setInternalValue] = React.useState(value);
    const [isFocused, setIsFocused] = React.useState(false);

    React.useEffect(() => {
      setInternalValue(value);
    }, [value]);

    const maskValue = (val: string) => {
      if (!masked || val.length <= 4 || showMasked || isFocused) return val;
      return maskChar.repeat(val.length - 4) + val.slice(-4);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      // Only allow numeric characters
      const numericValue = inputValue.replace(/\D/g, '');
      setInternalValue(numericValue);
      onChange(numericValue);
    };

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleBlur = () => {
      setIsFocused(false);
    };

    const displayValue = isFocused ? internalValue : maskValue(internalValue);

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(canToggleMask && "pr-10", className)}
        />
        {canToggleMask && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => onToggleMask?.(!showMasked)}
          >
            {showMasked ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        )}
      </div>
    );
  }
);

NumericInput.displayName = "NumericInput";

export { NumericInput };