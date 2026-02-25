const express = require('express');
const db = require('../database/db.cjs');
const { calculateCurrentStock } = require('../utils/stock.cjs');

const router = express.Router();

// GET /api/products
router.get('/', (req, res) => {
  try {
    // Verificar se a coluna active existe
    const columns = db.prepare('PRAGMA table_info(products)').all();
    const hasActive = columns.some(col => col.name === 'active');
    
    // Se a coluna active existe, atualizar produtos com active = NULL para active = 1
    // Isso corrige produtos criados antes da migration ou sem o campo definido
    if (hasActive) {
      try {
        db.prepare('UPDATE products SET active = 1 WHERE active IS NULL').run();
      } catch (error) {
        console.warn('⚠️  Erro ao atualizar produtos com active NULL:', error.message);
      }
    }
    
    // Buscar apenas produtos ativos (se a coluna existir)
    // Incluir produtos com active = 1 OU active IS NULL (para compatibilidade com produtos antigos)
    let query = 'SELECT * FROM products';
    if (hasActive) {
      query += ' WHERE (active = 1 OR active IS NULL)';
    }
    query += ' ORDER BY created_at DESC';
    
    const products = db.prepare(query).all();
    // Calcular estoque atual para cada produto
    const productsWithStock = products.map(product => {
      const currentStock = calculateCurrentStock(product.id);
      return {
        ...product,
        stock: currentStock,
        calculated_stock: currentStock
      };
    });
    res.json(productsWithStock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/products/:id/movements
// Buscar movimentações de estoque de um produto
// IMPORTANTE: Esta rota deve vir ANTES de /:id para não ser capturada por ela
router.get('/:id/movements', (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se a tabela stock_movements existe
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movements'").get();
    if (!tables) {
      return res.json([]);
    }
    
    // Buscar movimentações do produto ordenadas por data (mais recente primeiro)
    const movements = db.prepare(`
      SELECT 
        id,
        type,
        quantity,
        reference_type,
        reference_id,
        notes,
        created_at as date
      FROM stock_movements
      WHERE product_id = ?
      ORDER BY created_at DESC
    `).all(id);
    
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    const currentStock = calculateCurrentStock(id);
    res.json({
      ...product,
      stock: currentStock,
      calculated_stock: currentStock
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/products/:id/add-stock
// Adicionar ou remover produtos do estoque (entrada/produção ou saída/baixa)
router.post('/:id/add-stock', (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, notes, type = 'entrada' } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Quantidade deve ser maior que zero' });
    }
    
    // Validar tipo
    if (type !== 'entrada' && type !== 'saida') {
      return res.status(400).json({ error: 'Tipo deve ser "entrada" ou "saida"' });
    }
    
    // Verificar se produto existe
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    
    // Verificar se a tabela stock_movements existe
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movements'").get();
    if (!tables) {
      // Se não existe, atualizar estoque na tabela products
      const currentStock = parseFloat(product.stock || 0);
      let newStock;
      if (type === 'entrada') {
        newStock = currentStock + parseFloat(quantity);
      } else {
        newStock = Math.max(0, currentStock - parseFloat(quantity));
        if (newStock === 0 && currentStock < parseFloat(quantity)) {
          return res.status(400).json({ error: 'Quantidade de saída maior que o estoque disponível' });
        }
      }
      db.prepare('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, id);
    } else {
      // Verificar estoque disponível antes de criar movimentação de saída
      if (type === 'saida') {
        const currentStock = calculateCurrentStock(id);
        if (parseFloat(quantity) > currentStock) {
          return res.status(400).json({ 
            error: `Quantidade de saída (${quantity}) maior que o estoque disponível (${currentStock.toFixed(2)})` 
          });
        }
      }
      
      // Criar movimentação
      const referenceType = type === 'entrada' ? 'producao' : 'ajuste';
      const defaultNotes = type === 'entrada' ? 'Adição de estoque' : 'Baixa de estoque';
      const movementStmt = db.prepare(`
        INSERT INTO stock_movements (product_id, type, quantity, reference_type, notes)
        VALUES (?, ?, ?, ?, ?)
      `);
      movementStmt.run(id, type, quantity, referenceType, notes || defaultNotes);
    }
    
    const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    const currentStock = calculateCurrentStock(id);
    res.json({
      ...updatedProduct,
      stock: currentStock,
      calculated_stock: currentStock
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/products
router.post('/', (req, res) => {
  try {
    const { 
      name, 
      price, 
      price_tier_1, 
      price_tier_2, 
      price_tier_3, 
      price_tier_4, 
      stock, 
      unit 
    } = req.body;
    
    if (!name || stock === undefined) {
      return res.status(400).json({ error: 'Nome e estoque são obrigatórios' });
    }
    
    // Validar que pelo menos price ou price_tier_1 seja fornecido
    const finalPrice = price_tier_1 !== undefined && price_tier_1 !== null 
      ? parseFloat(price_tier_1) 
      : (price !== undefined ? parseFloat(price) : null);
    
    if (finalPrice === null || isNaN(finalPrice)) {
      return res.status(400).json({ error: 'Preço ou Faixa 1 de preço é obrigatório' });
    }
    
    // Sincronizar: se price_tier_1 foi fornecido, usar ele; senão usar price
    const tier1Price = price_tier_1 !== undefined && price_tier_1 !== null 
      ? parseFloat(price_tier_1) 
      : finalPrice;
    const defaultPrice = price !== undefined ? parseFloat(price) : tier1Price;
    
    // Verificar se as colunas de faixa de preço existem
    const columns = db.prepare('PRAGMA table_info(products)').all();
    const hasActive = columns.some(col => col.name === 'active');
    const hasPriceTiers = columns.some(col => col.name === 'price_tier_1');
    
    let result;
    if (hasPriceTiers) {
      // Inserir com faixas de preço
      if (hasActive) {
        const stmt = db.prepare(`
          INSERT INTO products (name, price, price_tier_1, price_tier_2, price_tier_3, price_tier_4, stock, unit, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);
        result = stmt.run(
          name, 
          defaultPrice, // Preço padrão (sincronizado com tier 1)
          tier1Price,   // Faixa 1
          price_tier_2 !== undefined && price_tier_2 !== null ? parseFloat(price_tier_2) : null,
          price_tier_3 !== undefined && price_tier_3 !== null ? parseFloat(price_tier_3) : null,
          price_tier_4 !== undefined && price_tier_4 !== null ? parseFloat(price_tier_4) : null,
          stock, 
          unit || 'un'
        );
      } else {
        const stmt = db.prepare(`
          INSERT INTO products (name, price, price_tier_1, price_tier_2, price_tier_3, price_tier_4, stock, unit)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        result = stmt.run(
          name, 
          defaultPrice,
          tier1Price,
          price_tier_2 !== undefined && price_tier_2 !== null ? parseFloat(price_tier_2) : null,
          price_tier_3 !== undefined && price_tier_3 !== null ? parseFloat(price_tier_3) : null,
          price_tier_4 !== undefined && price_tier_4 !== null ? parseFloat(price_tier_4) : null,
          stock, 
          unit || 'un'
        );
      }
    } else {
      // Fallback: inserir sem faixas (compatibilidade)
      if (hasActive) {
        const stmt = db.prepare(`
          INSERT INTO products (name, price, stock, unit, active)
          VALUES (?, ?, ?, ?, 1)
        `);
        result = stmt.run(name, defaultPrice, stock, unit || 'un');
      } else {
        const stmt = db.prepare(`
          INSERT INTO products (name, price, stock, unit)
          VALUES (?, ?, ?, ?)
        `);
        result = stmt.run(name, defaultPrice, stock, unit || 'un');
      }
    }
    const productId = result.lastInsertRowid;
    
    // Criar movimentação de entrada inicial
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movements'").get();
      if (tables) {
        const movementStmt = db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantity, reference_type, notes)
          VALUES (?, 'entrada', ?, 'producao', 'Estoque inicial')
        `);
        movementStmt.run(productId, stock);
      }
    } catch (error) {
      console.warn('⚠️  Erro ao criar movimentação inicial:', error.message);
    }
    
    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    const currentStock = calculateCurrentStock(productId);
    res.status(201).json({
      ...newProduct,
      stock: currentStock,
      calculated_stock: currentStock
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      price, 
      price_tier_1, 
      price_tier_2, 
      price_tier_3, 
      price_tier_4, 
      stock, 
      unit 
    } = req.body;
    
    // Verificar se produto existe
    const existingProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existingProduct) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    
    // Verificar se as colunas de faixa de preço existem
    const columns = db.prepare('PRAGMA table_info(products)').all();
    const hasPriceTiers = columns.some(col => col.name === 'price_tier_1');
    
    // Determinar valores finais (manter existentes se não fornecidos)
    // Se price_tier_1 foi fornecido, usar ele; senão manter existente ou usar price
    let finalTier1;
    if (price_tier_1 !== undefined && price_tier_1 !== null) {
      finalTier1 = parseFloat(price_tier_1);
    } else if (existingProduct.price_tier_1 !== null && existingProduct.price_tier_1 !== undefined) {
      finalTier1 = parseFloat(existingProduct.price_tier_1);
    } else {
      // Se não tem tier_1, usar price (padrão)
      finalTier1 = price !== undefined ? parseFloat(price) : existingProduct.price;
    }
    
    // Determinar price final
    let finalPrice;
    if (price !== undefined) {
      finalPrice = parseFloat(price);
    } else {
      // Se price não foi fornecido, sincronizar com tier_1 se tier_1 foi alterado
      if (price_tier_1 !== undefined && price_tier_1 !== null) {
        finalPrice = parseFloat(price_tier_1);
      } else {
        finalPrice = existingProduct.price;
      }
    }
    
    // Sincronizar: se price foi alterado mas tier_1 não, atualizar tier_1 com price
    if (price !== undefined && (price_tier_1 === undefined || price_tier_1 === null)) {
      finalTier1 = finalPrice;
    }
    
    if (hasPriceTiers) {
      // Atualizar com faixas de preço
      const stmt = db.prepare(`
        UPDATE products 
        SET name = ?, 
            price = ?, 
            price_tier_1 = ?,
            price_tier_2 = ?,
            price_tier_3 = ?,
            price_tier_4 = ?,
            stock = ?, 
            unit = ?, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(
        name !== undefined ? name : existingProduct.name,
        finalPrice,
        finalTier1,
        price_tier_2 !== undefined && price_tier_2 !== null ? parseFloat(price_tier_2) : existingProduct.price_tier_2,
        price_tier_3 !== undefined && price_tier_3 !== null ? parseFloat(price_tier_3) : existingProduct.price_tier_3,
        price_tier_4 !== undefined && price_tier_4 !== null ? parseFloat(price_tier_4) : existingProduct.price_tier_4,
        stock !== undefined ? stock : existingProduct.stock,
        unit !== undefined ? unit : existingProduct.unit,
        id
      );
    } else {
      // Fallback: atualizar sem faixas (compatibilidade)
      const stmt = db.prepare(`
        UPDATE products 
        SET name = ?, price = ?, stock = ?, unit = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(
        name !== undefined ? name : existingProduct.name,
        finalPrice,
        stock !== undefined ? stock : existingProduct.stock,
        unit !== undefined ? unit : existingProduct.unit,
        id
      );
    }
    
    const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    const currentStock = calculateCurrentStock(id);
    res.json({
      ...updatedProduct,
      stock: currentStock,
      calculated_stock: currentStock
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/products/:id
// Desativa o produto ao invés de deletá-lo (mantém histórico)
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se a coluna active existe
    const columns = db.prepare('PRAGMA table_info(products)').all();
    const hasActive = columns.some(col => col.name === 'active');
    
    if (hasActive) {
      // Desativar produto ao invés de deletar
      const stmt = db.prepare('UPDATE products SET active = 0 WHERE id = ?');
      stmt.run(id);
      res.json({ success: true, message: 'Produto desativado com sucesso' });
    } else {
      // Fallback: deletar se a coluna não existir (compatibilidade)
      const stmt = db.prepare('DELETE FROM products WHERE id = ?');
      stmt.run(id);
      res.json({ success: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

