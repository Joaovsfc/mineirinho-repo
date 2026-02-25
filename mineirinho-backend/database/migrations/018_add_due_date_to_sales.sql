-- ============================================
-- Adicionar campo de vencimento às vendas
-- Sistema de Gestão de Vendas
-- ============================================

-- Adicionar coluna de data de vencimento
-- Permite informar a data de vencimento da venda ao cadastrá-la
ALTER TABLE sales ADD COLUMN due_date DATE;

-- Criar índice para melhorar performance em consultas por data de vencimento
CREATE INDEX IF NOT EXISTS idx_sales_due_date ON sales(due_date);
