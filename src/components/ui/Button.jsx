import React from 'react';
import { cn } from './utils';

export const Button = React.forwardRef(function Button({
  className,
  variant = 'primary',
  size = 'md',
  block = false,
  type = 'button',
  children,
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, block && 'ui-btn--block', className)}
      {...props}
    >
      {children}
    </button>
  );
});

export const IconButton = React.forwardRef(function IconButton({
  className,
  variant = 'ghost',
  size = 'md',
  type = 'button',
  label,
  children,
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label || props['aria-label']}
      className={cn('ui-icon-btn', `ui-icon-btn--${variant}`, `ui-icon-btn--${size}`, className)}
      {...props}
    >
      {children}
    </button>
  );
});
