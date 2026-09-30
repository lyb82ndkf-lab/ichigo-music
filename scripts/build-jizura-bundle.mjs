import fs from 'node:fs';
import path from 'node:path';

const srcDir = 'D:/程序/wyyyy播放器/JIZURA/src';
const outPath = 'D:/程序/wyyyy播放器/ichigomusic/src/pv/jizura/jizuraLib.js';

const files = fs.readdirSync(srcDir)
  .filter(f => f.endsWith('.js') && f !== '11_export.js' && f !== '12_ui.js')
  .sort();

console.log('Packaging files count:', files.length);

let bundle = '/* eslint-disable */\n';
bundle += '// JIZURA Kinetic Typography Engine (Full 860+ Components & 27 Styles)\n';
bundle += `
const _win = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
if (typeof window === 'undefined') {
  _win.window = _win;
}
if (typeof document === 'undefined') {
  const dummyCanvas = () => ({
    width: 256,
    height: 256,
    getContext: () => ({
      font: '',
      measureText: (txt) => ({ width: (txt || '').length * 10 }),
      filter: 'none',
      fillStyle: '',
      fillRect: () => {},
      clearRect: () => {},
      drawImage: () => {},
      createImageData: () => ({ data: new Uint8Array(256 * 256 * 4) }),
      putImageData: () => {},
      createPattern: () => null,
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      save: () => {},
      restore: () => {},
      scale: () => {},
      translate: () => {},
      rotate: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {}
    })
  });
  _win.document = {
    createElement: (tag) => dummyCanvas(),
    fonts: { add: () => {}, ready: Promise.resolve() }
  };
}
if (!_win.J) _win.J = {};
const J = _win.J;
`;

for (const file of files) {
  let content = fs.readFileSync(path.join(srcDir, file), 'utf8');
  if (file === '01_util.js') {
    content = content.replace(/const J\s*=\s*\(window\.J\s*=\s*window\.J\s*\|\|\s*\{\}\);/, '/* J already bound */');
  }
  bundle += `\n/* --- JIZURA MODULE: ${file} --- */\n` + content + '\n';
}

bundle += '\nexport default J;\nexport { J };\n';

fs.writeFileSync(outPath, bundle, 'utf8');
console.log('Successfully wrote', outPath, 'Bytes:', fs.statSync(outPath).size);
