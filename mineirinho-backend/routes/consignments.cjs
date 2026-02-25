const express = require('express');
const db = require('../database/db.cjs');
const { validateStock } = require('../utils/stock.cjs');

const router = express.Router();

// GET /api/consignments
router.get('/', (req, res) => {
  try {
    const consignments = db.prepare('SELECT * FROM consignments ORDER BY date DESC').all();
    
    // Verificar se a tabela consignment_items existe
    let hasItemsTable = false;
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='consignment_items'").get();
      hasItemsTable = !!tables;
    } catch (error) {
      // Tabela não existe ainda
    }
    
    // Se a tabela existe, buscar itens para cada consignação
    if (hasItemsTable) {
      const consignmentsWithItems = consignments.map(consignment => {
        const items = db.prepare(`
          SELECT ci.*, p.name as product_name, p.unit as product_unit
          FROM consignment_items ci
          LEFT JOIN products p ON ci.product_id = p.id
          WHERE ci.consignment_id = ?
        `).all(consignment.id);
        return { ...consignment, items };
      });
      res.json(consignmentsWithItems);
    } else {
      // Compatibilidade: se não tem tabela de itens, retornar como antes
      res.json(consignments);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/consignments/:id
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const consignment = db.prepare('SELECT * FROM consignments WHERE id = ?').get(id);
    if (!consignment) {
      return res.status(404).json({ error: 'Consignação não encontrada' });
    }
    
    // Verificar se a tabela consignment_items existe
    let hasItemsTable = false;
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='consignment_items'").get();
      hasItemsTable = !!tables;
    } catch (error) {
      // Tabela não existe ainda
    }
    
    // Se a tabela existe, buscar itens
    if (hasItemsTable) {
      const items = db.prepare(`
        SELECT ci.*, p.name as product_name, p.unit as product_unit, p.price as current_price
        FROM consignment_items ci
        LEFT JOIN products p ON ci.product_id = p.id
        WHERE ci.consignment_id = ?
      `).all(id);
      
      // Buscar dados do cliente
      const client = consignment.client_id 
        ? db.prepare('SELECT * FROM clients WHERE id = ?').get(consignment.client_id)
        : null;
      
      res.json({ ...consignment, items, client });
    } else {
      // Compatibilidade: se não tem tabela de itens, retornar como antes
      res.json(consignment);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/consignments
router.post('/', (req, res) => {
  try {
    const { client_id, items, status, notes } = req.body;
    
    // Verificar se a tabela consignment_items existe
    let hasItemsTable = false;
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='consignment_items'").get();
      hasItemsTable = !!tables;
    } catch (error) {
      // Tabela não existe ainda
    }
    
    // Modo novo: com múltiplos itens
    if (hasItemsTable && items && Array.isArray(items) && items.length > 0) {
      if (!client_id) {
        return res.status(400).json({ error: 'Cliente é obrigatório' });
      }
      
      // Validar itens
      for (const item of items) {
        if (!item.product_id || item.quantity === undefined || item.quantity <= 0) {
          return res.status(400).json({ error: 'Cada item deve ter produto e quantidade válida' });
        }
      }
      
      // Validar estoque antes de criar a consignação
      const stockErrors = [];
      for (const item of items) {
        const stockValidation = validateStock(item.product_id, item.quantity);
        if (!stockValidation.valid) {
          const product = db.prepare('SELECT name FROM products WHERE id = ?').get(item.product_id);
          const productName = product ? product.name : `Produto #${item.product_id}`;
          stockErrors.push({
            product_id: item.product_id,
            product_name: productName,
            required: stockValidation.required,
            available: stockValidation.available,
          });
        }
      }
      
      if (stockErrors.length > 0) {
        const errorMessages = stockErrors.map(err => 
          `${err.product_name}: necessário ${err.required}, disponível ${err.available}`
        );
        return res.status(400).json({ 
          error: 'Estoque insuficiente',
          details: stockErrors,
          message: `Estoque insuficiente para: ${errorMessages.join('; ')}`
        });
      }
      
      // Criar consignação
      // Verificar se product_id e quantity são obrigatórios
      const columns = db.prepare('PRAGMA table_info(consignments)').all();
      const productIdColumn = columns.find(col => col.name === 'product_id');
      const quantityColumn = columns.find(col => col.name === 'quantity');
      const hasUserId = columns.some(col => col.name === 'user_id');
      const productIdRequired = productIdColumn && productIdColumn.notnull === 1;
      const quantityRequired = quantityColumn && quantityColumn.notnull === 1;
      
      const { user_id } = req.body;
      let consignmentId;
      
      // Se as colunas são obrigatórias, tentar inserir NULL primeiro
      // Se falhar, usar valores dummy temporários
      if (productIdRequired || quantityRequired) {
        try {
          // Tentar inserir com NULL (se a migration foi aplicada, funcionará)
          if (hasUserId) {
            const stmt = db.prepare(`
              INSERT INTO consignments (client_id, product_id, quantity, status, notes, user_id)
              VALUES (?, NULL, NULL, ?, ?, ?)
            `);
            const result = stmt.run(
              client_id,
              status || 'Ativo',
              notes || null,
              user_id || null
            );
            consignmentId = result.lastInsertRowid;
          } else {
            const stmt = db.prepare(`
              INSERT INTO consignments (client_id, product_id, quantity, status, notes)
              VALUES (?, NULL, NULL, ?, ?)
            `);
            const result = stmt.run(
              client_id,
              status || 'Ativo',
              notes || null
            );
            consignmentId = result.lastInsertRowid;
          }
        } catch (error) {
          // Se falhar, a migration ainda não foi aplicada
          // Usar valores dummy temporários (primeiro produto, quantidade 0)
          const firstItem = items[0];
          if (hasUserId) {
            const stmt = db.prepare(`
              INSERT INTO consignments (client_id, product_id, quantity, status, notes, user_id)
              VALUES (?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
              client_id,
              firstItem.product_id,
              0, // quantidade dummy
              status || 'Ativo',
              notes || null,
              user_id || null
            );
            consignmentId = result.lastInsertRowid;
          } else {
            const stmt = db.prepare(`
              INSERT INTO consignments (client_id, product_id, quantity, status, notes)
              VALUES (?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
              client_id,
              firstItem.product_id,
              0, // quantidade dummy
              status || 'Ativo',
              notes || null
            );
            consignmentId = result.lastInsertRowid;
          }
        }
      } else {
        // Colunas são opcionais, inserir normalmente
        if (hasUserId) {
          const stmt = db.prepare(`
            INSERT INTO consignments (client_id, status, notes, user_id)
            VALUES (?, ?, ?, ?)
          `);
          const result = stmt.run(
            client_id,
            status || 'Ativo',
            notes || null,
            user_id || null
          );
          consignmentId = result.lastInsertRowid;
        } else {
          const stmt = db.prepare(`
            INSERT INTO consignments (client_id, status, notes)
            VALUES (?, ?, ?)
          `);
          const result = stmt.run(
            client_id,
            status || 'Ativo',
            notes || null
          );
          consignmentId = result.lastInsertRowid;
        }
      }
      
      // Criar itens e movimentações
      const itemStmt = db.prepare(`
        INSERT INTO consignment_items (consignment_id, product_id, quantity, price, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      // Verificar se stock_movements existe
      let hasStockMovements = false;
      let movementStmt = null;
      try {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movements'").get();
        hasStockMovements = !!tables;
        if (hasStockMovements) {
          movementStmt = db.prepare(`
            INSERT INTO stock_movements (product_id, type, quantity, reference_type, reference_id, notes)
            VALUES (?, 'saida', ?, 'consignacao', ?, ?)
          `);
        }
      } catch (error) {
        // Tabela não existe
      }
      
      for (const item of items) {
        // Buscar preço do produto
        const product = db.prepare('SELECT price FROM products WHERE id = ?').get(item.product_id);
        const price = item.price || (product ? product.price : 0);
        const subtotal = parseFloat(item.quantity) * parseFloat(price);
        
        // Inserir item
        itemStmt.run(
          consignmentId,
          item.product_id,
          item.quantity,
          price,
          subtotal
        );
        
        // Criar movimentação de saída
        if (movementStmt) {
          movementStmt.run(
            item.product_id,
            item.quantity,
            consignmentId,
            `Consignação #${consignmentId}`
          );
        }
      }
      
      // Retornar consignação com itens
      const newConsignment = db.prepare('SELECT * FROM consignments WHERE id = ?').get(consignmentId);
      const consignmentItems = db.prepare(`
        SELECT ci.*, p.name as product_name, p.unit as product_unit
        FROM consignment_items ci
        LEFT JOIN products p ON ci.product_id = p.id
        WHERE ci.consignment_id = ?
      `).all(consignmentId);
      
      res.status(201).json({ ...newConsignment, items: consignmentItems });
    } else {
      // Modo antigo: compatibilidade com formato antigo (1 produto)
      const { product_id, quantity, user_id } = req.body;
      if (!client_id || !product_id || quantity === undefined) {
        return res.status(400).json({ error: 'Cliente, produto e quantidade são obrigatórios' });
      }
      
      // Verificar se a coluna user_id existe
      const columns = db.prepare('PRAGMA table_info(consignments)').all();
      const hasUserId = columns.some(col => col.name === 'user_id');
      
      let stmt;
      let result;
      
      if (hasUserId) {
        stmt = db.prepare(`
          INSERT INTO consignments (client_id, product_id, quantity, status, notes, user_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        result = stmt.run(
          client_id,
          product_id,
          quantity,
          status || 'Ativo',
          notes || null,
          user_id || null
        );
      } else {
        stmt = db.prepare(`
          INSERT INTO consignments (client_id, product_id, quantity, status, notes)
          VALUES (?, ?, ?, ?, ?)
        `);
        result = stmt.run(
          client_id,
          product_id,
          quantity,
          status || 'Ativo',
          notes || null
        );
      }
      
      const consignmentId = result.lastInsertRowid;
      
      // Criar movimentação de saída
      try {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movements'").get();
        if (tables) {
          const movementStmt = db.prepare(`
            INSERT INTO stock_movements (product_id, type, quantity, reference_type, reference_id, notes)
            VALUES (?, 'saida', ?, 'consignacao', ?, ?)
          `);
          movementStmt.run(
            product_id,
            quantity,
            consignmentId,
            `Consignação #${consignmentId}`
          );
        }
      } catch (error) {
        console.warn('⚠️  Erro ao criar movimentação de consignação:', error.message);
      }
      
      const newConsignment = db.prepare('SELECT * FROM consignments WHERE id = ?').get(consignmentId);
      res.status(201).json(newConsignment);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/consignments/:id
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, status, notes } = req.body;
    
    const updates = [];
    const values = [];
    
    if (quantity !== undefined) { updates.push('quantity = ?'); values.push(quantity); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes || null); }
    
    if (updates.length > 0) {
      values.push(id);
      const stmt = db.prepare(`UPDATE consignments SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }
    
    const updatedConsignment = db.prepare('SELECT * FROM consignments WHERE id = ?').get(id);
    res.json(updatedConsignment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/consignments/:id/close
// Encerrar consignação: criar venda e estornar diferença ao estoque
router.post('/:id/close', (req, res) => {
  try {
    const { id } = req.params;
    const { items, total, date, notes } = req.body;
    
    // Buscar consignação
    const consignment = db.prepare('SELECT * FROM consignments WHERE id = ?').get(id);
    if (!consignment) {
      return res.status(404).json({ error: 'Consignação não encontrada' });
    }
    
    // Validar que está ativo
    if (consignment.status !== 'Ativo' && consignment.status !== 'Em Aberto') {
      return res.status(400).json({ error: 'Apenas consignações ativas podem ser encerradas' });
    }
    
    // Verificar se a tabela consignment_items existe
    let hasItemsTable = false;
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='consignment_items'").get();
      hasItemsTable = !!tables;
    } catch (error) {
      return res.status(500).json({ error: 'Sistema de múltiplos itens não está disponível' });
    }
    
    if (!hasItemsTable) {
      return res.status(500).json({ error: 'Sistema de múltiplos itens não está disponível' });
    }
    
    // Buscar itens da consignação
    const consignmentItems = db.prepare(`
      SELECT ci.*, p.name as product_name
      FROM consignment_items ci
      LEFT JOIN products p ON ci.product_id = p.id
      WHERE ci.consignment_id = ?
    `).all(id);
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'É necessário informar os itens baixados' });
    }
    
    // Validar itens baixados
    for (const soldItem of items) {
      const consignmentItem = consignmentItems.find(ci => ci.product_id === soldItem.product_id);
      if (!consignmentItem) {
        return res.status(400).json({ error: `Produto ${soldItem.product_id} não encontrado na consignação` });
      }
      
      if (soldItem.quantity_sold === undefined || soldItem.quantity_sold < 0) {
        return res.status(400).json({ error: 'Quantidade baixada deve ser informada e maior ou igual a zero' });
      }
      
      if (soldItem.quantity_sold > consignmentItem.quantity) {
        return res.status(400).json({ 
          error: `Quantidade baixada (${soldItem.quantity_sold}) não pode ser maior que a consignada (${consignmentItem.quantity})` 
        });
      }
    }
    
    // Criar venda
    const saleDate = date || new Date().toISOString();
    
    // Verificar se a coluna user_id existe em sales
    const saleColumns = db.prepare('PRAGMA table_info(sales)').all();
    const hasSaleUserId = saleColumns.some(col => col.name === 'user_id');
    
    // Usar o user_id da consignação original (se existir)
    const consignmentUserId = consignment.user_id || null;
    
    let saleStmt;
    let saleResult;
    
    // Preparar notas da venda: sempre usar a mensagem padrão indicando que veio da consignação
    // As observações editadas na consignação ficam na consignação, não na venda
    const saleNotes = `Venda gerada a partir da consignação #${id}`;
    
    if (hasSaleUserId) {
      saleStmt = db.prepare(`
        INSERT INTO sales (client_id, total, date, status, notes, user_id)
        VALUES (?, ?, ?, 'Pendente', ?, ?)
      `);
      saleResult = saleStmt.run(
        consignment.client_id,
        total || 0,
        saleDate,
        saleNotes,
        consignmentUserId
      );
    } else {
      saleStmt = db.prepare(`
        INSERT INTO sales (client_id, total, date, status, notes)
        VALUES (?, ?, ?, 'Pendente', ?)
      `);
      saleResult = saleStmt.run(
        consignment.client_id,
        total || 0,
        saleDate,
        saleNotes
      );
    }
    
    const saleId = saleResult.lastInsertRowid;
    
    // Criar itens da venda e estornar diferença ao estoque
    const saleItemStmt = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, quantity, price, subtotal)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    // Verificar se stock_movements existe
    let hasStockMovements = false;
    let movementStmt = null;
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movements'").get();
      hasStockMovements = !!tables;
      if (hasStockMovements) {
        movementStmt = db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantity, reference_type, reference_id, notes)
          VALUES (?, 'entrada', ?, 'consignacao', ?, ?)
        `);
      }
    } catch (error) {
      // Tabela não existe
    }
    
    let totalClosedQuantity = 0;
    
    for (const soldItem of items) {
      const consignmentItem = consignmentItems.find(ci => ci.product_id === soldItem.product_id);
      const quantitySold = parseFloat(soldItem.quantity_sold || 0);
      const price = parseFloat(soldItem.price || consignmentItem.price);
      const subtotal = quantitySold * price;
      
      // Criar item da venda
      saleItemStmt.run(
        saleId,
        soldItem.product_id,
        quantitySold,
        price,
        subtotal
      );
      
      // Calcular diferença e estornar ao estoque
      const difference = consignmentItem.quantity - quantitySold;
      if (difference > 0 && movementStmt) {
        // Estornar diferença (criar entrada)
        movementStmt.run(
          soldItem.product_id,
          difference,
          id,
          `Estorno de consignação #${id} (diferença não vendida)`
        );
      }
      
      totalClosedQuantity += quantitySold;
    }
    
    // Criar conta a receber vinculada à venda
    try {
      const columns = db.prepare('PRAGMA table_info(accounts_receivable)').all();
      const hasSaleId = columns.some(col => col.name === 'sale_id');
      
      // Usar due_date do request se fornecido, senão calcular (data + 30 dias)
      let accountDueDate;
      if (req.body.due_date) {
        accountDueDate = req.body.due_date;
      } else {
        const saleDateObj = new Date(saleDate);
        const calculatedDueDate = new Date(saleDateObj);
        calculatedDueDate.setDate(calculatedDueDate.getDate() + 30);
        // Formatar data no formato YYYY-MM-DD usando horário local (não UTC)
        const year = calculatedDueDate.getFullYear();
        const month = String(calculatedDueDate.getMonth() + 1).padStart(2, '0');
        const day = String(calculatedDueDate.getDate()).padStart(2, '0');
        accountDueDate = `${year}-${month}-${day}`;
      }
      
      const description = `Venda #${saleId} - Consignação #${id} - ${items.length} item(ns)`;
      
      if (hasSaleId) {
        const accountStmt = db.prepare(`
          INSERT INTO accounts_receivable (client_id, description, value, due_date, status, sale_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        accountStmt.run(
          consignment.client_id || null,
          description,
          total || 0,
          accountDueDate,
          'Pendente',
          saleId
        );
      } else {
        const accountStmt = db.prepare(`
          INSERT INTO accounts_receivable (client_id, description, value, due_date, status)
          VALUES (?, ?, ?, ?, ?)
        `);
        accountStmt.run(
          consignment.client_id || null,
          description,
          total || 0,
          accountDueDate,
          'Pendente'
        );
      }
    } catch (error) {
      console.warn('⚠️  Erro ao criar conta a receber:', error.message);
    }
    
    // Atualizar consignação
    const updates = ['status = ?'];
    const values = ['Encerrado'];
    
    // Se notes foi fornecido no fechamento, atualizar as observações da consignação
    if (notes !== null && notes !== undefined && notes.trim() !== '') {
      updates.push('notes = ?');
      values.push(notes.trim());
    }
    
    // Verificar se campos de encerramento existem
    const columns = db.prepare('PRAGMA table_info(consignments)').all();
    const hasClosedQty = columns.some(col => col.name === 'closed_quantity');
    const hasClosedTotal = columns.some(col => col.name === 'closed_total');
    const hasSaleId = columns.some(col => col.name === 'sale_id');
    
    if (hasClosedQty) {
      updates.push('closed_quantity = ?');
      values.push(totalClosedQuantity);
    }
    if (hasClosedTotal) {
      updates.push('closed_total = ?');
      values.push(total || 0);
    }
    if (hasSaleId) {
      updates.push('sale_id = ?');
      values.push(saleId);
    }
    
    values.push(id);
    const updateStmt = db.prepare(`UPDATE consignments SET ${updates.join(', ')} WHERE id = ?`);
    updateStmt.run(...values);
    
    // Retornar venda criada
    const newSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
    
    res.status(201).json({ ...newSale, items: saleItems });
  } catch (error) {
    console.error('❌ Erro ao encerrar consignação:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/consignments/:id
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar consignação para verificar status
    const consignment = db.prepare('SELECT * FROM consignments WHERE id = ?').get(id);
    if (!consignment) {
      return res.status(404).json({ error: 'Consignação não encontrada' });
    }
    
    // Não permitir deletar consignações encerradas
    if (consignment.status === 'Encerrado') {
      return res.status(400).json({ error: 'Não é possível deletar consignações encerradas' });
    }
    
    // Verificar se a tabela consignment_items existe
    let hasItemsTable = false;
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='consignment_items'").get();
      hasItemsTable = !!tables;
    } catch (error) {
      // Tabela não existe
    }
    
    if (hasItemsTable) {
      // Buscar itens da consignação antes de deletar para reverter estoque
      const consignmentItems = db.prepare('SELECT * FROM consignment_items WHERE consignment_id = ?').all(id);
      
      // Reverter movimentações de saída (criar entradas equivalentes)
      try {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movements'").get();
        if (tables) {
          const movementStmt = db.prepare(`
            INSERT INTO stock_movements (product_id, type, quantity, reference_type, reference_id, notes)
            VALUES (?, 'entrada', ?, 'consignacao', ?, ?)
          `);
          for (const item of consignmentItems) {
            movementStmt.run(
              item.product_id,
              item.quantity,
              id,
              `Cancelamento de consignação #${id}`
            );
          }
        }
      } catch (error) {
        console.warn('⚠️  Erro ao reverter movimentações:', error.message);
      }
      
      // Deletar itens primeiro (CASCADE vai deletar automaticamente, mas é bom ser explícito)
      db.prepare('DELETE FROM consignment_items WHERE consignment_id = ?').run(id);
    } else {
      // Modo antigo: buscar itens da consignação única
      // (consignment já foi buscado acima)
      if (consignment) {
        // Reverter movimentação de saída (criar entrada equivalente)
        try {
          const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movements'").get();
          if (tables) {
            const movementStmt = db.prepare(`
              INSERT INTO stock_movements (product_id, type, quantity, reference_type, reference_id, notes)
              VALUES (?, 'entrada', ?, 'consignacao', ?, ?)
            `);
            movementStmt.run(
              consignment.product_id,
              consignment.quantity,
              id,
              `Cancelamento de consignação #${id}`
            );
          }
        } catch (error) {
          console.warn('⚠️  Erro ao reverter movimentação:', error.message);
        }
      }
    }
    
    db.prepare('DELETE FROM consignments WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

