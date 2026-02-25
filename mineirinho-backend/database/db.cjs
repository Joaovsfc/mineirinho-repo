const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * Retorna o caminho do arquivo do banco de dados.
 * Standalone: usa DB_PATH (env) ou ./data/mineirinho.db (relativo ao process.cwd()).
 */
function getDbPath() {
  const envPath = process.env.DB_PATH;
  if (envPath) {
    const resolved = path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return resolved;
  }
  const dbDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return path.join(dbDir, 'mineirinho.db');
}

const dbPath = getDbPath();
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

if (process.env.NODE_ENV === 'development') {
  console.log(`Database connected at: ${dbPath}`);
}

// Expor getDbPath para uso em routes/database.cjs (export/import)
db.getDbPath = getDbPath;

module.exports = db;
