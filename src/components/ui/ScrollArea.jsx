import React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from './utils';
export const ScrollArea = React.forwardRef(function ScrollArea({ className, children, type = 'hover', ...props }, ref) { return <ScrollAreaPrimitive.Root ref={ref} className={cn('ui-scrollarea', className)} type={type} {...props}><ScrollAreaPrimitive.Viewport className="ui-scrollarea-viewport">{children}</ScrollAreaPrimitive.Viewport><ScrollAreaPrimitive.Scrollbar className="ui-scrollarea-bar" orientation="vertical"><ScrollAreaPrimitive.Thumb className="ui-scrollarea-thumb" /></ScrollAreaPrimitive.Scrollbar><ScrollAreaPrimitive.Corner /></ScrollAreaPrimitive.Root>; });
