-- ============================================
-- Migration: Adicionar sale_id em accounts_receivable
-- Para vincular contas a receber às vendas
-- ============================================

-- Adicionar campo sale_id na tabela accounts_receivable
-- SQLite não suporta IF NOT EXISTS em ALTER TABLE ADD COLUMN
-- Isso será tratado no código do servidor

