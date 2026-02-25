-- ============================================
-- Adicionar faixa de preço aos clientes
-- Sistema de Faixas de Preços
-- ============================================

-- Adicionar coluna de faixa de preço
-- Cada cliente pertence a uma faixa de preço (1-4)
-- Por padrão, todos os clientes existentes serão da Faixa 1
ALTER TABLE clients ADD COLUMN price_tier INTEGER DEFAULT 1;

-- Garantir que todos os clientes existentes tenham faixa 1
UPDATE clients SET price_tier = 1 WHERE price_tier IS NULL;

-- Criar índice para melhorar performance em consultas por faixa de preço
CREATE INDEX IF NOT EXISTS idx_clients_price_tier ON clients(price_tier);
