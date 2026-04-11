const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Database = require('better-sqlite3');

let db = require('../database/db.cjs');
const { requireAdmin } = require('../middleware/auth.cjs');
const { readSettings, writeSettings } = require('../database/settings.cjs');
const getDbPath = db.getDbPath;

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

function recreateDatabaseConnection() {
  const dbPath = getDbPath();
  try {
    if (db && typeof db.close === 'function') {
      try { db.close(); } catch (e) {}
    }
    const newDb = new Database(dbPath);
    newDb.pragma('foreign_keys = ON');
    newDb.pragma('journal_mode = WAL');
    newDb.pragma('synchronous = NORMAL');
    const dbModule = require.cache[require.resolve('../database/db.cjs')];
    if (dbModule) dbModule.exports = newDb;
    newDb.getDbPath = getDbPath;
    db = newDb;
    console.log('🔄 Conexão do banco recriada');
    return newDb;
  } catch (error) {
    console.error('❌ Erro ao recriar conexão:', error);
    throw error;
  }
}

router.get('/export', requireAdmin, (req, res) => {
  try {
    const dbPath = getDbPath();
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Banco de dados não encontrado' });
    }
    try { db.pragma('wal_checkpoint(FULL)'); } catch (walError) {}
    const dbBuffer = fs.readFileSync(dbPath);
    if (!dbBuffer || dbBuffer.length === 0) {
      throw new Error('Arquivo do banco vazio ou não legível');
    }
    const sqliteHeader = dbBuffer.slice(0, 16).toString('ascii');
    if (!sqliteHeader.startsWith('SQLite format')) {
      throw new Error('Arquivo não é um SQLite válido');
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `mineirinho-backup-${timestamp}.db`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', dbBuffer.length);
    res.send(dbBuffer);
    console.log(`✅ Exportado: ${filename}`);
  } catch (error) {
    console.error('❌ Erro ao exportar:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/import', upload.single('file'), requireAdmin, (req, res) => {
  try {
    let dbBuffer;
    if (req.file) {
      dbBuffer = req.file.buffer;
    } else if (req.body && req.body.data) {
      const data = req.body.data;
      const str = typeof data === 'string' ? (data.startsWith('data:') ? data.split(',')[1] : data) : data;
      dbBuffer = Buffer.from(str, 'base64');
    } else {
      return res.status(400).json({ error: 'Arquivo não fornecido' });
    }
    const dbPath = getDbPath();
    const backupPath = dbPath + '.backup';
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
    }
    const sqliteHeader = dbBuffer.slice(0, 16).toString('ascii');
    if (!sqliteHeader.startsWith('SQLite format')) {
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, dbPath);
        fs.unlinkSync(backupPath);
      }
      return res.status(400).json({ error: 'Arquivo inválido. Não é um banco SQLite válido.' });
    }
    try {
      db.pragma('wal_checkpoint(FULL)');
      db.close();
    } catch (e) {}
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    fs.writeFileSync(dbPath, dbBuffer);
    const writtenStats = fs.statSync(dbPath);
    if (writtenStats.size !== dbBuffer.length) {
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, dbPath);
        fs.unlinkSync(backupPath);
      }
      throw new Error('Tamanho escrito não confere');
    }
    try {
      recreateDatabaseConnection();
    } catch (recreateError) {
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, dbPath);
        fs.unlinkSync(backupPath);
        recreateDatabaseConnection();
      }
      throw new Error('Erro ao recriar conexão. Reinicie o servidor.');
    }
    res.json({
      success: true,
      message: 'Banco de dados importado com sucesso!',
      backupPath,
      fileSize: writtenStats.size
    });
  } catch (error) {
    console.error('❌ Erro ao importar:', error);
    const dbPath = getDbPath();
    const backupPath = dbPath + '.backup';
    if (fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(backupPath, dbPath);
        fs.unlinkSync(backupPath);
      } catch (e) {}
    }
    res.status(500).json({ error: error.message });
  }
});

// ── Backup automático para pendrive ──────────────────────────────────────────

function performUsbBackup() {
  const settings = readSettings();
  if (!settings.usb_backup_path) {
    return { success: false, error: 'Caminho do pendrive não configurado' };
  }

  const usbPath = settings.usb_backup_path;
  if (!fs.existsSync(usbPath)) {
    const msg = `Pendrive/pasta não encontrado: ${usbPath}`;
    writeSettings({ usb_last_backup_at: new Date().toISOString(), usb_last_backup_status: 'error', usb_last_backup_error: msg });
    return { success: false, error: msg };
  }

  try {
    const dbPath = getDbPath();
    try { db.pragma('wal_checkpoint(FULL)'); } catch (e) {}

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 16);
    const filename = `mineirinho-backup-${timestamp}.db`;
    const destPath = path.join(usbPath, filename);

    fs.copyFileSync(dbPath, destPath);

    // Manter apenas os últimos 5 backups na pasta
    const allBackups = fs.readdirSync(usbPath)
      .filter(f => f.startsWith('mineirinho-backup-') && f.endsWith('.db'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(usbPath, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);

    if (allBackups.length > 5) {
      allBackups.slice(5).forEach(f => {
        try { fs.unlinkSync(path.join(usbPath, f.name)); } catch (e) {}
      });
    }

    writeSettings({
      usb_last_backup_at: now.toISOString(),
      usb_last_backup_status: 'success',
      usb_last_backup_file: filename,
      usb_last_backup_error: null,
    });

    console.log(`✅ Backup automático no pendrive: ${destPath}`);
    return { success: true, file: filename };
  } catch (error) {
    const msg = error.message;
    writeSettings({ usb_last_backup_at: new Date().toISOString(), usb_last_backup_status: 'error', usb_last_backup_error: msg });
    console.error('❌ Erro no backup do pendrive:', msg);
    return { success: false, error: msg };
  }
}

router.get('/backup-settings', requireAdmin, (req, res) => {
  const s = readSettings();
  res.json({
    usb_path: s.usb_backup_path || '',
    enabled: s.usb_backup_enabled || false,
    interval_hours: s.usb_backup_interval_hours || 24,
    last_backup_at: s.usb_last_backup_at || null,
    last_backup_status: s.usb_last_backup_status || null,
    last_backup_file: s.usb_last_backup_file || null,
    last_backup_error: s.usb_last_backup_error || null,
  });
});

router.post('/backup-settings', requireAdmin, (req, res) => {
  const { usb_path, enabled, interval_hours } = req.body;
  if (typeof usb_path !== 'string') {
    return res.status(400).json({ error: 'usb_path inválido' });
  }
  const hours = Number(interval_hours);
  if (!Number.isFinite(hours) || hours < 1) {
    return res.status(400).json({ error: 'interval_hours inválido' });
  }
  writeSettings({
    usb_backup_path: usb_path.trim(),
    usb_backup_enabled: Boolean(enabled),
    usb_backup_interval_hours: hours,
  });
  res.json({ success: true });
});

router.post('/backup-usb', requireAdmin, (req, res) => {
  const result = performUsbBackup();
  if (!result.success) {
    return res.status(500).json({ error: result.error });
  }
  res.json({ success: true, file: result.file });
});

module.exports.performUsbBackup = performUsbBackup;

router.get('/info', requireAdmin, (req, res) => {
  try {
    const dbPath = getDbPath();
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Banco de dados não encontrado' });
    }
    const stats = fs.statSync(dbPath);
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    const tableCounts = {};
    for (const table of tables) {
      try {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
        tableCounts[table.name] = count.count;
      } catch (e) {
        tableCounts[table.name] = 0;
      }
    }
    function formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
    res.json({
      path: dbPath,
      size: stats.size,
      sizeFormatted: formatBytes(stats.size),
      tables: tables.map(t => t.name),
      tableCounts,
      lastModified: stats.mtime
    });
  } catch (error) {
    console.error('❌ Erro ao obter info do banco:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
