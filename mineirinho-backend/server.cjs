const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('./database/db.cjs');
const { authenticateToken } = require('./middleware/auth.cjs');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: origens a partir de variável de ambiente ou padrão
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:5173', 'http://127.0.0.1:5173', 'file://'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Rotas públicas (antes do middleware de autenticação)
app.use('/api/auth', require('./routes/auth.cjs'));

// Middleware de autenticação para todas as rotas protegidas
app.use('/api', authenticateToken);

// Rotas protegidas (requerem token JWT)
app.use('/api/products', require('./routes/products.cjs'));
app.use('/api/clients', require('./routes/clients.cjs'));
app.use('/api/sales', require('./routes/sales.cjs'));
app.use('/api/accounts', require('./routes/accounts.cjs'));
app.use('/api/consignments', require('./routes/consignments.cjs'));
app.use('/api/reports', require('./routes/reports.cjs'));

try {
  app.use('/api/database', require('./routes/database.cjs'));
  console.log('✅ Rotas de banco de dados registradas: /api/database');
} catch (error) {
  console.error('❌ Erro ao carregar rotas de banco de dados:', error.message);
}

// Usuário admin padrão
async function createDefaultAdmin() {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
      const defaultUsername = 'admin';
      const defaultPassword = 'admin123';
      const defaultEmail = 'admin@mineirinho.com';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      const hasIsAdminColumn = columnExists('users', 'is_admin');
      if (hasIsAdminColumn) {
        db.prepare(`
          INSERT INTO users (username, email, password_hash, is_admin)
          VALUES (?, ?, ?, 1)
        `).run(defaultUsername, defaultEmail, passwordHash);
      } else {
        db.prepare(`
          INSERT INTO users (username, email, password_hash)
          VALUES (?, ?, ?)
        `).run(defaultUsername, defaultEmail, passwordHash);
      }
      console.log('👤 Usuário admin padrão criado:', defaultUsername, '/', defaultPassword);
    }
  } catch (error) {
    console.error('❌ Erro ao criar usuário admin padrão:', error);
  }
}

function columnExists(tableName, columnName) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.some(col => col.name === columnName);
  } catch (error) {
    return false;
  }
}

function addColumnIfNotExists(tableName, columnName, columnDefinition) {
  if (!columnExists(tableName, columnName)) {
    try {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
      return true;
    } catch (error) {
      if (!error.message.includes('duplicate column')) throw error;
    }
  }
  return false;
}

async function initializeDatabase() {
  try {
    const migrationsDir = path.join(__dirname, 'database', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      if (file === '003_clients_additional_fields.sql') {
        addColumnIfNotExists('clients', 'cnpj_cpf', 'TEXT');
        addColumnIfNotExists('clients', 'state_registration', 'TEXT');
        addColumnIfNotExists('clients', 'buyer_name', 'TEXT');
        const sqlWithoutAlter = migrationSQL
          .split('\n')
          .filter(line => !line.trim().startsWith('ALTER TABLE clients ADD COLUMN'))
          .join('\n');
        if (sqlWithoutAlter.trim()) db.exec(sqlWithoutAlter);
        try {
          const existingPhones = db.prepare('SELECT COUNT(*) as count FROM client_phones').get();
          if (existingPhones.count === 0) {
            const clientsWithPhone = db.prepare('SELECT id, phone FROM clients WHERE phone IS NOT NULL AND phone != \'\'').all();
            if (clientsWithPhone.length > 0) {
              const insertPhone = db.prepare('INSERT INTO client_phones (client_id, phone, phone_type) VALUES (?, ?, \'Principal\')');
              for (const client of clientsWithPhone) insertPhone.run(client.id, client.phone);
            }
          }
        } catch (e) {
          if (!e.message.includes('no such table')) console.warn(e.message);
        }
      } else if (file === '005_add_sale_id_to_accounts_receivable.sql') {
        addColumnIfNotExists('accounts_receivable', 'sale_id', 'INTEGER');
        try { db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_receivable_sale_id ON accounts_receivable(sale_id)'); } catch (e) {}
      } else if (file === '006_add_payment_method.sql') {
        addColumnIfNotExists('accounts_payable', 'payment_method', 'TEXT');
        addColumnIfNotExists('accounts_receivable', 'payment_method', 'TEXT');
      } else if (file === '007_add_payment_method_to_sales.sql') {
        addColumnIfNotExists('sales', 'payment_method', 'TEXT');
      } else if (file === '010_add_consignment_sale_fields.sql') {
        addColumnIfNotExists('consignments', 'sale_id', 'INTEGER');
        addColumnIfNotExists('consignments', 'closed_quantity', 'REAL');
        addColumnIfNotExists('consignments', 'closed_total', 'REAL');
        try { db.exec('CREATE INDEX IF NOT EXISTS idx_consignments_sale_id ON consignments(sale_id)'); } catch (e) {}
      } else if (file === '012_add_user_id_to_sales_and_consignments.sql') {
        addColumnIfNotExists('sales', 'user_id', 'INTEGER');
        addColumnIfNotExists('consignments', 'user_id', 'INTEGER');
        try {
          db.exec('CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id)');
          db.exec('CREATE INDEX IF NOT EXISTS idx_consignments_user_id ON consignments(user_id)');
        } catch (e) {}
      } else if (file === '013_add_active_to_products.sql') {
        addColumnIfNotExists('products', 'active', 'INTEGER');
        try { db.prepare('UPDATE products SET active = 1 WHERE active IS NULL').run(); } catch (e) {}
        try { db.exec('CREATE INDEX IF NOT EXISTS idx_products_active ON products(active)'); } catch (e) {}
      } else if (file === '014_add_is_admin_to_users.sql') {
        addColumnIfNotExists('users', 'is_admin', 'INTEGER DEFAULT 0 NOT NULL');
        try {
          const firstUser = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get();
          if (firstUser) db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(firstUser.id);
        } catch (e) {}
        try { db.exec('CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin)'); } catch (e) {}
      } else if (file === '015_add_active_to_users.sql') {
        addColumnIfNotExists('users', 'active', 'INTEGER DEFAULT 1 NOT NULL');
        try { db.prepare('UPDATE users SET active = 1 WHERE active IS NULL').run(); } catch (e) {}
        try { db.exec('CREATE INDEX IF NOT EXISTS idx_users_active ON users(active)'); } catch (e) {}
      } else if (file === '011_make_consignment_fields_nullable.sql') {
        try {
          const itemsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='consignment_items'").get();
          if (itemsTable) {
            const columns = db.prepare('PRAGMA table_info(consignments)').all();
            const productIdColumn = columns.find(col => col.name === 'product_id');
            if (productIdColumn && productIdColumn.notnull === 1) {
              const existingColumns = db.prepare('PRAGMA table_info(consignments)').all();
              const hasSaleId = existingColumns.some(col => col.name === 'sale_id');
              const hasClosedQty = existingColumns.some(col => col.name === 'closed_quantity');
              const hasClosedTotal = existingColumns.some(col => col.name === 'closed_total');
              const hasUserId = existingColumns.some(col => col.name === 'user_id');
              let createTableSQL = `CREATE TABLE consignments_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER NOT NULL,
                product_id INTEGER,
                quantity REAL,
                date DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'Ativo',
                notes TEXT`;
              if (hasSaleId) createTableSQL += ', sale_id INTEGER';
              if (hasClosedQty) createTableSQL += ', closed_quantity REAL';
              if (hasClosedTotal) createTableSQL += ', closed_total REAL';
              if (hasUserId) createTableSQL += ', user_id INTEGER';
              createTableSQL += ', FOREIGN KEY (client_id) REFERENCES clients(id), FOREIGN KEY (product_id) REFERENCES products(id))';
              db.exec(createTableSQL);
              const selectColumns = ['id', 'client_id', 'product_id', 'quantity', 'date', 'status', 'notes'];
              if (hasSaleId) selectColumns.push('sale_id'); else selectColumns.push('NULL as sale_id');
              if (hasClosedQty) selectColumns.push('closed_quantity'); else selectColumns.push('NULL as closed_quantity');
              if (hasClosedTotal) selectColumns.push('closed_total'); else selectColumns.push('NULL as closed_total');
              if (hasUserId) selectColumns.push('user_id');
              db.exec(`INSERT INTO consignments_new SELECT ${selectColumns.join(', ')} FROM consignments`);
              db.exec('DROP TABLE consignments');
              db.exec('ALTER TABLE consignments_new RENAME TO consignments');
              db.exec('CREATE INDEX IF NOT EXISTS idx_consignments_client_id ON consignments(client_id)');
              db.exec('CREATE INDEX IF NOT EXISTS idx_consignments_product_id ON consignments(product_id)');
              db.exec('CREATE INDEX IF NOT EXISTS idx_consignments_status ON consignments(status)');
              if (hasSaleId) db.exec('CREATE INDEX IF NOT EXISTS idx_consignments_sale_id ON consignments(sale_id)');
              if (hasUserId) db.exec('CREATE INDEX IF NOT EXISTS idx_consignments_user_id ON consignments(user_id)');
            }
          }
        } catch (e) {
          if (!e.message.includes('no such table') && !e.message.includes('already exists')) console.error(e.message);
        }
      } else {
        try {
          db.exec(migrationSQL);
        } catch (error) {
          if (!error.message.includes('duplicate column') && !error.message.includes('already exists')) throw error;
        }
      }
      console.log(`✅ Migration: ${file}`);
    }
    await createDefaultAdmin();
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

async function startServer() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Backend running at http://localhost:${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  });
}

module.exports = { startServer, app };

if (require.main === module) {
  startServer().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
