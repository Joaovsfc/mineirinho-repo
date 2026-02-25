-- ============================================
-- Migration: Alterar unidade padrão de produtos
-- Mudança de 'kg' para 'un' (unidade)
-- ============================================

-- SQLite não suporta ALTER TABLE para mudar DEFAULT diretamente
-- Então vamos atualizar os produtos existentes que têm 'kg' como unidade
-- e criar uma nova tabela com o DEFAULT correto

-- Atualizar produtos existentes que têm 'kg' para 'un'
UPDATE products SET unit = 'un' WHERE unit = 'kg' OR unit IS NULL OR unit = '';

-- Nota: Para novos produtos, o valor padrão será 'un' no código da aplicação
-- O schema original já tem DEFAULT 'kg', mas isso será tratado no código

