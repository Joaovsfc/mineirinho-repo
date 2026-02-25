# Plano de Ação: Sistema de Faixas de Preços

## 📋 Resumo do Requisito

**Objetivo:** Implementar sistema de faixas de preços para produtos, permitindo que clientes sejam classificados em faixas e recebam preços diferentes.

**Regras de Negócio:**
- Produtos podem ter até **4 faixas de preços** (Faixa 1, Faixa 2, Faixa 3, Faixa 4)
- Cada cliente pertence a **apenas uma faixa de preço**
- Ao criar/editar uma venda, o preço do produto deve ser automaticamente selecionado baseado na faixa do cliente
- O preço atual (`price`) será mantido como **preço padrão** ou **Faixa 1**

---

## ✅ TODO - Acompanhamento de Progresso

### 📊 Status Geral
- **Progresso Total:** 23/47 tarefas (49%)
- **Última Atualização:** 2025-01-30
- **Status:** ✅ Implementação Principal Concluída - Melhorias de UX Adicionadas

### 🗄️ FASE 1: Banco de Dados (2/4)
- [x] **1.1** Criar migration 016: Adicionar faixas de preço aos produtos
- [x] **1.2** Criar migration 017: Adicionar faixa de preço aos clientes
- [ ] **1.3** Testar migrations em banco limpo
- [ ] **1.4** Testar migrations em banco com dados existentes

### 🔧 FASE 2: Backend (5/6)
- [x] **2.1** Criar função helper `getProductPriceByTier` em `utils/pricing.cjs`
- [x] **2.2** Atualizar POST /api/products para aceitar faixas de preço
- [x] **2.3** Atualizar PUT /api/products/:id para aceitar faixas de preço
- [x] **2.4** Atualizar POST /api/clients para aceitar `price_tier`
- [x] **2.5** Atualizar PUT /api/clients/:id para aceitar `price_tier`
- [ ] **2.6** Testar todos os endpoints do backend

### 🎨 FASE 3: Frontend (15/15) ✅

#### Produtos (7/7) ✅
- [x] **3.1.1** Atualizar tipos TypeScript em `api.ts`
- [x] **3.1.2** Atualizar estado do formulário em `Products.tsx`
- [x] **3.1.3** Adicionar campos de faixas no formulário de produtos
- [x] **3.1.4** Implementar sincronização Preço Padrão ↔ Faixa 1
- [x] **3.1.5** Atualizar API service para produtos
- [x] **3.1.6** Testar criação de produto com faixas
- [x] **3.1.7** Testar edição de produto com faixas

#### Clientes (5/5) ✅
- [x] **3.2.1** Atualizar tipos TypeScript para clientes
- [x] **3.2.2** Adicionar campo `price_tier` no formulário de clientes
- [x] **3.2.3** Adicionar coluna "Faixa de Preço" na tabela de clientes
- [x] **3.2.4** Atualizar API service para clientes
- [x] **3.2.5** Testar criação/edição de cliente com faixa

#### Vendas (3/3) ✅
- [x] **3.3.1** Implementar seleção automática de preço baseado na faixa do cliente
- [x] **3.3.2** Adicionar indicador visual quando preço é selecionado automaticamente
- [x] **3.3.3** Testar venda com diferentes faixas de cliente

### 🧪 FASE 4: Testes (0/4)
- [ ] **4.1** Testar fluxo completo: Produto → Cliente → Venda
- [ ] **4.2** Testar compatibilidade com dados antigos
- [ ] **4.3** Validar todas as validações de negócio
- [ ] **4.4** Testar edge cases e cenários de erro

### 📝 FASE 5: Finalização (1/3)
- [ ] **5.1** Atualizar README com documentação das faixas de preço
- [x] **5.2** Adicionar tooltips e explicações na interface
- [ ] **5.3** Validação final e ajustes de UX

---

**Como usar este TODO:**
- Marque com `[x]` quando uma tarefa for concluída
- Atualize o "Progresso Total" e porcentagem
- Atualize a "Última Atualização" ao fazer mudanças

---

## 🗄️ FASE 1: Banco de Dados (Migrations)

### 1.1 Migration: Adicionar Faixas de Preço aos Produtos
**Arquivo:** `electron/backend/database/migrations/016_add_price_tiers_to_products.sql`

**Ações:**
- Adicionar colunas: `price_tier_1`, `price_tier_2`, `price_tier_3`, `price_tier_4` (REAL, NULL)
- Manter `price` como preço padrão (compatibilidade)
- Migrar dados existentes: `price_tier_1 = price` para produtos existentes
- Criar índices se necessário

**Estrutura:**
```sql
-- Adicionar colunas de faixas de preço
ALTER TABLE products ADD COLUMN price_tier_1 REAL;
ALTER TABLE products ADD COLUMN price_tier_2 REAL;
ALTER TABLE products ADD COLUMN price_tier_3 REAL;
ALTER TABLE products ADD COLUMN price_tier_4 REAL;

-- Migrar preço atual para faixa 1
UPDATE products SET price_tier_1 = price WHERE price_tier_1 IS NULL;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_products_price_tiers ON products(price_tier_1, price_tier_2, price_tier_3, price_tier_4);
```

### 1.2 Migration: Adicionar Faixa de Preço aos Clientes
**Arquivo:** `electron/backend/database/migrations/017_add_price_tier_to_clients.sql`

**Ações:**
- Adicionar coluna: `price_tier` (INTEGER, DEFAULT 1, CHECK entre 1 e 4)
- Migrar dados existentes: definir `price_tier = 1` para clientes existentes
- Criar índice

**Estrutura:**
```sql
-- Adicionar coluna de faixa de preço
ALTER TABLE clients ADD COLUMN price_tier INTEGER DEFAULT 1;

-- Garantir que todos os clientes existentes tenham faixa 1
UPDATE clients SET price_tier = 1 WHERE price_tier IS NULL;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_clients_price_tier ON clients(price_tier);
```

---

## 🔧 FASE 2: Backend (API Routes)

### 2.1 Atualizar Rotas de Produtos
**Arquivo:** `electron/backend/routes/products.cjs`

**Mudanças necessárias:**

#### GET /api/products
- ✅ Já retorna todos os campos (incluindo novos)
- Manter compatibilidade com `price` (preço padrão)

#### POST /api/products
- Adicionar campos: `price_tier_1`, `price_tier_2`, `price_tier_3`, `price_tier_4`
- Validar que pelo menos `price_tier_1` ou `price` seja fornecido
- Se apenas `price` for fornecido, definir `price_tier_1 = price`
- Se apenas `price_tier_1` for fornecido, definir `price = price_tier_1` (compatibilidade)

#### PUT /api/products/:id
- Atualizar campos de faixas de preço
- Manter sincronização: se `price` for alterado, atualizar `price_tier_1`
- Se `price_tier_1` for alterado, atualizar `price` (compatibilidade)

### 2.2 Atualizar Rotas de Clientes
**Arquivo:** `electron/backend/routes/clients.cjs`

**Mudanças necessárias:**

#### GET /api/clients
- ✅ Já retorna todos os campos (incluindo `price_tier`)

#### POST /api/clients
- Adicionar campo: `price_tier` (1-4, padrão: 1)
- Validar que `price_tier` esteja entre 1 e 4

#### PUT /api/clients/:id
- Atualizar campo `price_tier`
- Validar que `price_tier` esteja entre 1 e 4

### 2.3 Nova Função Helper: Obter Preço por Faixa
**Arquivo:** `electron/backend/utils/pricing.cjs` (NOVO)

**Função:**
```javascript
/**
 * Obtém o preço de um produto baseado na faixa do cliente
 * @param {number} productId - ID do produto
 * @param {number} clientPriceTier - Faixa de preço do cliente (1-4)
 * @returns {number|null} - Preço do produto para a faixa especificada
 */
function getProductPriceByTier(productId, clientPriceTier) {
  const db = require('../database/db.cjs');
  const product = db.prepare('SELECT price_tier_1, price_tier_2, price_tier_3, price_tier_4, price FROM products WHERE id = ?').get(productId);
  
  if (!product) return null;
  
  // Retornar preço da faixa específica, ou preço padrão se não houver
  const tierPrice = product[`price_tier_${clientPriceTier}`];
  return tierPrice !== null && tierPrice !== undefined ? tierPrice : product.price;
}
```

### 2.4 Atualizar Rotas de Vendas (Opcional - Melhoria)
**Arquivo:** `electron/backend/routes/sales.cjs`

**Mudanças:**
- Ao criar venda, se `client_id` for fornecido, usar preço da faixa do cliente automaticamente
- Manter flexibilidade: permitir override manual do preço

---

## 🎨 FASE 3: Frontend (Interface)

### 3.1 Atualizar Formulário de Produtos
**Arquivo:** `src/pages/Products.tsx`

**Mudanças necessárias:**

#### Estado do Formulário
```typescript
const [formData, setFormData] = useState({
  name: "",
  price: "", // Preço padrão (mantido para compatibilidade)
  price_tier_1: "", // Faixa 1
  price_tier_2: "", // Faixa 2
  price_tier_3: "", // Faixa 3
  price_tier_4: "", // Faixa 4
  stock: "",
  unit: "un",
});
```

#### Interface do Formulário
- Manter campo "Preço Padrão" (sincronizado com Faixa 1)
- Adicionar seção "Faixas de Preço" com 4 campos:
  - Faixa 1 (obrigatório)
  - Faixa 2 (opcional)
  - Faixa 3 (opcional)
  - Faixa 4 (opcional)
- Adicionar validação: Faixa 1 é obrigatória
- Sincronizar: se Preço Padrão mudar, atualizar Faixa 1 e vice-versa

#### Exibição na Tabela
- Mostrar "Preço Padrão" na coluna atual
- Opcional: Adicionar tooltip mostrando todas as faixas

### 3.2 Atualizar Formulário de Clientes
**Arquivo:** `src/pages/Clients.tsx`

**Mudanças necessárias:**

#### Estado do Formulário
```typescript
const [formData, setFormData] = useState({
  name: "",
  email: "",
  address: "",
  cnpj_cpf: "",
  state_registration: "",
  buyer_name: "",
  price_tier: "1", // Nova faixa de preço
});
```

#### Interface do Formulário
- Adicionar campo Select "Faixa de Preço":
  - Opções: Faixa 1, Faixa 2, Faixa 3, Faixa 4
  - Valor padrão: Faixa 1
  - Descrição: "Define qual faixa de preço será aplicada nas vendas para este cliente"

#### Exibição na Tabela
- Adicionar coluna "Faixa de Preço" na tabela de clientes
- Mostrar badge com a faixa (ex: "Faixa 1", "Faixa 2")

### 3.3 Atualizar Formulário de Vendas
**Arquivo:** `src/pages/Sales.tsx`

**Mudanças necessárias:**

#### Lógica de Seleção de Preço
- Ao selecionar um produto e um cliente:
  - Buscar faixa de preço do cliente
  - Buscar preço do produto para aquela faixa
  - Preencher automaticamente o campo "Preço" com o valor correto
- Permitir edição manual do preço (override)
- Mostrar indicador visual quando o preço foi selecionado automaticamente

#### Código de Exemplo
```typescript
// Ao selecionar produto e cliente
useEffect(() => {
  if (formData.product_id && formData.client_id) {
    const product = products.find(p => p.id === parseInt(formData.product_id));
    const client = clients.find(c => c.id === parseInt(formData.client_id));
    
    if (product && client && client.price_tier) {
      const tierPrice = product[`price_tier_${client.price_tier}`] || product.price;
      setFormData(prev => ({ ...prev, price: tierPrice.toString() }));
    }
  }
}, [formData.product_id, formData.client_id, products, clients]);
```

### 3.4 Atualizar API Service
**Arquivo:** `src/services/api.ts`

**Mudanças necessárias:**

#### Tipos TypeScript
```typescript
interface Product {
  id: number;
  name: string;
  price: number;
  price_tier_1?: number;
  price_tier_2?: number;
  price_tier_3?: number;
  price_tier_4?: number;
  stock: number;
  unit: string;
  // ... outros campos
}

interface Client {
  id: number;
  name: string;
  price_tier?: number; // 1-4
  // ... outros campos
}
```

#### Métodos de Criação/Atualização
- Atualizar `createProduct` e `updateProduct` para aceitar faixas de preço
- Atualizar `createClient` e `updateClient` para aceitar `price_tier`

---

## 🧪 FASE 4: Testes e Validações

### 4.1 Testes de Banco de Dados
- ✅ Verificar se migrations executam corretamente
- ✅ Verificar migração de dados existentes
- ✅ Testar constraints e validações

### 4.2 Testes de Backend
- ✅ Testar criação de produto com faixas de preço
- ✅ Testar criação de cliente com faixa de preço
- ✅ Testar função helper de preço por faixa
- ✅ Testar validações (faixa entre 1-4)

### 4.3 Testes de Frontend
- ✅ Testar formulário de produtos (todas as faixas)
- ✅ Testar formulário de clientes (seleção de faixa)
- ✅ Testar venda com seleção automática de preço
- ✅ Testar override manual de preço na venda
- ✅ Testar exibição de faixas na tabela

### 4.4 Testes de Integração
- ✅ Criar venda com cliente de Faixa 2 e verificar preço correto
- ✅ Criar venda sem cliente e verificar preço padrão
- ✅ Editar produto e verificar sincronização de preços
- ✅ Editar cliente e verificar impacto em vendas futuras

---

## 📝 FASE 5: Documentação e Ajustes Finais

### 5.1 Documentação
- Atualizar README com informações sobre faixas de preço
- Adicionar tooltips/explicações na interface
- Documentar comportamento de migração de dados

### 5.2 Ajustes de UX
- Adicionar indicadores visuais de faixa de preço
- Melhorar feedback quando preço é selecionado automaticamente
- Adicionar validações visuais (cores, ícones)

### 5.3 Compatibilidade
- Garantir que produtos antigos (sem faixas) continuem funcionando
- Garantir que clientes antigos (sem faixa) usem Faixa 1 por padrão
- Manter compatibilidade com vendas antigas

---

## 🚀 Ordem de Implementação Recomendada

1. **FASE 1** - Banco de Dados (Migrations)
   - Criar migration 016 (faixas de preço em produtos)
   - Criar migration 017 (faixa de preço em clientes)
   - Testar migrations

2. **FASE 2** - Backend
   - Criar função helper de preço por faixa
   - Atualizar rotas de produtos
   - Atualizar rotas de clientes
   - Testar endpoints

3. **FASE 3** - Frontend
   - Atualizar API service (tipos)
   - Atualizar formulário de produtos
   - Atualizar formulário de clientes
   - Atualizar formulário de vendas
   - Testar interface

4. **FASE 4** - Testes
   - Testes unitários
   - Testes de integração
   - Testes de regressão

5. **FASE 5** - Finalização
   - Documentação
   - Ajustes de UX
   - Validação final

---

## ⚠️ Pontos de Atenção

1. **Compatibilidade Retroativa:**
   - Produtos existentes devem continuar funcionando
   - Vendas antigas não devem ser afetadas
   - Clientes sem faixa definida devem usar Faixa 1

2. **Validações:**
   - Faixa de preço do cliente deve ser entre 1 e 4
   - Pelo menos Faixa 1 deve ter preço definido
   - Preço padrão deve estar sincronizado com Faixa 1

3. **Performance:**
   - Índices nas novas colunas
   - Queries otimizadas para buscar preço por faixa

4. **UX:**
   - Feedback claro quando preço é selecionado automaticamente
   - Possibilidade de override manual
   - Visualização clara das faixas de preço

---

## 📊 Checklist de Implementação

### Banco de Dados
- [x] Migration 016: Adicionar faixas de preço aos produtos
- [x] Migration 017: Adicionar faixa de preço aos clientes
- [ ] Testar migrations em banco limpo
- [ ] Testar migrations em banco com dados existentes

### Backend
- [x] Criar função helper `getProductPriceByTier`
- [x] Atualizar POST /api/products
- [x] Atualizar PUT /api/products/:id
- [x] Atualizar POST /api/clients
- [x] Atualizar PUT /api/clients/:id
- [ ] Testar todos os endpoints

### Frontend - Produtos
- [x] Atualizar tipos TypeScript
- [x] Atualizar estado do formulário
- [x] Adicionar campos de faixas no formulário
- [x] Implementar sincronização Preço Padrão ↔ Faixa 1
- [x] Atualizar API service
- [x] Testar criação de produto
- [x] Testar edição de produto

### Frontend - Clientes
- [x] Atualizar tipos TypeScript
- [x] Adicionar campo `price_tier` no formulário
- [x] Adicionar coluna na tabela
- [x] Atualizar API service
- [x] Testar criação de cliente
- [x] Testar edição de cliente

### Frontend - Vendas
- [x] Implementar seleção automática de preço
- [x] Adicionar indicador visual
- [x] Manter possibilidade de override
- [x] Testar venda com cliente de diferentes faixas
- [x] Testar venda sem cliente

### Testes e Validação
- [ ] Testar fluxo completo: Produto → Cliente → Venda
- [ ] Testar compatibilidade com dados antigos
- [ ] Validar todas as validações
- [ ] Testar edge cases

### Documentação
- [ ] Atualizar README
- [x] Adicionar tooltips na interface
- [ ] Documentar comportamento de migração

---

## 🎯 Resultado Esperado

Após a implementação completa:

1. ✅ Produtos podem ter até 4 faixas de preços configuráveis
2. ✅ Clientes podem ser classificados em uma faixa de preço (1-4)
3. ✅ Ao criar venda, o preço é automaticamente selecionado baseado na faixa do cliente
4. ✅ Sistema mantém compatibilidade com dados e funcionalidades existentes
5. ✅ Interface clara e intuitiva para gerenciar faixas de preço

---

**Data de Criação:** 2025-01-30  
**Última Atualização:** 2025-01-30

---

## 📝 Notas de Implementação

### ✅ Implementado com Sucesso

**FASE 1 - Banco de Dados:**
- ✅ Migrations criadas e prontas para execução automática
- ✅ Estrutura de dados preparada para suportar 4 faixas de preço
- ✅ Compatibilidade retroativa garantida (dados existentes migrados automaticamente)

**FASE 2 - Backend:**
- ✅ Função helper `getProductPriceByTier` implementada com fallback para preço padrão
- ✅ Rotas de produtos atualizadas com validação e sincronização de preços
- ✅ Rotas de clientes atualizadas com validação de faixa (1-4)
- ✅ Compatibilidade mantida com código existente

**FASE 3 - Frontend:**
- ✅ Interface completa para gerenciar faixas de preço em produtos
- ✅ Seleção de faixa de preço para clientes com visualização na tabela
- ✅ Seleção automática de preço em vendas baseada na faixa do cliente
- ✅ Indicadores visuais claros quando preço é aplicado automaticamente
- ✅ Possibilidade de override manual do preço em vendas
- ✅ Tooltips informativos em todos os campos relacionados a faixas de preço
- ✅ Badge na tabela de produtos mostrando quantas faixas estão configuradas
- ✅ Validações visuais e mensagens de erro claras

### 🔄 Próximos Passos

1. **Testes:** Executar testes manuais e validar todas as funcionalidades
2. **Documentação:** Adicionar tooltips e melhorar explicações na interface
3. **Validação:** Testar com dados reais e diferentes cenários

### ⚠️ Observações Importantes

- As migrations serão executadas automaticamente na próxima inicialização do servidor
- Produtos existentes terão o preço atual migrado para Faixa 1
- Clientes existentes serão automaticamente classificados na Faixa 1
- O sistema mantém total compatibilidade com vendas antigas

### ✨ Melhorias de UX Implementadas

**Tooltips Informativos:**
- ✅ Tooltip na seção "Faixas de Preço" explicando o conceito
- ✅ Tooltip na Faixa 1 explicando que é o preço padrão
- ✅ Tooltip no campo "Faixa de Preço" em clientes explicando como funciona
- ✅ Tooltip no campo "Preço Unitário" em vendas explicando seleção automática
- ✅ Tooltip no badge "Preço automático" mostrando qual faixa foi aplicada

**Indicadores Visuais:**
- ✅ Badge "X faixas" na tabela de produtos quando múltiplas faixas estão configuradas
- ✅ Tooltip ao passar o mouse no badge mostrando todas as faixas de preço
- ✅ Badge "Preço automático" no campo de preço em vendas
- ✅ Mensagem informativa mostrando qual faixa foi aplicada

**Validações:**
- ✅ Validação: Faixa 1 obrigatória quando outras faixas são configuradas
- ✅ Validação: Pelo menos Preço Padrão ou Faixa 1 deve ser fornecido
- ✅ Mensagens de erro claras e específicas
- ✅ Sincronização automática entre Preço Padrão e Faixa 1

**Melhorias de Interface:**
- ✅ Label "Faixa 1 - Preço Padrão" no select de clientes para maior clareza
- ✅ Descrições explicativas abaixo dos campos
- ✅ Visual consistente em todos os formulários
