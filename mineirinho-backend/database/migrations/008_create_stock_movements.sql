-- ============================================
-- Migration: Criar tabela de movimentações de estoque
-- Para controle de entradas e saídas de produtos
-- ============================================

-- Criar tabela de movimentações de estoque
CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'entrada' ou 'saida'
    quantity REAL NOT NULL,
    reference_type TEXT, -- 'venda', 'consignacao', 'producao', 'ajuste', etc.
    reference_id INTEGER, -- ID da venda, consignação, etc.
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

