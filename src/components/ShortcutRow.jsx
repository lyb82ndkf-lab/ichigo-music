import React, { useEffect, useRef, useState } from 'react';

function keyLabel(key) {
  if (!key) return '\u672a\u7ed1\u5b9a';
  const aliases = {
    Space: 'Space',
    ControlLeft: 'Ctrl + ?',
    ControlRight: 'Ctrl + ?',
    ControlUp: 'Ctrl + ?',
    ControlDown: 'Ctrl + ?',
    ArrowLeft: '?',
    ArrowRight: '?',
    ArrowUp: '?',
    ArrowDown: '?',
    Escape: 'Esc'
  };
  if (aliases[key]) return aliases[key];
  return key
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace(/^Control/, 'Ctrl + ')
    .replace(/^Alt/, 'Alt + ')
    .replace(/^Shift/, 'Shift + ')
    .replace(/^Meta/, 'Meta + ');
}

export function eventToShortcut(event) {
  const code = event.code || event.key;
  if (!code) return '';

  // Preserve historical defaults such as ControlRight / ControlLeft for arrow combos.
  if (event.ctrlKey && code === 'ArrowRight') return 'ControlRight';
  if (event.ctrlKey && code === 'ArrowLeft') return 'ControlLeft';
  if (event.ctrlKey && code === 'ArrowUp') return 'ControlUp';
  if (event.ctrlKey && code === 'ArrowDown') return 'ControlDown';
  if (event.altKey && code === 'ArrowRight') return 'AltRight';
  if (event.altKey && code === 'ArrowLeft') return 'AltLeft';
  if (event.shiftKey && code === 'ArrowRight') return 'ShiftRight';
  if (event.shiftKey && code === 'ArrowLeft') return 'ShiftLeft';

  const parts = [];
  if (event.ctrlKey && !code.startsWith('Control')) parts.push('Control');
  if (event.altKey && !code.startsWith('Alt')) parts.push('Alt');
  if (event.shiftKey && !code.startsWith('Shift')) parts.push('Shift');
  if (event.metaKey && !code.startsWith('Meta')) parts.push('Meta');
  parts.push(code);
  return parts.join('+');
}

export function shortcutMatches(event, shortcut) {
  if (!shortcut) return false;
  const current = eventToShortcut(event);
  if (current === shortcut || event.code === shortcut) return true;

  // Backward-compatible compact notation used by the default profile:
  // ControlL = Ctrl + L, ControlH = Ctrl + H, etc.
  const compact = shortcut.match(/^(Control|Alt|Shift|Meta)([A-Z])$/);
  if (compact) {
    const [, modifier, letter] = compact;
    const modifierPressed =
      (modifier === 'Control' && event.ctrlKey) ||
      (modifier === 'Alt' && event.altKey) ||
      (modifier === 'Shift' && event.shiftKey) ||
      (modifier === 'Meta' && event.metaKey);
    return modifierPressed && event.code === `Key${letter}`;
  }

  return false;
}

export default function ShortcutRow({ label, description, value, onChange, onReset, disabled }) {
  const [recording, setRecording] = useState(false);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!recording) return undefined;

    const handler = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        setRecording(false);
        return;
      }
      const next = eventToShortcut(event);
      if (next) onChange(next);
      setRecording(false);
      buttonRef.current?.blur();
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [recording, onChange]);

  return (
    <div className="shortcut-row">
      <div className="shortcut-row-meta">
        <strong>{label}</strong>
        {description && <span>{description}</span>}
      </div>
      <div className="shortcut-row-actions">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          className={`shortcut-capture ${recording ? 'recording' : ''}`}
          onClick={() => setRecording(true)}
        >
          {recording ? '\u6309\u4e0b\u65b0\u7684\u7ec4\u5408\u952e\u2026' : keyLabel(value)}
        </button>
        {value && onChange && (
          <button type="button" className="setting-btn ghost danger" style={{ marginLeft: 8 }} onClick={() => onChange('')}>禁用</button>
        )}
        {onReset && (
          <button type="button" className="setting-btn ghost" style={{ marginLeft: 8 }} onClick={onReset}>重置</button>
        )}
      </div>
    </div>
  );
}
