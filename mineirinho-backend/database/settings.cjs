const fs = require('fs');
const path = require('path');

function getSettingsPath() {
  const db = require('./db.cjs');
  return path.join(path.dirname(db.getDbPath()), 'settings.json');
}

function readSettings() {
  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(updates) {
  const settingsPath = getSettingsPath();
  const current = readSettings();
  const merged = { ...current, ...updates };
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

module.exports = { readSettings, writeSettings };
