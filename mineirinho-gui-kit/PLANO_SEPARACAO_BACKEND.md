# Plano de Separação: Backend como Projeto Independente

**Objetivo:** Extrair o backend de dentro do Electron para um **projeto separado**, que pode rodar em servidor próprio (local ou remoto), enquanto o frontend continua como app Electron ou web.

**Data:** 2025-02-11  
**Relacionado:** [ANALISE_SEPARACAO_FRONTEND_BACKEND.md](./ANALISE_SEPARACAO_FRONTEND_BACKEND.md)

---

## Cenário: Vários PCs com o app + um servidor na rede

**Sua ideia:** Instalar o app Electron em vários PCs (clientes) e rodar **um único backend** em uma máquina conectada à internet/rede. Várias máquinas com o front, uma com o back.

**Resposta:** Sim, **funciona assim**. O plano de separação foi feito exatamente para isso:

```
  [PC 1 - Electron]  ──┐
  [PC 2 - Electron]  ──┼──►  [Servidor]  (Backend + banco)
  [PC 3 - Electron]  ──┘         │
                                 └── Internet/rede (URL da API)
```

Cada instalação do Electron é só o frontend: ele faz todas as requisições para a **mesma URL do servidor** (ex.: `https://sua-api.seudominio.com/api` ou IP da rede). O backend atende todos os clientes e usa um único banco de dados.

**O que você precisa garantir:**

| Ponto | Detalhe |
|-------|--------|
| **URL da API no app** | No build do Electron para distribuir aos clientes, defina `VITE_API_URL` com a URL do seu servidor (ex.: `https://servidor.empresa.com/api`). Assim todo app instalado já aponta para esse servidor. Opcional: tela de “Configurações” no app para o usuário alterar a URL (útil se o IP/servidor mudar). |
| **CORS no servidor** | No backend, `CORS_ORIGINS` deve permitir a origem do Electron. Em produção o Electron carrega `file://`, então o backend já deve aceitar `file://` (como no plano). Se no futuro o front for web, inclua a origem do site. |
| **Rede e firewall** | Os PCs dos clientes precisam **acessar a porta do servidor** (ex.: 443 se usar HTTPS atrás de Nginx). No servidor, libere a porta; nos roteadores/firewall, permitir tráfego do cliente → servidor. |
| **HTTPS em produção** | Na internet, use **HTTPS** (certificado, ex.: Let's Encrypt) e Nginx (ou similar) na frente do Node. Não exponha o Node direto na internet sem HTTPS. |
| **Um banco, um backend** | O servidor roda um único processo do backend e um único banco (SQLite ou, no futuro, PostgreSQL). Todas as estações usam esse mesmo dado. |

Com isso, **várias máquinas com o front e apenas um servidor** funciona como você descreveu.

---

## Configuração mínima: PC físico dedicado ao backend

**Cenário:** Um PC físico fica ligado 24/7 só para rodar o backend (Node.js + Express + SQLite). Sem interface gráfica pesada, sem outros programas.

O backend Mineirinho é leve: um processo Node.js, SQLite no mesmo processo (não é um servidor de banco separado). Abaixo são recomendações para **até ~5–10 usuários simultâneos** (uso típico de CRUD, vendas, relatórios).

### Especificações recomendadas (mínimo confortável)

| Componente | Mínimo recomendado | Observação |
|------------|--------------------|------------|
| **RAM** | **4 GB** | Node.js + SQLite + SO: ~500 MB–1 GB em uso. 4 GB deixa folga para picos, relatórios e o próprio sistema. 2 GB pode servir para 2–3 usuários, mas fica no limite. |
| **Processador** | **2 núcleos** (ou 1 núcleo moderno) | Carga é baixa; não precisa de CPU potente. Qualquer Celeron/Pentium ou equivalente atual costuma ser suficiente. |
| **Armazenamento** | **64 GB SSD** (ou 32 GB se só SO + app) | SO (~15–25 GB) + Node + projeto + banco SQLite (geralmente dezenas de MB) + espaço para logs e backups. SSD melhora resposta do sistema e do banco. |
| **Rede** | Ethernet (cabo) | Mais estável que Wi‑Fi para servidor. Se for acessado só na rede local, 100 Mbps é suficiente. |

**Resumo:** Um PC com **4 GB RAM, 2 núcleos, 64 GB SSD** e **Linux** (ou Windows sem uso pesado) é uma **config mínima recomendada** para rodar esse backend de forma estável com vários clientes.

### Sistema operacional

- **Linux (recomendado):** Ubuntu Server 22.04 LTS ou Debian. Sem interface gráfica, consome pouca RAM; atualizações e manutenção são simples. Ideal para servidor dedicado.
- **Windows:** Windows 10/11 ou Windows Server. Funciona, mas usa mais RAM (~2 GB só o SO). Se for Windows, considere **6 GB RAM** no total para ficar confortável.

### Uso estimado de recursos (referência)

| Item | Uso aproximado |
|------|----------------|
| Node.js + Express + SQLite | ~150–300 MB RAM |
| Sistema (Linux leve) | ~300–500 MB RAM |
| Sistema (Windows) | ~1,5–2 GB RAM |
| **Total (Linux)** | **~0,5–1 GB** em uso normal |
| **Total (Windows)** | **~2–2,5 GB** em uso normal |

### O que evita no servidor

- Não usar o PC para navegar, Office ou jogos ao mesmo tempo.
- Evitar muitos programas em segundo plano; o ideal é só SO + Node (e, se quiser, Nginx, PM2, backup).
- Se usar antivírus no Windows, excluir a pasta do projeto do scan em tempo real para não travar o banco SQLite.

### Resposta direta

**Config mínima recomendada para um PC dedicado só ao backend:**

- **4 GB RAM**
- **2 núcleos** (ou 1 núcleo moderno)
- **64 GB de disco** (de preferência SSD)
- **Linux** (ex.: Ubuntu Server) ou **Windows** (aumentar para 6 GB RAM se for Windows)

Com isso o backend roda bem para vários Electron conectados ao mesmo servidor. Se no futuro o número de usuários ou o tamanho dos relatórios crescer muito, o próximo passo é subir para 8 GB RAM e, se necessário, migrar o banco para PostgreSQL (conforme a análise de separação).

---

## E se quiser usar PostgreSQL?

**Resposta:** Pode usar. O backend deixa de usar SQLite e passa a usar PostgreSQL; o **mesmo PC** (inclusive o Ryzen 3 + 8 GB + 240 GB que você citou) consegue rodar **Node.js + PostgreSQL** juntos. Com 8 GB RAM há folga: a análise considera ~1 GB suficiente para 5 usuários com Node + PostgreSQL no mesmo servidor.

### O que muda no backend

| Aspecto | SQLite (atual) | PostgreSQL |
|--------|-----------------|------------|
| **Driver** | `better-sqlite3` | `pg` (node-postgres) |
| **Conexão** | Um arquivo local, síncrono | Servidor (localhost ou remoto), conexões assíncronas (pool) |
| **Código** | `db.prepare('...').get()` / `.all()` / `.run()` | `pool.query('...', [params])` (async/await) |
| **Migrations** | SQL compatível com SQLite | SQL em sintaxe PostgreSQL (ex.: `AUTOINCREMENT` → `SERIAL`, `REAL` → `NUMERIC`, `DATETIME` → `TIMESTAMP`) |
| **Config** | `DB_PATH` (caminho do arquivo) | `DATABASE_URL` ou `PG_HOST`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE` |

Ou seja: é necessário **trocar o driver**, **reescrever o `database/db.cjs`** (criar pool e expor uma interface de consulta), **alterar todas as rotas** para usar `await pool.query()` em vez de `db.prepare()...`, e **adaptar os arquivos SQL das migrations** para PostgreSQL. A API das rotas (endpoints e JSON) pode permanecer igual; só a camada de banco muda.

Estimativa de esforço (já descrita na análise): **cerca de 25–35 horas** para migração completa, testes e ajustes.

### Configuração no mesmo PC (Node + PostgreSQL)

- **Instalar PostgreSQL** no próprio servidor (Ubuntu: `apt install postgresql`, Windows: instalador oficial).
- **Criar usuário e banco** (ex.: usuário `mineirinho`, banco `mineirinho`).
- No `.env` do backend, usar algo como:
  - `DATABASE_URL=postgresql://mineirinho:senha@localhost:5432/mineirinho`
  - ou `PG_HOST=localhost`, `PG_USER=...`, `PG_PASSWORD=...`, `PG_DATABASE=...`
- O backend (Node) sobe como hoje; ao iniciar, conecta ao PostgreSQL em vez de abrir um arquivo SQLite.

**Recursos no PC:** Com 8 GB RAM, PostgreSQL pode usar por exemplo 256–512 MB; Node mais ~150–300 MB. Sobra RAM para o SO. O Ryzen 3 e o SSD 240 GB continuam suficientes para rodar banco e backend juntos.

### Resumo

- **Pode colocar PostgreSQL:** sim.
- **No mesmo PC físico:** sim; Node + PostgreSQL no Ryzen 3 + 8 GB + 240 GB atende.
- **Trabalho necessário:** trocar driver, adaptar `db.cjs`, rotas e migrations para PostgreSQL (detalhes e esforço na [ANALISE_SEPARACAO_FRONTEND_BACKEND.md](./ANALISE_SEPARACAO_FRONTEND_BACKEND.md)).

### Exportar e importar o banco (PostgreSQL: .sql ou outro formato)

**Hoje (SQLite):** A tela de Backup exporta o banco como arquivo **.db** (binário do SQLite) e importa um .db para restaurar. Tudo em um único arquivo.

**Com PostgreSQL:** Não existe um “arquivo do banco” único como o .db. O equivalente é **export/import em texto ou dump**:

| Operação | SQLite (atual) | PostgreSQL |
|----------|----------------|------------|
| **Exportar** | Ler o arquivo `.db` e enviar no download | Rodar **`pg_dump`** e enviar o resultado: **.sql** (script SQL legível) ou formato custom **.dump** (binário, menor). A rota do backend chama `pg_dump` (ex.: via `child_process`) e devolve o arquivo gerado. |
| **Importar** | Substituir o arquivo `.db` e recriar a conexão | Rodar **`psql`** (para .sql) ou **`pg_restore`** (para .dump) contra o PostgreSQL. A rota recebe o arquivo enviado pelo front, salva temporariamente, executa o comando e depois remove o arquivo. |

**Formatos possíveis com PostgreSQL:**

- **.sql** — script SQL legível (CREATE TABLE, INSERT...). Bom para backup legível e portável. Export: `pg_dump -f backup.sql`. Import: `psql -f backup.sql`.
- **.dump (custom)** — formato binário do pg_dump, menor e mais rápido. Export: `pg_dump -Fc -f backup.dump`. Import: `pg_restore -d mineirinho backup.dump`.

A ideia no backend continua a mesma: uma rota **Exportar** que gera o arquivo (via pg_dump) e envia para download; uma rota **Importar** que recebe o arquivo e restaura (via psql ou pg_restore). O front pode continuar com os mesmos botões “Exportar banco” e “Importar banco”; só o tipo de arquivo muda (`.sql` ou `.dump` em vez de `.db`).

---

## 1. Visão geral do resultado

| Antes | Depois |
|-------|--------|
| Um monorepo: Electron + front (Vite) + backend (dentro de `electron/backend/`) | **Dois projetos:** `mineirinho-frontend` (Electron + React) e `mineirinho-backend` (Express + SQLite) |
| Backend iniciado pelo `main.cjs` do Electron | Backend sobe sozinho (`node server.cjs` ou `npm start`) |
| Banco e paths atados ao Electron (`app.getPath('userData')`) | Banco e paths configuráveis por variáveis de ambiente |
| Front sempre em `http://localhost:3001/api` | Front configurável via `VITE_API_URL` (já existe) |

O frontend continua podendo rodar em Electron (só deixa de subir o backend) ou como SPA em qualquer hospedagem; o backend vira um serviço à parte.

---

## 2. Estrutura do novo projeto backend

Proposta de pasta para o repositório/projeto **mineirinho-backend**:

```
mineirinho-backend/
├── package.json
├── .env.example
├── .env                    # não versionado
├── README.md
├── server.cjs              # ponto de entrada
├── database/
│   ├── db.cjs              # conexão SQLite (sem Electron)
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── ...            # copiar todos os .sql
│       └── 018_add_due_date_to_sales.sql
├── routes/
│   ├── auth.cjs
│   ├── products.cjs
│   ├── clients.cjs
│   ├── sales.cjs
│   ├── accounts.cjs
│   ├── consignments.cjs
│   ├── reports.cjs
│   └── database.cjs
├── utils/
│   ├── pricing.cjs
│   └── stock.cjs
├── middleware/             # (vazio ou futuro auth JWT)
├── controllers/            # (vazio por enquanto)
└── data/                   # opcional: onde criar o .db se DB_PATH for relativo
    └── .gitkeep
```

Não é obrigatório migrar para PostgreSQL nesta etapa: o plano considera **manter SQLite** no backend separado. A migração para PostgreSQL pode ser um projeto posterior (já descrito na análise existente).

---

## 3. Arquivos a criar/copiar e alterações

### 3.1 Criar `mineirinho-backend/package.json`

```json
{
  "name": "mineirinho-backend",
  "version": "1.0.0",
  "description": "API REST - Mineirinho de Ouro",
  "main": "server.cjs",
  "type": "commonjs",
  "scripts": {
    "start": "node server.cjs",
    "dev": "NODE_ENV=development node server.cjs"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^11.7.0",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "multer": "^2.0.2"
  },
  "devDependencies": {
    "@types/node": "^22.16.5"
  },
  "engines": {
    "node": ">=18"
  }
}
```

### 3.2 Criar `mineirinho-backend/.env.example`

```env
# Servidor
PORT=3001
NODE_ENV=development

# Banco de dados (caminho absoluto ou relativo ao process.cwd())
DB_PATH=./data/mineirinho.db

# CORS - origens permitidas separadas por vírgula
# Exemplo: http://localhost:8080,http://localhost:5173,https://meuapp.com
CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,file://
```

### 3.3 Ajustes no backend (arquivos que dependem do Electron)

#### A) `database/db.cjs`

- **Problema:** Usa `require('electron')` e `app.getPath('userData')`.
- **Ação:** Usar apenas variáveis de ambiente e fallback para pasta local do projeto (sem Electron).

Substituir a função `getDbPath()` (e uso) por algo como:

```javascript
// database/db.cjs - versão standalone (sem Electron)
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function getDbPath() {
  const envPath = process.env.DB_PATH;
  if (envPath) {
    const resolved = path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return resolved;
  }
  const dbDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return path.join(dbDir, 'mineirinho.db');
}

const dbPath = getDbPath();
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

if (process.env.NODE_ENV === 'development') {
  console.log(`Database connected at: ${dbPath}`);
}

module.exports = db;
```

#### B) `routes/database.cjs`

- **Problema:** Função `getDbPath()` duplicada e também usa `require('electron')`.
- **Ação:** Usar a mesma lógica baseada em `process.env.DB_PATH` e `process.cwd()`, ou importar um helper de `../database/db.cjs` (por exemplo exportar `getDbPath` de `db.cjs` e usar aqui). O importante é **remover qualquer `require('electron')`** e usar apenas `__dirname`/`process.cwd()`/env.

Exemplo de `getDbPath` alinhado ao backend standalone (sem Electron):

```javascript
function getDbPath() {
  const envPath = process.env.DB_PATH;
  if (envPath) {
    const resolved = path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return resolved;
  }
  const dbDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  return path.join(dbDir, 'mineirinho.db');
}
```

E em `recreateDatabaseConnection()` usar esse `getDbPath()` e recriar a conexão ao arquivo retornado.

#### C) `server.cjs`

- **Porta:** Usar `process.env.PORT || 3001`.
- **CORS:** Ler `process.env.CORS_ORIGINS` e fazer `origin: process.env.CORS_ORIGINS.split(',').map(s => s.trim())` (e manter fallback para `['http://localhost:8080', 'http://127.0.0.1:8080', 'file://']` se a variável não existir).
- **Carregar .env:** Usar `dotenv` em desenvolvimento ou documentar que as variáveis devem ser injetadas (PM2, systemd, Docker). Opcional: `require('dotenv').config()` no topo se adicionar dependência `dotenv`.

Resumo das mudanças em `server.cjs`:

- Trocar `const PORT = 3001` por `const PORT = process.env.PORT || 3001`.
- Trocar `cors({ origin: ['http://localhost:8080', ...] })` por uso de `CORS_ORIGINS` (split + trim).

### 3.4 Copiar sem alteração (ou com path relativo)

- Todos os arquivos em `routes/` exceto `database.cjs` (que precisa do ajuste acima).
- Todos os arquivos em `utils/`.
- Todo o conteúdo de `database/migrations/` (copiar os 18 `.sql`).
- Manter os `require('../database/db.cjs')` e `require('../utils/...')`; no novo projeto a estrutura de pastas é a mesma, então os relativos continuam válidos.

### 3.5 Ponto de entrada do backend

- No projeto novo, o **ponto de entrada** é `server.cjs` na raiz (igual ao atual em `electron/backend/server.cjs`).
- Garantir que `server.cjs` exporta `startServer` e que, quando executado diretamente (`require.main === module`), chama `startServer()` (já está assim no código atual).

---

## 4. Mudanças no projeto frontend (mineirinho-gui-kit)

### 4.1 Electron `main.cjs`

- **Remover** todo o bloco que inicia o backend (trecho em `app.whenReady()` que faz `require(backendPath)` e `startServer()`).
- Manter apenas: criação da janela, carregamento da URL (dev: `http://localhost:8080`, prod: `file://.../dist/index.html`), segurança (will-navigate), limpeza de sessão no close, e `before-quit` (podendo remover o `db.close()` se o backend não rodar mais no processo).

Assim o Electron deixa de ser responsável por subir o backend; o backend passa a ser um processo separado (local ou em servidor).

### 4.2 URL da API (frontend)

- Já existe `VITE_API_URL` em `src/services/api.ts` com fallback `http://localhost:3001/api`.
- Para uso com backend separado:
  - **Desenvolvimento local:** Backend rodando na mesma máquina → manter `http://localhost:3001/api` ou definir no `.env` do front: `VITE_API_URL=http://localhost:3001/api`.
  - **Backend em servidor:** No build do front, definir `VITE_API_URL=https://api.seudominio.com/api` (ou a URL correta). Assim o front (Electron ou SPA) aponta para o servidor.

Nenhuma mudança obrigatória no código do `api.ts`; só configuração por ambiente.

### 4.3 CORS no backend

- No servidor (backend separado), configurar `CORS_ORIGINS` com a origem do frontend (ex.: URL do Electron em produção pode ser `file://`; em dev, `http://localhost:8080`). Isso já está coberto pelo uso de `CORS_ORIGINS` no `server.cjs`.

---

## 5. Ordem sugerida de execução (passo a passo)

### Fase A: Criar o projeto backend (sem ainda desligar o Electron)

1. Criar a pasta do novo projeto, por exemplo `../mineirinho-backend` (ou outro repositório).
2. Criar `package.json`, `.env.example` e `README.md` no backend.
3. Copiar para o novo projeto:
   - `server.cjs` (raiz do backend)
   - `database/` (db.cjs + migrations)
   - `routes/` (todos os arquivos)
   - `utils/`
   - pastas vazias `middleware/`, `controllers/` se quiser manter estrutura.
4. Aplicar em **database/db.cjs** a versão sem Electron (apenas `DB_PATH` / `process.cwd()`).
5. Aplicar em **routes/database.cjs** a lógica de path sem Electron e, se possível, reuso de `getDbPath` de `db.cjs`.
6. Aplicar em **server.cjs** as alterações de `PORT` e `CORS_ORIGINS`.
7. Instalar dependências no backend: `npm install`.
8. Criar `.env` a partir de `.env.example` e rodar `npm run dev` ou `npm start`.
9. Testar com o frontend atual (Electron ainda iniciando o backend na pasta antiga): garantir que as rotas respondem (ex.: `GET /api/health`, `GET /api/products`). Opcional: apontar temporariamente o front para o novo backend (`VITE_API_URL=http://localhost:3001/api`) e testar login e fluxos principais.

### Fase B: Desacoplar o Electron do backend

10. No repositório do frontend (mineirinho-gui-kit), editar `electron/main.cjs`:
    - Remover a inicialização do backend (require do server e `startServer()`).
    - Ajustar `before-quit` se ainda houver referência a `db.close()` do backend (remover ou deixar só se manter um uso local do db no Electron, o que não é o caso após a separação).
11. Documentar no README do frontend:
    - Em dev: é necessário subir o backend manualmente (`cd mineirinho-backend && npm run dev`) e o Vite (`npm run dev`), e então abrir o Electron (`npm run electron:dev` ou equivalente).
    - Em produção: o instalador do Electron não sobe mais o backend; o usuário precisa ter o backend rodando em algum lugar (servidor ou máquina local) e configurar a URL da API (por exemplo via tela de configuração ou variável de ambiente no build).

### Fase C: Opcionais (recomendados para produção)

12. **Autenticação:** Introduzir JWT (ou sessão com cookie) no backend e enviar token no header nas requisições do front; persistir URL da API e token conforme análise em [ANALISE_SEPARACAO_FRONTEND_BACKEND.md](./ANALISE_SEPARACAO_FRONTEND_BACKEND.md).
13. **Deploy do backend:** Colocar o backend em um servidor (ex.: AWS Lightsail, VPS), usar PM2 ou Docker, configurar Nginx + HTTPS e definir `CORS_ORIGINS` e `DB_PATH` em produção.
14. **Migração para PostgreSQL:** Se for necessário múltiplos clientes ou maior robustez, seguir o plano de migração de banco já descrito na análise.

---

## 6. Checklist de separação

### Backend (novo projeto)

- [ ] Criar pasta e `package.json` do projeto backend.
- [ ] Criar `.env.example` e documentar `PORT`, `DB_PATH`, `CORS_ORIGINS`.
- [ ] Copiar `server.cjs`, `database/`, `routes/`, `utils/`.
- [ ] Remover dependência do Electron em `database/db.cjs` (usar só env + `process.cwd()`).
- [ ] Remover dependência do Electron em `routes/database.cjs` (getDbPath sem Electron).
- [ ] Usar `PORT` e `CORS_ORIGINS` em `server.cjs`.
- [ ] `npm install` e testes locais (`npm run dev` / `npm start`).
- [ ] Testar health e rotas principais contra o frontend.

### Frontend (mineirinho-gui-kit)

- [ ] Remover do `electron/main.cjs` a inicialização do backend.
- [ ] Ajustar/remover `before-quit` relacionado ao backend.
- [ ] Documentar no README como rodar backend + frontend em dev e em prod.
- [ ] Garantir que `VITE_API_URL` é usado em build de produção quando o backend for remoto.

### Documentação e deploy

- [ ] README do backend com: como rodar, variáveis de ambiente, exemplo de deploy.
- [ ] (Opcional) Deploy em servidor (PM2/Docker, Nginx, HTTPS).
- [ ] (Opcional) JWT e tela de configuração de URL no frontend.

---

## 7. Riscos e atenções

- **Path do banco:** No backend standalone, sem `DB_PATH` o banco será criado em `./data/mineirinho.db` (relativo ao `process.cwd()`). Em produção, definir `DB_PATH` absoluto e garantir que o diretório existe e tem permissão de escrita.
- **Backup/export/import:** As rotas de export/import em `database.cjs` continuam válidas; elas usam o mesmo arquivo de banco configurado em `db.cjs`/getDbPath.
- **Migrations:** Continuam sendo executadas no `startServer()` ao subir o backend; não é necessário mudar a lógica de migrations na separação.
- **Electron em produção:** O instalador não inclui mais o backend; o usuário final precisa de um backend acessível (próprio servidor ou backend rodando em rede local) e, se houver, tela de configuração de URL no app.

---

## 8. Resumo

| Item | Ação |
|------|------|
| Novo projeto | Criar `mineirinho-backend` com `package.json`, `server.cjs`, `database/`, `routes/`, `utils/`. |
| Banco | Manter SQLite; path por `DB_PATH` ou `./data/mineirinho.db`. |
| Electron | Remover do `main.cjs` a subida do backend. |
| API URL | Front já usa `VITE_API_URL`; configurar em cada ambiente. |
| CORS | Backend lê `CORS_ORIGINS`; configurar no servidor. |

Com isso, o backend vira um **projeto separado**, podendo ser versionado e deployado independentemente, e o frontend (Electron ou web) consome a API pela URL configurada.

Para aprofundamento em migração de banco, segurança (JWT, HTTPS) e infraestrutura (Lightsail, Docker), usar o documento [ANALISE_SEPARACAO_FRONTEND_BACKEND.md](./ANALISE_SEPARACAO_FRONTEND_BACKEND.md).
