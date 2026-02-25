-- ============================================
-- Migration: Adicionar campos de encerramento em consignations
-- Para rastrear venda gerada e quantidades baixadas
-- ============================================

-- Adicionar campo sale_id para vincular consignação à venda gerada
-- Verificar se a coluna já existe antes de adicionar
-- (SQLite não suporta IF NOT EXISTS em ALTER TABLE ADD COLUMN)

-- Adicionar campo closed_quantity (quantidade baixada)
-- Adicionar campo closed_total (valor total cobrado)

-- Nota: A verificação de existência será feita no server.cjs
-- para garantir idempotência da migration

