import React from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';
export const Input = React.forwardRef(function Input({ className, icon, value, onClear, clearLabel = '清除输入', ...props }, ref) { const canClear = typeof onClear === 'function' && value; return <label className={cn('ui-input', className)}>{icon && <span className="ui-input-icon">{icon}</span>}<input ref={ref} value={value} {...props}/>{canClear && <button type="button" className="ui-input-clear" aria-label={clearLabel} onClick={onClear}><X size={13}/></button>}</label>; });
