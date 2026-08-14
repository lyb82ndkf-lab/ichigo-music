import React from 'react';
import { cn } from './utils';
export function Skeleton({ className, style, ...props }) { return <div aria-hidden="true" className={cn('ui-skeleton', className)} style={{ borderRadius: 'var(--radius-sm)', ...style }} {...props} />; }
