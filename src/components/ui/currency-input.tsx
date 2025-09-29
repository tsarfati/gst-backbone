import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

interface CurrencyInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  value: string | number;
  onChange: (value: string) => void;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    React.useEffect(() => {
      // Format the initial/external value
      const numValue = typeof value === "string" ? parseFloat(value) || 0 : value || 0;
      setDisplayValue(formatWithCommas(numValue.toString()));
    }, [value]);

    const formatWithCommas = (val: string) => {
      // Remove all non-digit and non-decimal characters
      const cleaned = val.replace(/[^\d.]/g, "");
      
      // Split into integer and decimal parts
      const parts = cleaned.split(".");
      const integerPart = parts[0];
      const decimalPart = parts[1];

      // Add commas to integer part
      const withCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

      // Reconstruct with decimal if present
      return decimalPart !== undefined ? `${withCommas}.${decimalPart}` : withCommas;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Remove commas to get raw number
      const rawValue = inputValue.replace(/,/g, "");
      
      // Allow empty, digits, and one decimal point
      if (rawValue === "" || /^\d*\.?\d*$/.test(rawValue)) {
        setDisplayValue(formatWithCommas(rawValue));
        onChange(rawValue);
      }
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        className={cn(className)}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
