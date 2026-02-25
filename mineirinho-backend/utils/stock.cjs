// ============================================
// Utilitário para cálculo de estoque
// ============================================

const db = require('../database/db.cjs');

/**
 * Calcula o estoque atual de um produto baseado em movimentações
 * @param {number} productId - ID do produto
 * @returns {number} - Estoque atual
 */
function calculateCurrentStock(productId) {
  try {
    // Verificar se a tabela stock_movements existe
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movements'").get();
    if (!tables) {
      // Se não existe, retornar o estoque da tabela products
      const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId);
      return product ? parseFloat(product.stock || 0) : 0;
    }
    
    // Calcular estoque: somar entradas e subtrair saídas
    const movements = db.prepare(`
      SELECT type, SUM(quantity) as total
      FROM stock_movements
      WHERE product_id = ?
      GROUP BY type
    `).all(productId);
    
    let stock = 0;
    movements.forEach(mov => {
      if (mov.type === 'entrada') {
        stock += parseFloat(mov.total || 0);
      } else if (mov.type === 'saida') {
        stock -= parseFloat(mov.total || 0);
      }
    });
    
    return stock;
  } catch (error) {
    // Em caso de erro, retornar estoque da tabela products
    try {
      const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId);
      return product ? parseFloat(product.stock || 0) : 0;
    } catch (e) {
      return 0;
    }
  }
}

/**
 * Valida se há estoque suficiente para uma quantidade
 * @param {number} productId - ID do produto
 * @param {number} quantity - Quantidade necessária
 * @returns {object} - { valid: boolean, available: number, required: number }
 */
function validateStock(productId, quantity) {
  const available = calculateCurrentStock(productId);
  const required = parseFloat(quantity || 0);
  
  return {
    valid: available >= required,
    available,
    required,
    productId,
  };
}

module.exports = {
  calculateCurrentStock,
  validateStock,
};

