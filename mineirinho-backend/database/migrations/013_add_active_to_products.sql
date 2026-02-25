-- Adicionar campo active na tabela products
-- active = 1 significa produto ativo (pode ser usado)
-- active = 0 significa produto desativado (mantido para histórico, mas não pode ser usado)

ALTER TABLE products ADD COLUMN active INTEGER DEFAULT 1;

-- Criar índice para melhorar performance em consultas filtradas
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

