const express = require('express');
const db = require('../database/db.cjs');

const router = express.Router();

// ==================== Contas a Pagar ====================

// GET /api/accounts/payable
router.get('/payable', (req, res) => {
  try {
    const accounts = db.prepare('SELECT * FROM accounts_payable ORDER BY due_date ASC, created_at DESC').all();
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/accounts/payable/:id
router.get('/payable/:id', (req, res) => {
  try {
    const { id } = req.params;
    const account = db.prepare('SELECT * FROM accounts_payable WHERE id = ?').get(id);
    if (!account) {
      return res.status(404).json({ error: 'Conta a pagar não encontrada' });
    }
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/accounts/payable
router.post('/payable', (req, res) => {
  try {
    const { description, value, due_date, notes } = req.body;
    if (!description || value === undefined || !due_date) {
      return res.status(400).json({ error: 'Descrição, valor e data de vencimento são obrigatórios' });
    }
    const stmt = db.prepare(`
      INSERT INTO accounts_payable (description, value, due_date, notes)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(description, value, due_date, notes || null);
    const newAccount = db.prepare('SELECT * FROM accounts_payable WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newAccount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/accounts/payable/:id
router.put('/payable/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { description, value, due_date, status, paid_date, notes, payment_method } = req.body;
    
    const updates = [];
    const values = [];
    
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (value !== undefined) { updates.push('value = ?'); values.push(value); }
    if (due_date !== undefined) { updates.push('due_date = ?'); values.push(due_date); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (paid_date !== undefined) { updates.push('paid_date = ?'); values.push(paid_date); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (payment_method !== undefined) { updates.push('payment_method = ?'); values.push(payment_method); }
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      const stmt = db.prepare(`UPDATE accounts_payable SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }
    
    const updatedAccount = db.prepare('SELECT * FROM accounts_payable WHERE id = ?').get(id);
    res.json(updatedAccount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/accounts/payable/:id
router.delete('/payable/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM accounts_payable WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Contas a Receber ====================

// GET /api/accounts/receivable
router.get('/receivable', (req, res) => {
  try {
    const accounts = db.prepare('SELECT * FROM accounts_receivable ORDER BY due_date ASC, created_at DESC').all();
    // Adicionar informações da venda vinculada, se houver
    const accountsWithSale = accounts.map(account => {
      if (account.sale_id) {
        try {
          const sale = db.prepare('SELECT id, date, total, status FROM sales WHERE id = ?').get(account.sale_id);
          return { ...account, sale };
        } catch (error) {
          return account;
        }
      }
      return account;
    });
    res.json(accountsWithSale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/accounts/receivable/:id
router.get('/receivable/:id', (req, res) => {
  try {
    const { id } = req.params;
    const account = db.prepare('SELECT * FROM accounts_receivable WHERE id = ?').get(id);
    if (!account) {
      return res.status(404).json({ error: 'Conta a receber não encontrada' });
    }
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/accounts/receivable
router.post('/receivable', (req, res) => {
  try {
    const { client_id, description, value, due_date, notes } = req.body;
    if (value === undefined || !due_date) {
      return res.status(400).json({ error: 'Valor e data de vencimento são obrigatórios' });
    }
    const stmt = db.prepare(`
      INSERT INTO accounts_receivable (client_id, description, value, due_date, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      client_id || null,
      description || null,
      value,
      due_date,
      notes || null
    );
    const newAccount = db.prepare('SELECT * FROM accounts_receivable WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newAccount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/accounts/receivable/:id
router.put('/receivable/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { client_id, description, value, due_date, status, received_date, notes, payment_method } = req.body;
    
    // Buscar a conta antes de atualizar para verificar se tem sale_id
    const account = db.prepare('SELECT * FROM accounts_receivable WHERE id = ?').get(id);
    if (!account) {
      return res.status(404).json({ error: 'Conta a receber não encontrada' });
    }
    
    const updates = [];
    const values = [];
    
    if (client_id !== undefined) { updates.push('client_id = ?'); values.push(client_id); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (value !== undefined) { updates.push('value = ?'); values.push(value); }
    if (due_date !== undefined) { updates.push('due_date = ?'); values.push(due_date); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (received_date !== undefined) { updates.push('received_date = ?'); values.push(received_date); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (payment_method !== undefined) { updates.push('payment_method = ?'); values.push(payment_method); }
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      const stmt = db.prepare(`UPDATE accounts_receivable SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }
    
    // Se a conta está vinculada a uma venda e foi marcada como recebida, atualizar a venda também
    if (account.sale_id && status === 'Recebido') {
      try {
        // Verificar se a coluna payment_method existe na tabela sales
        const saleColumns = db.prepare('PRAGMA table_info(sales)').all();
        const hasPaymentMethod = saleColumns.some(col => col.name === 'payment_method');
        
        const saleUpdates = ['status = ?'];
        const saleValues = ['Pago'];
        
        if (hasPaymentMethod && payment_method) {
          saleUpdates.push('payment_method = ?');
          saleValues.push(payment_method);
        }
        
        saleValues.push(account.sale_id);
        const saleStmt = db.prepare(`UPDATE sales SET ${saleUpdates.join(', ')} WHERE id = ?`);
        saleStmt.run(...saleValues);
        
        console.log(`✅ Venda #${account.sale_id} atualizada para "Pago" após recebimento da conta #${id}`);
      } catch (error) {
        console.warn('⚠️  Erro ao atualizar venda vinculada:', error.message);
        // Não falhar a operação se houver erro ao atualizar a venda
      }
    }
    
    const updatedAccount = db.prepare('SELECT * FROM accounts_receivable WHERE id = ?').get(id);
    res.json(updatedAccount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/accounts/receivable/:id
router.delete('/receivable/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM accounts_receivable WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

