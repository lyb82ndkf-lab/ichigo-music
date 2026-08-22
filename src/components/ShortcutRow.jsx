import React, { useEffect, useRef, useState } from 'react';

export function formatSingleKey(k) {
  if (!k) return '';
  if (k === 'Control' || k === 'ControlLeft' || k === 'ControlRight') return 'Ctrl';
  if (k === 'Alt' || k === 'AltLeft' || k === 'AltRight') return 'Alt';
  if (k === 'Shift' || k === 'ShiftLeft' || k === 'ShiftRight') return 'Shift';
  if (k === 'Meta' || k === 'MetaLeft' || k === 'MetaRight') return 'Win';
  if (k === 'ArrowLeft') return '←';
  if (k === 'ArrowRight') return '→';
  if (k === 'ArrowUp') return '↑';
  if (k === 'ArrowDown') return '↓';
  if (k === 'Space') return 'Space';
  if (k === 'Escape') return 'Esc';
  if (k === 'Enter') return 'Enter';
  if (k === 'Tab') return 'Tab';
  if (k === 'Backspace') return 'Backspace';
  if (k === 'Delete') return 'Del';
  if (/^Key[A-Z]$/i.test(k)) return k.replace(/^Key/i, '').toUpperCase();
  if (/^Digit[0-9]$/i.test(k)) return k.replace(/^Digit/i, '');
  if (/^Numpad[0-9]$/i.test(k)) return `Num ${k.replace(/^Numpad/i, '')}`;
  if (/^F[1-9][0-2]?$/i.test(k)) return k.toUpperCase();
  return k;
}

export function getKeycapList(shortcut) {
  if (!shortcut) return [];

  // Handle compact historical format like ControlL, ControlRight, AltLeft, etc.
  const compactMatch = String(shortcut).match(/^(Control|Alt|Shift|Meta)([A-Za-z0-9]+)$/);
  if (compactMatch && !shortcut.includes('+')) {
    const mod = compactMatch[1] === 'Control' ? 'Ctrl' : compactMatch[1];
    const rest = compactMatch[2];
    let restLabel = rest;
    if (rest === 'Left') restLabel = '←';
    else if (rest === 'Right') restLabel = '→';
    else if (rest === 'Up') restLabel = '↑';
    else if (rest === 'Down') restLabel = '↓';
    else if (rest === 'Space') restLabel = 'Space';
    else if (rest.length === 1) restLabel = rest.toUpperCase();
    else restLabel = formatSingleKey(rest);
    return [mod, restLabel];
  }

  return String(shortcut)
    .split('+')
    .map(k => formatSingleKey(k.trim()))
    .filter(Boolean);
}

export function keyLabel(shortcut) {
  const list = getKeycapList(shortcut);
  return list.length > 0 ? list.join(' + ') : '未绑定';
}

export function eventToShortcut(event) {
  const code = event.code;
  if (!code) return '';

  // If only a modifier key is pressed, return empty so recording waits for the main key
  if (['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'].includes(code)) {
    return '';
  }

  const parts = [];
  if (event.ctrlKey) parts.push('Control');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');

  if (!parts.includes(code)) {
    parts.push(code);
  }

  return parts.join('+');
}

export function shortcutMatches(event, shortcut) {
  if (!shortcut) return false;
  const code = event.code;

  // 1. Direct code equality for single keys like "Space", "ArrowRight", "KeyL"
  if (code === shortcut) {
    if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) return true;
  }

  // 2. Full combined match: "Control+KeyL", "Control+ArrowRight", etc.
  const current = eventToShortcut(event);
  if (current && current === shortcut) return true;

  // 3. Backward-compatible compact format: "ControlL", "ControlRight", "AltLeft", etc.
  const compact = String(shortcut).match(/^(Control|Alt|Shift|Meta)([A-Za-z0-9]+)$/);
  if (compact && !shortcut.includes('+')) {
    const [, modifier, target] = compact;
    const modifierPressed =
      (modifier === 'Control' && event.ctrlKey) ||
      (modifier === 'Alt' && event.altKey) ||
      (modifier === 'Shift' && event.shiftKey) ||
      (modifier === 'Meta' && event.metaKey);

    if (!modifierPressed) return false;

    if (target === 'Left' && code === 'ArrowLeft') return true;
    if (target === 'Right' && code === 'ArrowRight') return true;
    if (target === 'Up' && code === 'ArrowUp') return true;
    if (target === 'Down' && code === 'ArrowDown') return true;
    if (target === 'Space' && code === 'Space') return true;
    if (target.length === 1 && code === `Key${target.toUpperCase()}`) return true;
    if (code === target || code === `Key${target}`) return true;
  }

  return false;
}

export default function ShortcutRow({ label, description, value, onChange, onReset, disabled }) {
  const [recording, setRecording] = useState(false);
  const [heldModifiers, setHeldModifiers] = useState([]);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!recording) {
      setHeldModifiers([]);
      return undefined;
    }

    const handleKeyDown = (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setRecording(false);
        setHeldModifiers([]);
        return;
      }

      const code = event.code;
      const isModifierOnly = ['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'].includes(code);

      if (isModifierOnly) {
        const mods = [];
        if (event.ctrlKey) mods.push('Ctrl');
        if (event.altKey) mods.push('Alt');
        if (event.shiftKey) mods.push('Shift');
        if (event.metaKey) mods.push('Win');
        setHeldModifiers(mods);
        return;
      }

      const result = eventToShortcut(event);
      if (result) {
        onChange(result);
      }
      setRecording(false);
      setHeldModifiers([]);
      buttonRef.current?.blur();
    };

    const handleKeyUp = (event) => {
      if (!recording) return;
      const mods = [];
      if (event.ctrlKey) mods.push('Ctrl');
      if (event.altKey) mods.push('Alt');
      if (event.shiftKey) mods.push('Shift');
      if (event.metaKey) mods.push('Win');
      setHeldModifiers(mods);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [recording, onChange]);

  const keycaps = getKeycapList(value);

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
          className={`shortcut-capture-btn ${recording ? 'recording' : ''}`}
          onClick={() => setRecording(true)}
          title="点击录制新快捷键，按 Esc 取消"
        >
          {recording ? (
            heldModifiers.length > 0 ? (
              <span className="keycaps-wrapper">
                {heldModifiers.map((mod, idx) => (
                  <React.Fragment key={`rec-mod-${idx}`}>
                    {idx > 0 && <span className="keycap-plus">+</span>}
                    <kbd className="keycap recording">{mod}</kbd>
                  </React.Fragment>
                ))}
                <span className="keycap-plus">+</span>
                <span className="keycap-recording-dots">请按下按键…</span>
              </span>
            ) : (
              <span className="keycap-recording-prompt">请按下快捷组合键…</span>
            )
          ) : keycaps.length > 0 ? (
            <span className="keycaps-wrapper">
              {keycaps.map((k, idx) => (
                <React.Fragment key={`key-${idx}`}>
                  {idx > 0 && <span className="keycap-plus">+</span>}
                  <kbd className="keycap">{k}</kbd>
                </React.Fragment>
              ))}
            </span>
          ) : (
            <span className="keycap-unbound">未绑定 (点击设置)</span>
          )}
        </button>
        {value && onChange && (
          <button
            type="button"
            className="shortcut-mini-btn danger"
            onClick={() => onChange('')}
            title="禁用此快捷键"
          >
            禁用
          </button>
        )}
        {onReset && (
          <button
            type="button"
            className="shortcut-mini-btn"
            onClick={onReset}
            title="恢复默认快捷键"
          >
            重置
          </button>
        )}
      </div>
    </div>
  );
}
