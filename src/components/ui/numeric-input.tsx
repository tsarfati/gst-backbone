import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

interface NumericInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  masked?: boolean;
  maskChar?: string;
  showMasked?: boolean;
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ className, value, onChange, masked = false, maskChar = "*", showMasked = false, ...props }, ref) => {
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
        className={cn(className)}
      />
    );
  }
);

NumericInput.displayName = "NumericInput";

export { NumericInput };