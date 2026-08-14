import React from 'react';
import { cn } from './utils';
export function EmptyState({ className, icon, title, description, action }) { return <section className={cn('ui-empty', className)}>{icon && <div className="ui-empty-icon">{icon}</div>}{title && <h3 className="ui-empty-title">{title}</h3>}{description && <p className="ui-empty-desc">{description}</p>}{action && <div className="ui-empty-action">{action}</div>}</section>; }
