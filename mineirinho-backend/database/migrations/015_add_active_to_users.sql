-- ============================================
-- Adicionar campo active na tabela users
-- Sistema de Desativação de Usuários
-- ============================================

-- Adicionar coluna active (1 = ativo, 0 = desativado)
-- Por padrão, todos os usuários existentes serão ativos (1)
ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1 NOT NULL;

-- Criar índice para busca rápida por active
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

