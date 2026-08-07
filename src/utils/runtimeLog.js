const MAX_RUNTIME_LOGS = 500;
const listeners = new Set();
const entries = [];
let installed = false;
let sequence = 0;
let sessionStartedAt = Date.now();

const REDACTIONS = [
  [/(MUSIC_U\s*[=:]\s*)[^;\s]+/gi, '$1[REDACTED]'],
  [/(cookie\s*[=:]\s*)[^;\n]+/gi, '$1[REDACTED]'],
  [/(roomToken|token|authorization)(["']?\s*[:=]\s*["']?)[^"',;\s}]+/gi, '$1$2[REDACTED]']
];

function redact(value) {
  return REDACTIONS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(value));
}

function serialize(value, seen = new WeakSet()) {
  if (value instanceof Error) return redact(value.stack || `${value.name}: ${value.message}`);
  if (typeof value === 'string') return redact(value);
  if (value === undefined) return 'undefined';
  if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  try {
    return redact(JSON.stringify(value, (_key, nested) => {
      if (typeof nested === 'object' && nested !== null) {
        if (seen.has(nested)) return '[Circular]';
        seen.add(nested);
      }
      return nested;
    }));
  } catch {
    return redact(String(value));
  }
}

function notify() {
  const snapshot = entries.slice();
  listeners.forEach(listener => {
    try { listener(snapshot); } catch { /* log UI must never affect playback */ }
  });
}

export function appendRuntimeLog(level, message, details = null, source = 'renderer') {
  const normalizedLevel = ['debug', 'info', 'warn', 'error'].includes(level) ? level : 'info';
  const detailText = details == null
    ? ''
    : Array.isArray(details)
      ? details.map(item => serialize(item)).join(' ')
      : serialize(details);
  const messageText = serialize(message).slice(0, 4000);
  const last = entries[entries.length - 1];
  const now = Date.now();

  if (last && last.level === normalizedLevel && last.message === messageText && last.details === detailText && now - last.timestamp < 600) {
    last.count += 1;
    last.timestamp = now;
    notify();
    return last;
  }

  const entry = {
    id: ++sequence,
    timestamp: now,
    level: normalizedLevel,
    source,
    message: messageText,
    details: detailText.slice(0, 8000),
    count: 1
  };
  entries.push(entry);
  if (entries.length > MAX_RUNTIME_LOGS) entries.splice(0, entries.length - MAX_RUNTIME_LOGS);
  notify();
  return entry;
}

export function getRuntimeLogs() {
  return entries.slice();
}

export function subscribeRuntimeLogs(listener) {
  listeners.add(listener);
  listener(entries.slice());
  return () => listeners.delete(listener);
}

export function clearRuntimeLogs({ addMarker = false } = {}) {
  entries.length = 0;
  sequence = 0;
  sessionStartedAt = Date.now();
  if (addMarker) window.electronAPI?.clearMainRuntimeLogs?.().catch(() => {});
  if (addMarker) appendRuntimeLog('info', '运行日志已手动清空', null, 'system');
  else notify();
}

export function formatRuntimeLogs(logs = entries) {
  const started = new Date(sessionStartedAt).toLocaleString();
  const header = `ICHIGOMusic runtime log\nSession: ${started}\nEntries: ${logs.length}\n`;
  return `${header}\n${logs.map(entry => {
    const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour12: false, fractionalSecondDigits: 3 });
    const repeated = entry.count > 1 ? ` ×${entry.count}` : '';
    return `[${time}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}${repeated}${entry.details ? `\n  ${entry.details}` : ''}`;
  }).join('\n')}`;
}

export function installRuntimeLogging() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const nativeConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  };

  for (const level of Object.keys(nativeConsole)) {
    console[level] = (...args) => {
      nativeConsole[level](...args);
      appendRuntimeLog(level === 'log' ? 'debug' : level, args[0] ?? '', args.slice(1), 'renderer');
    };
  }

  window.addEventListener('error', event => {
    appendRuntimeLog('error', event.message || 'Window error', event.error || `${event.filename || ''}:${event.lineno || 0}:${event.colno || 0}`, 'window');
  });
  window.addEventListener('unhandledrejection', event => {
    appendRuntimeLog('error', 'Unhandled promise rejection', event.reason, 'promise');
  });
  window.addEventListener('beforeunload', () => clearRuntimeLogs());

  const ingestMainEntry = entry => {
    if (!entry) return;
    appendRuntimeLog(entry.level || 'info', entry.message || 'Main process event', entry.details || null, 'main');
  };
  window.electronAPI?.getMainRuntimeLogs?.()
    .then(logs => Array.isArray(logs) && logs.forEach(ingestMainEntry))
    .catch(error => appendRuntimeLog('warn', '读取主进程日志失败', error, 'system'));
  window.electronAPI?.onMainRuntimeLog?.(ingestMainEntry);

  appendRuntimeLog('info', '运行会话开始', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio
  }, 'system');
}
