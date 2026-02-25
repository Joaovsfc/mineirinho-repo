const express = require('express');
const db = require('../database/db.cjs');
const { validateStock } = require('../utils/stock.cjs');

const router = express.Router();

// GET /api/sales
router.get('/', (req, res) => {
  try {
    const sales = db.prepare('SELECT * FROM sales ORDER BY date DESC').all();
    
    // Verificar se a coluna sale_id existe em accounts_receivable
    let hasSaleId = false;
    try {
      const columns = db.prepare('PRAGMA table_info(accounts_receivable)').all();
      hasSaleId = columns.some(col => col.name === 'sale_id');
    } catch (error) {
      // Ignorar erro
    }
    
    // Adicionar conta a receber vinculada (se existir)
    const salesWithAccount = sales.map(sale => {
      if (hasSaleId) {
        const account = db.prepare('SELECT due_date FROM accounts_receivable WHERE sale_id = ?').get(sale.id);
        if (account) {
          return { ...sale, account_due_date: account.due_date };
        }
      }
      return sale;
    });
    
    res.json(salesWithAccount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sales/:id
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!sale) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }
    
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
    
    // Verificar se a coluna sale_id existe em accounts_receivable
    let accountDueDate = null;
    try {
      const columns = db.prepare('PRAGMA table_info(accounts_receivable)').all();
      const hasSaleId = columns.some(col => col.name === 'sale_id');
      if (hasSaleId) {
        const account = db.prepare('SELECT due_date FROM accounts_receivable WHERE sale_id = ?').get(id);
        if (account) {
          accountDueDate = account.due_date;
        }
      }
    } catch (error) {
      // Ignorar erro
    }
    
    res.json({ ...sale, items, account_due_date: accountDueDate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sales
router.post('/', (req, res) => {
  try {
    const { client_id, total, items, date, status, notes, user_id, due_date } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'É necessário pelo menos um item na venda' });
    }
    
    // Validar estoque antes de criar a venda
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
    
    // Verificar quais colunas existem
    const columns = db.prepare('PRAGMA table_info(sales)').all();
    const hasUserId = columns.some(col => col.name === 'user_id');
    const hasDueDate = columns.some(col => col.name === 'due_date');
    
    // Inserir venda
    let saleStmt;
    let saleResult;
    
    if (hasUserId && hasDueDate) {
      saleStmt = db.prepare(`
        INSERT INTO sales (client_id, total, date, status, notes, user_id, due_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      saleResult = saleStmt.run(
        client_id || null,
        total,
        date || new Date().toISOString(),
        status || 'Pendente',
        notes || null,
        user_id || null,
        due_date || null
      );
    } else if (hasUserId) {
      saleStmt = db.prepare(`
        INSERT INTO sales (client_id, total, date, status, notes, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      saleResult = saleStmt.run(
        client_id || null,
        total,
        date || new Date().toISOString(),
        status || 'Pendente',
        notes || null,
        user_id || null
      );
    } else if (hasDueDate) {
      saleStmt = db.prepare(`
        INSERT INTO sales (client_id, total, date, status, notes, due_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      saleResult = saleStmt.run(
        client_id || null,
        total,
        date || new Date().toISOString(),
        status || 'Pendente',
        notes || null,
        due_date || null
      );
    } else {
      saleStmt = db.prepare(`
        INSERT INTO sales (client_id, total, date, status, notes)
        VALUES (?, ?, ?, ?, ?)
      `);
      saleResult = saleStmt.run(
        client_id || null,
        total,
        date || new Date().toISOString(),
        status || 'Pendente',
        notes || null
      );
    }
    const saleId = saleResult.lastInsertRowid;
    
    // Inserir itens da venda
    const itemStmt = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, quantity, price, subtotal)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    // Verificar se a tabela stock_movements existe
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movements'").get();
    let movementStmt = null;
    if (tables) {
      movementStmt = db.prepare(`
        INSERT INTO stock_movements (product_id, type, quantity, reference_type, reference_id, notes)
        VALUES (?, 'saida', ?, 'venda', ?, ?)
      `);
    }
    
    for (const item of items) {
      itemStmt.run(saleId, item.product_id, item.quantity, item.price, item.subtotal || (item.quantity * item.price));
      
      // Criar movimentação de saída
      if (movementStmt) {
        movementStmt.run(
          item.product_id,
          item.quantity,
          saleId,
          `Venda #${saleId}`
        );
      }
    }
    
    // Criar conta a receber automaticamente vinculada à venda
    try {
      // Usar due_date da venda se fornecido, senão calcular (30 dias a partir da data da venda)
      let finalDueDate;
      if (due_date) {
        finalDueDate = new Date(due_date);
      } else {
        const saleDate = date ? new Date(date) : new Date();
        finalDueDate = new Date(saleDate);
        finalDueDate.setDate(finalDueDate.getDate() + 30);
      }
      
      // Formatar data no formato YYYY-MM-DD usando horário local (não UTC)
      // Isso garante que a data gravada seja a mesma que o usuário vê na interface
      const formatLocalDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const dueDateStr = formatLocalDate(finalDueDate);
      
      // Descrição da conta a receber
      const description = `Venda #${saleId} - ${items.length} item(ns)`;
      
      // Verificar se a coluna sale_id existe (para compatibilidade com bancos antigos)
      let hasSaleId = false;
      try {
        const columns = db.prepare('PRAGMA table_info(accounts_receivable)').all();
        hasSaleId = columns.some(col => col.name === 'sale_id');
        console.log(`📊 Verificação sale_id: ${hasSaleId ? 'existe' : 'não existe'}`);
      } catch (error) {
        console.warn('⚠️  Erro ao verificar coluna sale_id:', error.message);
      }
      
      // Inserir conta a receber
      if (hasSaleId) {
        console.log(`💰 Criando conta a receber com sale_id=${saleId}`);
        const accountStmt = db.prepare(`
          INSERT INTO accounts_receivable (client_id, description, value, due_date, status, sale_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = accountStmt.run(
          client_id || null,
          description,
          total,
          dueDateStr, // Formato YYYY-MM-DD em horário local
          'Pendente',
          saleId
        );
        console.log(`✅ Conta a receber criada com ID: ${result.lastInsertRowid}, vencimento: ${dueDateStr}`);
      } else {
        console.log(`💰 Criando conta a receber sem sale_id (coluna não existe ainda)`);
        const accountStmt = db.prepare(`
          INSERT INTO accounts_receivable (client_id, description, value, due_date, status)
          VALUES (?, ?, ?, ?, ?)
        `);
        const result = accountStmt.run(
          client_id || null,
          description,
          total,
          dueDateStr, // Formato YYYY-MM-DD em horário local
          'Pendente'
        );
        console.log(`✅ Conta a receber criada com ID: ${result.lastInsertRowid}, vencimento: ${dueDateStr}`);
      }
    } catch (error) {
      // Log detalhado do erro mas não falhar a criação da venda
      console.error('❌ Erro ao criar conta a receber:', error);
      console.error('   Mensagem:', error.message);
      console.error('   Stack:', error.stack);
    }
    
    const newSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
    
    res.status(201).json({ ...newSale, items: saleItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/sales/:id
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status, total, payment_method } = req.body;
    
    const updates = [];
    const values = [];
    
    if (status) {
      updates.push('status = ?');
      values.push(status);
      
      // Se a venda foi marcada como "Pago", marcar conta a receber como recebida
      if (status === 'Pago' || status === 'Paga') {
        try {
          // Verificar se a coluna sale_id existe
          const columns = db.prepare('PRAGMA table_info(accounts_receivable)').all();
          const hasSaleId = columns.some(col => col.name === 'sale_id');
          if (hasSaleId) {
            // Verificar se payment_method existe na tabela accounts_receivable
            const hasPaymentMethod = columns.some(col => col.name === 'payment_method');
            if (hasPaymentMethod && payment_method) {
              const accountStmt = db.prepare(`
                UPDATE accounts_receivable 
                SET status = 'Recebido', received_date = DATE('now'), payment_method = ?
                WHERE sale_id = ? AND status = 'Pendente'
              `);
              accountStmt.run(payment_method, id);
            } else {
              const accountStmt = db.prepare(`
                UPDATE accounts_receivable 
                SET status = 'Recebido', received_date = DATE('now')
                WHERE sale_id = ? AND status = 'Pendente'
              `);
              accountStmt.run(id);
            }
          }
        } catch (error) {
          // Ignorar erro se coluna não existir
          console.warn('⚠️  Aviso ao atualizar conta a receber:', error.message);
        }
      }
    }
    
    if (payment_method !== undefined) {
      updates.push('payment_method = ?');
      values.push(payment_method);
    }
    
    if (total !== undefined) {
      updates.push('total = ?');
      values.push(total);
    }
    
    if (updates.length > 0) {
      values.push(id);
      const stmt = db.prepare(`UPDATE sales SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }
    
    const updatedSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
    
    res.json({ ...updatedSale, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/sales/:id
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar itens da venda antes de deletar para reverter estoque
    const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
    
    // Reverter movimentações de saída (criar entradas equivalentes)
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movements'").get();
      if (tables) {
        const movementStmt = db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantity, reference_type, reference_id, notes)
          VALUES (?, 'entrada', ?, 'venda', ?, ?)
        `);
        for (const item of saleItems) {
          movementStmt.run(
            item.product_id,
            item.quantity,
            id,
            `Cancelamento de venda #${id}`
          );
        }
      }
    } catch (error) {
      console.warn('⚠️  Erro ao reverter movimentações:', error.message);
    }
    
    // Deletar conta a receber vinculada (se houver)
    try {
      // Verificar se a coluna sale_id existe
      const columns = db.prepare('PRAGMA table_info(accounts_receivable)').all();
      const hasSaleId = columns.some(col => col.name === 'sale_id');
      if (hasSaleId) {
        db.prepare('DELETE FROM accounts_receivable WHERE sale_id = ?').run(id);
      }
    } catch (error) {
      // Ignorar erro se coluna não existir
      console.warn('⚠️  Aviso ao deletar conta a receber:', error.message);
    }
    // Deletar itens primeiro (foreign key cascade)
    db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id);
    // Deletar venda
    db.prepare('DELETE FROM sales WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

