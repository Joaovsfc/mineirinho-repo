-- ============================================
-- Migration: Tornar campos product_id e quantity nullable em consignments
-- Para suportar múltiplos itens via consignment_items
-- ============================================

-- Nota: SQLite não suporta ALTER TABLE MODIFY COLUMN diretamente
-- A verificação e atualização será feita no server.cjs
-- Esta migration serve como documentação

-- Campos product_id e quantity agora são opcionais na tabela consignments
-- pois os dados estão na tabela consignment_items

