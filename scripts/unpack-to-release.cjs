const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const exe7z = path.resolve(__dirname, '../node_modules/7zip-bin/win/x64/7za.exe');
const setupExe = path.resolve(__dirname, '../release/ICHIGOMusic Setup 2.3.0.exe');
const targetDir = path.resolve(__dirname, '../release/win-unpacked');

console.log('7z binary:', exe7z);
console.log('Setup exe:', setupExe);
console.log('Target dir:', targetDir);

// 1. Extract setup.exe to a temp folder
const tempExtract = path.resolve(__dirname, '../release/temp_extract');
if (fs.existsSync(tempExtract)) {
  fs.rmSync(tempExtract, { recursive: true, force: true });
}
fs.mkdirSync(tempExtract, { recursive: true });

console.log('Extracting NSIS installer using 7za...');
execSync(`"${exe7z}" x "${setupExe}" -o"${tempExtract}" -y`, { stdio: 'inherit' });

console.log('Extraction finished! Checking extracted contents...');
const extractedFiles = fs.readdirSync(tempExtract);
console.log('Extracted root files/dirs:', extractedFiles);

// In NSIS 7z extraction, files might be in root or in $PLUGINSDIR / app-64.7z
// Let's check for app-64.7z or app.7z
for (const item of extractedFiles) {
  if (item.endsWith('.7z')) {
    const sub7z = path.join(tempExtract, item);
    console.log('Found nested 7z package:', sub7z, 'Extracting into targetDir...');
    execSync(`"${exe7z}" x "${sub7z}" -o"${targetDir}" -y`, { stdio: 'inherit' });
  }
}

// Also copy any direct binaries if present
for (const item of extractedFiles) {
  if (!item.startsWith('$') && !item.endsWith('.7z') && !item.endsWith('.nsi')) {
    const src = path.join(tempExtract, item);
    const dest = path.join(targetDir, item);
    try {
      if (fs.statSync(src).isDirectory()) {
        execSync(`robocopy "${src}" "${dest}" /E /NP /NFL /NDL /R:1 /W:1`, { stdio: 'ignore' });
      } else {
        fs.copyFileSync(src, dest);
      }
    } catch (e) {}
  }
}

// Clean up tempExtract
try {
  fs.rmSync(tempExtract, { recursive: true, force: true });
} catch (e) {}

console.log('=== Final Verification of release/win-unpacked ===');
const finalFiles = fs.readdirSync(targetDir);
console.log('Files in release/win-unpacked:');
finalFiles.forEach(f => console.log(' -', f));

if (fs.existsSync(path.join(targetDir, 'ICHIGOMusic.exe'))) {
  console.log(' SUCCESS: ICHIGOMusic.exe is present and ready in release/win-unpacked!');
} else {
  console.log(' WARNING: ICHIGOMusic.exe not found in root of release/win-unpacked');
}
