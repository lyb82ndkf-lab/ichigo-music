const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  // Try to rename app.asar to app.asar.old if held
  const asarPath = path.resolve(__dirname, '../release/win-unpacked/resources/app.asar');
  const tempPath = path.resolve(__dirname, `../release/win-unpacked/resources/app.asar.${Date.now()}.bak`);
  if (fs.existsSync(asarPath)) {
    fs.renameSync(asarPath, tempPath);
    console.log('Successfully renamed asar to backup:', tempPath);
  }
} catch (err) {
  console.log('Rename failed:', err.message);
}
