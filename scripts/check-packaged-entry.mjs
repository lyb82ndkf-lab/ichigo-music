import fs from 'node:fs';

const source = fs.readFileSync(new URL('../main-electron.js', import.meta.url), 'utf8');
const checks = [
  ['API binds to IPv4 loopback', source.includes("host: '127.0.0.1'")],
  ['packaged window uses the same IPv4 loopback', source.includes('http://127.0.0.1:${apiPort}')],
  ['production static build is mounted', source.includes("staticPath: app.isPackaged ? path.join(__dirname, 'dist') : null")]
];
const failed = checks.filter(([, passed]) => !passed).map(([label]) => label);
if (failed.length) {
  console.error(`[packaged-entry] FAILED: ${failed.join('; ')}`);
  process.exit(1);
}
console.log(`[packaged-entry] OK: ${checks.length} packaged entry invariants`);
