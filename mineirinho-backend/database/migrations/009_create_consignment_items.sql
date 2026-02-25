-- ============================================
-- Migration: Criar tabela de itens de consignação
-- Para suportar múltiplos itens por consignação
-- ============================================

-- Criar tabela de itens de consignação
CREATE TABLE IF NOT EXISTS consignment_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consignment_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY (consignment_id) REFERENCES consignments(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_consignment_items_consignment_id ON consignment_items(consignment_id);
CREATE INDEX IF NOT EXISTS idx_consignment_items_product_id ON consignment_items(product_id);

