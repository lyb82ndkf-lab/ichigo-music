import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from './utils';
export const TooltipProvider = TooltipPrimitive.Provider;
export function Tooltip({ children, content, sideOffset = 7, ...props }) { return <TooltipPrimitive.Root delayDuration={350} {...props}><TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger><TooltipPrimitive.Portal><TooltipPrimitive.Content className="ui-tooltip" sideOffset={sideOffset}>{content}<TooltipPrimitive.Arrow fill="var(--overlay-bg)" /></TooltipPrimitive.Content></TooltipPrimitive.Portal></TooltipPrimitive.Root>; }
