-- ============================================
-- Migration: Campos Adicionais para Clientes
-- ============================================

-- Adicionar novos campos na tabela clients (apenas se não existirem)
-- SQLite não suporta IF NOT EXISTS em ALTER TABLE ADD COLUMN
-- Então vamos usar uma abordagem com verificação via PRAGMA

-- Verificar e adicionar cnpj_cpf se não existir
-- Nota: Esta migration será executada apenas se as colunas não existirem
-- Se já existirem, o erro será ignorado pelo sistema de migrations

-- Adicionar novos campos na tabela clients
-- Usar uma abordagem que tenta adicionar e ignora erros se já existir
-- (Isso será tratado no código do servidor)

-- Criar tabela para múltiplos telefones de clientes
CREATE TABLE IF NOT EXISTS client_phones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    phone_type TEXT DEFAULT 'Principal', -- Principal, Secundário, Celular, etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_client_phones_client_id ON client_phones(client_id);

