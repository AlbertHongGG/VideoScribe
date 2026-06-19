import React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  unit = "",
}) => {
  return (
    <div className="flex flex-col gap-3 w-full group">
      {label && (
        <div className="flex items-center justify-between text-sm">
          <label className="font-medium text-gray-300 group-hover:text-white transition-colors">
            {label}
          </label>
          <span className="font-mono text-[#facc15] font-semibold tracking-wide tabular-nums">
            {value}{unit}
          </span>
        </div>
      )}
      <SliderPrimitive.Root
        className="relative flex w-full touch-none select-none items-center py-2"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => onChange(vals[0])}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/10 group-hover:bg-white/15 transition-colors">
          <SliderPrimitive.Range className="absolute h-full bg-[#facc15]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block h-4 w-4 rounded-full border-2 border-[#facc15] bg-[#141414] ring-offset-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:scale-125 cursor-grab active:cursor-grabbing"
          aria-label={label}
        />
      </SliderPrimitive.Root>
    </div>
  );
};
