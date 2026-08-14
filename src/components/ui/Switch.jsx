import React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from './utils';
export const Switch = React.forwardRef(function Switch({ className, ...props }, ref) { return <SwitchPrimitive.Root ref={ref} className={cn('ui-switch', className)} {...props}><SwitchPrimitive.Thumb className="ui-switch-thumb" /></SwitchPrimitive.Root>; });
