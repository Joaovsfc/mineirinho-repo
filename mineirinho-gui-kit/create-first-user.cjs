const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Configuração
const username = process.argv[2] || 'admin';
const password = process.argv[3] || 'admin123';
const email = process.argv[4] || 'admin@exemplo.com';

// Função para obter o caminho do banco (mesma lógica do db.cjs)
function getDbPath() {
  // Tentar usar Electron userData se disponível
  try {
    const { app } = require('electron');
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    return path.join(userDataPath, 'mineirinho.db');
  } catch (error) {
    // Se não estiver no contexto do Electron, usar pasta local do projeto
    const dbDir = path.join(__dirname);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    return path.join(dbDir, 'mineirinho.db');
  }
}

// Caminho do banco de dados
const dbPath = getDbPath();

// Função para inicializar o banco (executar migrations)
function initializeDatabase(db) {
  try {
    const migrationsDir = path.join(__dirname, 'electron', 'backend', 'database', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.error('❌ Pasta de migrations não encontrada!');
      console.error(`   Caminho esperado: ${migrationsDir}`);
      return false;
    }
    
    // Listar todos os arquivos de migração ordenados
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Executar cada migração
    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      db.exec(migrationSQL);
      console.log(`✅ Migration executed: ${file}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao executar migrations:', error.message);
    return false;
  }
}

async function createFirstUser() {
  // Criar banco se não existir
  const dbExists = fs.existsSync(dbPath);
  const db = new Database(dbPath);
  
  // Configurar o banco
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Se o banco não existia, executar migrations
  if (!dbExists) {
    console.log('📦 Banco de dados não encontrado. Executando migrations...');
    const success = initializeDatabase(db);
    if (!success) {
      db.close();
      process.exit(1);
    }
    console.log('✅ Banco de dados inicializado com sucesso!\n');
  }

  try {
    // Verificar se já existe usuário
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      console.log(`⚠️  Usuário "${username}" já existe!`);
      console.log('   Use outro username ou delete o usuário existente.');
      db.close();
      process.exit(0);
    }

    // Gerar hash da senha
    console.log('🔐 Gerando hash da senha...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Inserir usuário
    console.log('📝 Criando usuário...');
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, email)
      VALUES (?, ?, ?)
    `).run(username, passwordHash, email);

    console.log('\n✅ Usuário criado com sucesso!');
    console.log(`   ID: ${result.lastInsertRowid}`);
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Senha: ${password}`);
    console.log('\n⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
    
    db.close();
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error.message);
    db.close();
    process.exit(1);
  }
}

createFirstUser();

