import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from './utils';

export const Slider = React.forwardRef(function Slider({ className, orientation = 'horizontal', value, defaultValue, onValueChange, min = 0, max = 100, step = 1, disabled, 'aria-label': ariaLabel, ...props }, ref) {
  const values = value ?? defaultValue ?? [min];
  return <SliderPrimitive.Root ref={ref} className={cn('ui-slider', `ui-slider--${orientation}`, className)} orientation={orientation} value={value} defaultValue={defaultValue} onValueChange={onValueChange} min={min} max={max} step={step} disabled={disabled} aria-label={ariaLabel} {...props}><SliderPrimitive.Track className="ui-slider-track"><SliderPrimitive.Range className="ui-slider-range" /></SliderPrimitive.Track>{values.map((_, index) => <SliderPrimitive.Thumb key={index} className="ui-slider-thumb" />)}</SliderPrimitive.Root>;
});
