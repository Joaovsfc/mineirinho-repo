// ============================================
// Utilitário para cálculo de preços por faixa
// ============================================

const db = require('../database/db.cjs');

/**
 * Obtém o preço de um produto baseado na faixa do cliente
 * @param {number} productId - ID do produto
 * @param {number} clientPriceTier - Faixa de preço do cliente (1-4)
 * @returns {number|null} - Preço do produto para a faixa especificada, ou null se produto não existir
 */
function getProductPriceByTier(productId, clientPriceTier) {
  try {
    // Validar faixa de preço (deve ser entre 1 e 4)
    const tier = parseInt(clientPriceTier);
    if (isNaN(tier) || tier < 1 || tier > 4) {
      // Se faixa inválida, retornar preço padrão
      const product = db.prepare('SELECT price FROM products WHERE id = ?').get(productId);
      return product ? parseFloat(product.price || 0) : null;
    }
    
    // Buscar produto com todas as faixas de preço
    const product = db.prepare(`
      SELECT price_tier_1, price_tier_2, price_tier_3, price_tier_4, price 
      FROM products 
      WHERE id = ?
    `).get(productId);
    
    if (!product) {
      return null;
    }
    
    // Retornar preço da faixa específica, ou preço padrão se não houver
    const tierColumn = `price_tier_${tier}`;
    const tierPrice = product[tierColumn];
    
    // Se a faixa específica tem preço definido, usar ela
    if (tierPrice !== null && tierPrice !== undefined) {
      return parseFloat(tierPrice);
    }
    
    // Caso contrário, usar preço padrão
    return parseFloat(product.price || 0);
  } catch (error) {
    console.error('Erro ao obter preço por faixa:', error);
    // Em caso de erro, tentar retornar preço padrão
    try {
      const product = db.prepare('SELECT price FROM products WHERE id = ?').get(productId);
      return product ? parseFloat(product.price || 0) : null;
    } catch (e) {
      return null;
    }
  }
}

/**
 * Obtém todas as faixas de preço de um produto
 * @param {number} productId - ID do produto
 * @returns {object|null} - Objeto com todas as faixas de preço, ou null se produto não existir
 */
function getProductAllTiers(productId) {
  try {
    const product = db.prepare(`
      SELECT price_tier_1, price_tier_2, price_tier_3, price_tier_4, price 
      FROM products 
      WHERE id = ?
    `).get(productId);
    
    if (!product) {
      return null;
    }
    
    return {
      price_tier_1: product.price_tier_1 !== null && product.price_tier_1 !== undefined 
        ? parseFloat(product.price_tier_1) 
        : parseFloat(product.price || 0),
      price_tier_2: product.price_tier_2 !== null && product.price_tier_2 !== undefined 
        ? parseFloat(product.price_tier_2) 
        : null,
      price_tier_3: product.price_tier_3 !== null && product.price_tier_3 !== undefined 
        ? parseFloat(product.price_tier_3) 
        : null,
      price_tier_4: product.price_tier_4 !== null && product.price_tier_4 !== undefined 
        ? parseFloat(product.price_tier_4) 
        : null,
      price: parseFloat(product.price || 0), // Preço padrão
    };
  } catch (error) {
    console.error('Erro ao obter todas as faixas de preço:', error);
    return null;
  }
}

module.exports = {
  getProductPriceByTier,
  getProductAllTiers,
};
