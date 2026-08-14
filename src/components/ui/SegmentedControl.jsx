import React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cn } from './utils';
export const SegmentedControl = React.forwardRef(function SegmentedControl({ className, size = 'md', type = 'single', ...props }, ref) { return <ToggleGroupPrimitive.Root ref={ref} type={type} className={cn('ui-segment', `ui-segment--${size}`, className)} {...props} />; });
export const SegmentedControlItem = React.forwardRef(function SegmentedControlItem({ className, ...props }, ref) { return <ToggleGroupPrimitive.Item ref={ref} className={cn('ui-segment-item', className)} {...props} />; });
