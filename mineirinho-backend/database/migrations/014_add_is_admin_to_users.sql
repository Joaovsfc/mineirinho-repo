-- ============================================
-- Adicionar campo is_admin na tabela users
-- Sistema de Administradores
-- ============================================

-- Adicionar coluna is_admin (0 = não admin, 1 = admin)
-- Por padrão, todos os usuários existentes serão não-admins (0)
ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0 NOT NULL;

-- Tornar o primeiro usuário (geralmente o admin padrão) como administrador
-- Se houver apenas um usuário, ele será admin
UPDATE users SET is_admin = 1 WHERE id = (SELECT MIN(id) FROM users);

-- Criar índice para busca rápida por is_admin
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

