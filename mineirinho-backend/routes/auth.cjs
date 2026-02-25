const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db.cjs');
const { generateToken, authenticateToken } = require('../middleware/auth.cjs');

const router = express.Router();

// Rota para verificar se existe algum usuário
router.get('/check-first-user', (req, res) => {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    res.json({ hasUsers: userCount.count > 0 });
  } catch (error) {
    console.error('Erro ao verificar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota de Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e senha são obrigatórios' });
    }

    // Buscar usuário no banco
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    // Verificar se o usuário está ativo
    const columns = db.prepare('PRAGMA table_info(users)').all();
    const hasActiveColumn = columns.some(col => col.name === 'active');

    if (hasActiveColumn) {
      const isActive = user.active === 1 || user.active === true;
      if (!isActive) {
        return res.status(403).json({ error: 'Usuário desativado. Entre em contato com o administrador.' });
      }
    }

    // Verificar senha
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    // Retornar dados do usuário (sem a senha)
    const { password_hash, ...userWithoutPassword } = user;
    // Garantir que is_admin e active sejam boolean
    if (userWithoutPassword.is_admin !== undefined) {
      userWithoutPassword.is_admin = userWithoutPassword.is_admin === 1 || userWithoutPassword.is_admin === true;
    }
    if (userWithoutPassword.active !== undefined) {
      userWithoutPassword.active = userWithoutPassword.active === 1 || userWithoutPassword.active === true;
    }
    res.json({
      success: true,
      user: userWithoutPassword,
      token: generateToken(user),
      message: 'Login realizado com sucesso'
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota de Registro (criar novo usuário)
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, is_admin } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e senha são obrigatórios' });
    }

    // Verificar se o usuário já existe
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username já está em uso' });
    }

    const isAdminValue = is_admin === true || is_admin === 1 ? 1 : 0;

    // Hash da senha
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Verificar quais colunas existem
    const columns = db.prepare('PRAGMA table_info(users)').all();
    const hasIsAdminColumn = columns.some(col => col.name === 'is_admin');
    const hasActiveColumn = columns.some(col => col.name === 'active');

    // Inserir novo usuário
    let result;
    if (hasIsAdminColumn && hasActiveColumn) {
      result = db.prepare(`
        INSERT INTO users (username, email, password_hash, is_admin, active)
        VALUES (?, ?, ?, ?, 1)
      `).run(username, email || null, passwordHash, isAdminValue);
    } else if (hasIsAdminColumn) {
      result = db.prepare(`
        INSERT INTO users (username, email, password_hash, is_admin)
        VALUES (?, ?, ?, ?)
      `).run(username, email || null, passwordHash, isAdminValue);
    } else if (hasActiveColumn) {
      result = db.prepare(`
        INSERT INTO users (username, email, password_hash, active)
        VALUES (?, ?, ?, 1)
      `).run(username, email || null, passwordHash);
    } else {
      result = db.prepare(`
        INSERT INTO users (username, email, password_hash)
        VALUES (?, ?, ?)
      `).run(username, email || null, passwordHash);
    }

    // Buscar o usuário criado
    let newUser;
    if (hasIsAdminColumn && hasActiveColumn) {
      newUser = db.prepare('SELECT id, username, email, created_at, is_admin, active FROM users WHERE id = ?').get(result.lastInsertRowid);
      if (newUser) {
        if (newUser.is_admin !== undefined) {
          newUser.is_admin = newUser.is_admin === 1 || newUser.is_admin === true;
        }
        if (newUser.active !== undefined) {
          newUser.active = newUser.active === 1 || newUser.active === true;
        }
      }
    } else if (hasIsAdminColumn) {
      newUser = db.prepare('SELECT id, username, email, created_at, is_admin FROM users WHERE id = ?').get(result.lastInsertRowid);
      if (newUser && newUser.is_admin !== undefined) {
        newUser.is_admin = newUser.is_admin === 1 || newUser.is_admin === true;
      }
    } else if (hasActiveColumn) {
      newUser = db.prepare('SELECT id, username, email, created_at, active FROM users WHERE id = ?').get(result.lastInsertRowid);
      if (newUser && newUser.active !== undefined) {
        newUser.active = newUser.active === 1 || newUser.active === true;
      }
    } else {
      newUser = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    }

    res.status(201).json({
      success: true,
      user: newUser,
      token: generateToken(newUser),
      message: 'Usuário criado com sucesso'
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para listar usuários (útil para gerenciamento)
router.get('/users', authenticateToken, (req, res) => {
  try {
    const columns = db.prepare('PRAGMA table_info(users)').all();
    const hasIsAdminColumn = columns.some(col => col.name === 'is_admin');
    const hasActiveColumn = columns.some(col => col.name === 'active');

    let users;
    if (hasIsAdminColumn && hasActiveColumn) {
      users = db.prepare(`
        SELECT id, username, email, created_at, updated_at, is_admin, active
        FROM users
        ORDER BY created_at DESC
      `).all();
      // Converter is_admin e active para boolean
      users = users.map(user => ({
        ...user,
        is_admin: user.is_admin === 1 || user.is_admin === true,
        active: user.active === 1 || user.active === true
      }));
    } else if (hasIsAdminColumn) {
      users = db.prepare(`
        SELECT id, username, email, created_at, updated_at, is_admin
        FROM users
        ORDER BY created_at DESC
      `).all();
      users = users.map(user => ({
        ...user,
        is_admin: user.is_admin === 1 || user.is_admin === true
      }));
    } else if (hasActiveColumn) {
      users = db.prepare(`
        SELECT id, username, email, created_at, updated_at, active
        FROM users
        ORDER BY created_at DESC
      `).all();
      users = users.map(user => ({
        ...user,
        active: user.active === 1 || user.active === true
      }));
    } else {
      users = db.prepare(`
        SELECT id, username, email, created_at, updated_at
        FROM users
        ORDER BY created_at DESC
      `).all();
    }

    res.json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para desativar/ativar usuário (apenas admins)
router.put('/users/:id/toggle-active', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const columns = db.prepare('PRAGMA table_info(users)').all();
    const hasIsAdminColumn = columns.some(col => col.name === 'is_admin');
    const hasActiveColumn = columns.some(col => col.name === 'active');

    if (hasIsAdminColumn) {
      const requestingUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId);

      if (!requestingUser) {
        return res.status(404).json({ error: 'Usuário autenticado não encontrado' });
      }

      const isAdmin = requestingUser.is_admin === 1 || requestingUser.is_admin === true;

      if (!isAdmin) {
        return res.status(403).json({ error: 'Apenas administradores podem desativar/ativar usuários' });
      }
    }

    // Verificar se o usuário a ser desativado/ativado existe
    const userToToggle = db.prepare('SELECT id, active FROM users WHERE id = ?').get(id);
    if (!userToToggle) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se está tentando desativar a si mesmo
    if (parseInt(id) === parseInt(userId)) {
      return res.status(400).json({ error: 'Você não pode desativar seu próprio usuário' });
    }

    if (!hasActiveColumn) {
      return res.status(400).json({ error: 'Campo active não existe na tabela users' });
    }

    // Alternar status ativo/inativo
    const currentActive = userToToggle.active === 1 || userToToggle.active === true;
    const newActive = currentActive ? 0 : 1;

    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(newActive, id);

    res.json({
      success: true,
      message: newActive ? 'Usuário ativado com sucesso' : 'Usuário desativado com sucesso',
      active: newActive === 1
    });
  } catch (error) {
    console.error('Erro ao desativar/ativar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para alterar senha do usuário logado
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 4 caracteres' });
    }

    // Buscar usuário no banco
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar senha atual
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    // Hash da nova senha
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Atualizar senha
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, userId);

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para administrador alterar senha de outro usuário (sem precisar da senha atual)
router.put('/admin/reset-password', authenticateToken, async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const { targetUserId, newPassword } = req.body;

    if (!targetUserId || !newPassword) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 4 caracteres' });
    }

    // Verificar se o usuário que está fazendo a requisição é admin
    const columns = db.prepare('PRAGMA table_info(users)').all();
    const hasIsAdminColumn = columns.some(col => col.name === 'is_admin');

    if (hasIsAdminColumn) {
      const adminUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(adminUserId);

      if (!adminUser) {
        return res.status(404).json({ error: 'Usuário administrador não encontrado' });
      }

      const isAdmin = adminUser.is_admin === 1 || adminUser.is_admin === true;

      if (!isAdmin) {
        return res.status(403).json({ error: 'Apenas administradores podem alterar senhas de outros usuários' });
      }
    }

    // Verificar se o usuário alvo existe
    const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Hash da nova senha
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Atualizar senha
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, targetUserId);

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao alterar senha (admin):', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
