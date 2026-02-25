const express = require('express');
const db = require('../database/db.cjs');

const router = express.Router();

// GET /api/clients
router.get('/', (req, res) => {
  try {
    const clients = db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
    // Buscar telefones para cada cliente
    const clientsWithPhones = clients.map(client => {
      const phones = db.prepare('SELECT * FROM client_phones WHERE client_id = ? ORDER BY id').all(client.id);
      return {
        ...client,
        phones: phones
      };
    });
    res.json(clientsWithPhones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/clients/:id
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    // Buscar telefones do cliente
    const phones = db.prepare('SELECT * FROM client_phones WHERE client_id = ? ORDER BY id').all(id);
    res.json({
      ...client,
      phones: phones
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/clients
router.post('/', (req, res) => {
  try {
    const { name, email, address, cnpj_cpf, state_registration, buyer_name, phones, price_tier } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    
    // Validar faixa de preço (deve ser entre 1 e 4)
    let finalPriceTier = 1; // Padrão: Faixa 1
    if (price_tier !== undefined && price_tier !== null) {
      const tier = parseInt(price_tier);
      if (isNaN(tier) || tier < 1 || tier > 4) {
        return res.status(400).json({ error: 'Faixa de preço deve ser entre 1 e 4' });
      }
      finalPriceTier = tier;
    }
    
    // Verificar se a coluna price_tier existe
    const columns = db.prepare('PRAGMA table_info(clients)').all();
    const hasPriceTier = columns.some(col => col.name === 'price_tier');
    
    // Inserir cliente
    let result;
    if (hasPriceTier) {
      const stmt = db.prepare(`
        INSERT INTO clients (name, email, address, cnpj_cpf, state_registration, buyer_name, price_tier)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      result = stmt.run(
        name, 
        email || null, 
        address || null,
        cnpj_cpf || null,
        state_registration || null,
        buyer_name || null,
        finalPriceTier
      );
    } else {
      // Fallback: inserir sem price_tier (compatibilidade)
      const stmt = db.prepare(`
        INSERT INTO clients (name, email, address, cnpj_cpf, state_registration, buyer_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      result = stmt.run(
        name, 
        email || null, 
        address || null,
        cnpj_cpf || null,
        state_registration || null,
        buyer_name || null
      );
    }
    const clientId = result.lastInsertRowid;
    
    // Inserir telefones se fornecidos
    if (phones && Array.isArray(phones) && phones.length > 0) {
      const phoneStmt = db.prepare(`
        INSERT INTO client_phones (client_id, phone, phone_type)
        VALUES (?, ?, ?)
      `);
      for (const phone of phones) {
        if (phone.phone && phone.phone.trim() !== '') {
          phoneStmt.run(clientId, phone.phone, phone.phone_type || 'Principal');
        }
      }
    }
    
    // Buscar cliente completo com telefones
    const newClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
    const clientPhones = db.prepare('SELECT * FROM client_phones WHERE client_id = ? ORDER BY id').all(clientId);
    
    res.status(201).json({
      ...newClient,
      phones: clientPhones
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/clients/:id
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, address, cnpj_cpf, state_registration, buyer_name, phones, price_tier } = req.body;
    
    // Verificar se cliente existe
    const existingClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!existingClient) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    
    // Validar faixa de preço se fornecida
    let finalPriceTier = existingClient.price_tier || 1;
    if (price_tier !== undefined && price_tier !== null) {
      const tier = parseInt(price_tier);
      if (isNaN(tier) || tier < 1 || tier > 4) {
        return res.status(400).json({ error: 'Faixa de preço deve ser entre 1 e 4' });
      }
      finalPriceTier = tier;
    }
    
    // Verificar se a coluna price_tier existe
    const columns = db.prepare('PRAGMA table_info(clients)').all();
    const hasPriceTier = columns.some(col => col.name === 'price_tier');
    
    // Atualizar cliente
    if (hasPriceTier) {
      const stmt = db.prepare(`
        UPDATE clients 
        SET name = ?, email = ?, address = ?, cnpj_cpf = ?, state_registration = ?, buyer_name = ?, price_tier = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(
        name !== undefined ? name : existingClient.name, 
        email !== undefined ? (email || null) : existingClient.email, 
        address !== undefined ? (address || null) : existingClient.address,
        cnpj_cpf !== undefined ? (cnpj_cpf || null) : existingClient.cnpj_cpf,
        state_registration !== undefined ? (state_registration || null) : existingClient.state_registration,
        buyer_name !== undefined ? (buyer_name || null) : existingClient.buyer_name,
        finalPriceTier,
        id
      );
    } else {
      // Fallback: atualizar sem price_tier (compatibilidade)
      const stmt = db.prepare(`
        UPDATE clients 
        SET name = ?, email = ?, address = ?, cnpj_cpf = ?, state_registration = ?, buyer_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(
        name !== undefined ? name : existingClient.name, 
        email !== undefined ? (email || null) : existingClient.email, 
        address !== undefined ? (address || null) : existingClient.address,
        cnpj_cpf !== undefined ? (cnpj_cpf || null) : existingClient.cnpj_cpf,
        state_registration !== undefined ? (state_registration || null) : existingClient.state_registration,
        buyer_name !== undefined ? (buyer_name || null) : existingClient.buyer_name,
        id
      );
    }
    
    // Atualizar telefones: deletar todos e inserir novamente
    db.prepare('DELETE FROM client_phones WHERE client_id = ?').run(id);
    
    if (phones && Array.isArray(phones) && phones.length > 0) {
      const phoneStmt = db.prepare(`
        INSERT INTO client_phones (client_id, phone, phone_type)
        VALUES (?, ?, ?)
      `);
      for (const phone of phones) {
        if (phone.phone && phone.phone.trim() !== '') {
          phoneStmt.run(id, phone.phone, phone.phone_type || 'Principal');
        }
      }
    }
    
    // Buscar cliente atualizado com telefones
    const updatedClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    const clientPhones = db.prepare('SELECT * FROM client_phones WHERE client_id = ? ORDER BY id').all(id);
    
    res.json({
      ...updatedClient,
      phones: clientPhones
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/clients/:id
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM clients WHERE id = ?');
    stmt.run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

