import React from 'react';

export function cn(...values) {
  return values.filter(Boolean).join(' ');
}

export function composeEventHandlers(theirHandler, ourHandler) {
  return (event) => {
    theirHandler?.(event);
    if (!event.defaultPrevented) ourHandler?.(event);
  };
}

export function Slot({ children }) {
  return children;
}
