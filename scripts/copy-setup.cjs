const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../dist_electron/ICHIGOMusic Setup 2.3.0.exe');
const dest = path.resolve(__dirname, '../release/ICHIGOMusic Setup 2.3.0.exe');
try {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log('Successfully copied to release/ICHIGOMusic Setup 2.3.0.exe');
  }
} catch (e) {
  console.log('Copy to release failed:', e.message);
}
