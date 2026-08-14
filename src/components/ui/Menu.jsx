import React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { Check } from 'lucide-react';
import { cn } from './utils';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuLabel = ({ className, ...props }) => <DropdownMenuPrimitive.Label className={cn('ui-menu-label', className)} {...props} />;
export const DropdownMenuSeparator = ({ className, ...props }) => <DropdownMenuPrimitive.Separator className={cn('ui-menu-sep', className)} {...props} />;
export const DropdownMenuContent = React.forwardRef(function DropdownMenuContent({ className, sideOffset = 8, ...props }, ref) {
  return <DropdownMenuPrimitive.Portal><DropdownMenuPrimitive.Content ref={ref} sideOffset={sideOffset} className={cn('ui-menu', className)} {...props} /></DropdownMenuPrimitive.Portal>;
});
export const DropdownMenuItem = React.forwardRef(function DropdownMenuItem({ className, children, inset, ...props }, ref) {
  return <DropdownMenuPrimitive.Item ref={ref} className={cn('ui-menu-item', inset && 'ui-menu-item--inset', className)} {...props}>{children}</DropdownMenuPrimitive.Item>;
});
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;
export const DropdownMenuRadioItem = React.forwardRef(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return <DropdownMenuPrimitive.RadioItem ref={ref} className={cn('ui-menu-item', className)} {...props}><span className="ui-menu-check"><DropdownMenuPrimitive.ItemIndicator><Check size={14} /></DropdownMenuPrimitive.ItemIndicator></span><span className="ui-menu-item-text">{children}</span></DropdownMenuPrimitive.RadioItem>;
});

export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuContent = React.forwardRef(function ContextMenuContent({ className, ...props }, ref) {
  return <ContextMenuPrimitive.Portal><ContextMenuPrimitive.Content ref={ref} className={cn('ui-menu', className)} {...props} /></ContextMenuPrimitive.Portal>;
});
export const ContextMenuItem = React.forwardRef(function ContextMenuItem({ className, ...props }, ref) {
  return <ContextMenuPrimitive.Item ref={ref} className={cn('ui-menu-item', className)} {...props} />;
});
export const ContextMenuSeparator = ({ className, ...props }) => <ContextMenuPrimitive.Separator className={cn('ui-menu-sep', className)} {...props} />;
