-- ============================================
-- Migration: Adicionar Nome Fantasia aos Clientes
-- ============================================

ALTER TABLE clients ADD COLUMN fantasy_name TEXT;
