// Run once from the mobile folder:  node apply-logo.js
// Adds the new app icon + Android adaptive icon to app.json without touching anything else.
const fs = require('fs');
const path = 'app.json';
const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
const expo = cfg.expo;

expo.icon = './assets/icon.png';
expo.android = expo.android || {};
expo.android.adaptiveIcon = {
  foregroundImage: './assets/adaptive-icon.png',
  backgroundColor: '#1C3F60'
};

fs.writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n');
console.log('app.json updated: icon + adaptiveIcon set.');
