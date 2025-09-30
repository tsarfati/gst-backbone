import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange }) => {
  const [inputValue, setInputValue] = useState(value);

  const normalizeToHsl = (str: string): string => {
    const val = str.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      return hexToHsl(val);
    }
    return val;
  };

  const handleColorChange = (newValue: string) => {
    const normalized = normalizeToHsl(newValue);
    setInputValue(normalized);
    onChange(normalized);
  };

  const hslToHex = (hslString: string): string => {
    try {
      const [h, s, l] = hslString.split(' ').map(val => parseFloat(val.replace('%', '')));
      const c = (1 - Math.abs(2 * (l / 100) - 1)) * (s / 100);
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = (l / 100) - c / 2;
      
      let r, g, b;
      if (h >= 0 && h < 60) [r, g, b] = [c, x, 0];
      else if (h >= 60 && h < 120) [r, g, b] = [x, c, 0];
      else if (h >= 120 && h < 180) [r, g, b] = [0, c, x];
      else if (h >= 180 && h < 240) [r, g, b] = [0, x, c];
      else if (h >= 240 && h < 300) [r, g, b] = [x, 0, c];
      else [r, g, b] = [c, 0, x];
      
      r = Math.round((r + m) * 255);
      g = Math.round((g + m) * 255);
      b = Math.round((b + m) * 255);
      
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    } catch {
      return '#000000';
    }
  };

  const hexToHsl = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
        default: h = 0;
      }
      h /= 6;
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`color-${label}`}>{label}</Label>
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-12 h-10 p-0 border-2"
              style={{ backgroundColor: `hsl(${value})` }}
            />
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-3">
              <div>
                <Label htmlFor="hex-input">Hex Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="hex-input"
                    type="color"
                    value={hslToHex(value)}
                    onChange={(e) => handleColorChange(hexToHsl(e.target.value))}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={hslToHex(value)}
                    onChange={(e) => {
                      if (e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) {
                        handleColorChange(hexToHsl(e.target.value));
                      }
                    }}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="hsl-input">HSL Values</Label>
                <Input
                  id="hsl-input"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onBlur={() => handleColorChange(inputValue)}
                  placeholder="210 100% 45%"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={() => handleColorChange(inputValue)}
          placeholder="210 100% 45%"
          className="flex-1"
        />
      </div>
    </div>
  );
};

export default ColorPicker;