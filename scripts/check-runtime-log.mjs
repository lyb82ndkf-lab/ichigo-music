import fs from 'node:fs';
import path from 'node:path';

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const runtime = read('src/utils/runtimeLog.js');
const settings = read('src/views/Settings.jsx');
const main = read('main-electron.js');

if (/localStorage|sessionStorage|writeFile/i.test(runtime)) {
  throw new Error('runtime logs must remain memory-only');
}
if (!runtime.includes("window.addEventListener('beforeunload', () => clearRuntimeLogs())")) {
  throw new Error('renderer runtime logs must clear when the window closes');
}
if (!main.includes("app.on('before-quit'") || !main.includes('mainRuntimeLogs.length = 0')) {
  throw new Error('main-process runtime logs must clear before app exit');
}
if (!settings.includes("{ key: 'logs', label: '运行日志'") || !settings.includes('renderLogsTab')) {
  throw new Error('settings must expose the runtime log viewer');
}
if (!runtime.includes('[REDACTED]')) {
  throw new Error('runtime logs must redact sensitive values');
}

console.log('[runtime-log] OK: session-only diagnostics are visible in Settings and cleared on exit');
