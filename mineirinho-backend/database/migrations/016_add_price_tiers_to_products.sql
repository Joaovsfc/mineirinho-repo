-- ============================================
-- Adicionar faixas de preço aos produtos
-- Sistema de Faixas de Preços
-- ============================================

-- Adicionar colunas de faixas de preço
-- Cada produto pode ter até 4 faixas de preço diferentes
ALTER TABLE products ADD COLUMN price_tier_1 REAL;
ALTER TABLE products ADD COLUMN price_tier_2 REAL;
ALTER TABLE products ADD COLUMN price_tier_3 REAL;
ALTER TABLE products ADD COLUMN price_tier_4 REAL;

-- Migrar preço atual para faixa 1 (compatibilidade)
-- Todos os produtos existentes terão o preço atual como Faixa 1
UPDATE products SET price_tier_1 = price WHERE price_tier_1 IS NULL;

-- Criar índice para melhorar performance em consultas de preços por faixa
CREATE INDEX IF NOT EXISTS idx_products_price_tiers ON products(price_tier_1, price_tier_2, price_tier_3, price_tier_4);
