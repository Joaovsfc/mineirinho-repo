# Mineirinho de Ouro - Backend

API REST para o sistema de gestao Mineirinho de Ouro. Gerencia produtos, clientes, vendas, consignacoes, contas a pagar/receber, usuarios e backup do banco de dados.

## Requisitos

- **Node.js** >= 18 (recomendado: 20 LTS)
- **npm** (incluso com o Node.js)

> O banco de dados **SQLite** e embutido — nao precisa instalar banco separado.

## Instalacao

### 1. Instalar Node.js

**Windows:**
Baixe o instalador em https://nodejs.org (versao LTS).

**macOS:**
```bash
brew install node
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Instalar dependencias

```bash
cd mineirinho-backend
npm install
```

### 3. Configurar variaveis de ambiente

Copie o arquivo de exemplo e edite:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com as configuracoes do seu ambiente:

```env
# Porta do servidor (padrao: 3001)
PORT=3001

# Ambiente (development ou production)
NODE_ENV=production

# Caminho do banco de dados SQLite
DB_PATH=./data/mineirinho.db

# Origens permitidas pelo CORS (separadas por virgula)
# Coloque aqui o endereco onde o frontend esta rodando
CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080

# IMPORTANTE: Chave secreta para autenticacao JWT
# Gere uma chave aleatoria com o comando abaixo:
#   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=SUA-CHAVE-SECRETA-AQUI
```

> **IMPORTANTE:** Em producao, **sempre** altere o `JWT_SECRET` para uma chave aleatoria longa. Nunca use o valor padrao.

### 4. Iniciar o servidor

**Producao:**
```bash
npm start
```

**Desenvolvimento (com logs de requisicao):**
```bash
npm run dev
```

O servidor inicia em `http://localhost:3001` (ou na porta configurada).

## Verificacao

Acesse no navegador ou com curl:

```bash
curl http://localhost:3001/api/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## Usuario padrao

Na primeira execucao, se nao houver usuarios no banco, o sistema cria automaticamente:

- **Usuario:** `admin`
- **Senha:** `admin123`

> Troque a senha do admin assim que fizer o primeiro login.

## Estrutura do projeto

```
mineirinho-backend/
├── server.cjs              # Ponto de entrada do servidor
├── package.json            # Dependencias e scripts
├── .env.example            # Modelo de configuracao
├── database/
│   ├── db.cjs              # Conexao com SQLite
│   └── migrations/         # Scripts de criacao/alteracao do banco
├── middleware/
│   └── auth.cjs            # Autenticacao JWT e controle de acesso
└── routes/
    ├── auth.cjs            # Login, registro, gestao de usuarios
    ├── products.cjs        # CRUD de produtos e estoque
    ├── clients.cjs         # CRUD de clientes
    ├── sales.cjs           # CRUD de vendas
    ├── consignments.cjs    # CRUD de consignacoes
    ├── accounts.cjs        # Contas a pagar e receber
    ├── reports.cjs         # Relatorios e dashboard
    └── database.cjs        # Backup e restauracao do banco
```

## Banco de dados

O sistema usa **SQLite** com o arquivo salvo no caminho configurado em `DB_PATH` (padrao: `./data/mineirinho.db`).

- As migrations rodam automaticamente ao iniciar o servidor
- Nao e necessario criar tabelas manualmente
- Para backup, use a funcionalidade de exportar/importar pelo frontend (area de administracao)

### Backup manual

O arquivo do banco e um unico arquivo `.db`. Para fazer backup manual:

```bash
cp ./data/mineirinho.db ./data/mineirinho-backup-$(date +%Y-%m-%d).db
```

## Autenticacao

O sistema usa **JWT (JSON Web Token)** para autenticacao:

- Login e registro retornam um token JWT
- Todas as rotas (exceto `/api/health`, `/api/auth/login`, `/api/auth/register`, `/api/auth/check-first-user`) exigem o token
- O token e enviado no header `Authorization: Bearer <token>`
- Tokens expiram em 30 dias

## Frontend

O frontend (React) fica no projeto irmao `mineirinho-gui-kit`. Configure `VITE_API_URL=http://localhost:3001/api` no front para apontar para este backend.

## Variaveis de ambiente

| Variavel       | Obrigatoria | Padrao                     | Descricao                              |
|----------------|-------------|----------------------------|----------------------------------------|
| `PORT`         | Nao         | `3001`                     | Porta do servidor                      |
| `NODE_ENV`     | Nao         | -                          | `development` para logs de requisicao  |
| `DB_PATH`      | Nao         | `./data/mineirinho.db`     | Caminho do arquivo SQLite              |
| `CORS_ORIGINS` | Nao         | `localhost:8080, file://`  | Origens permitidas (separadas por `,`) |
| `JWT_SECRET`   | **Sim***    | fallback interno (dev)     | Chave secreta para assinar tokens JWT  |

> *Em producao, `JWT_SECRET` deve ser definido. Em desenvolvimento, usa um fallback interno.

## Solucao de problemas

**Erro: "Cannot find module 'better-sqlite3'"**
Execute `npm install` novamente. O `better-sqlite3` compila um binario nativo e pode falhar se as ferramentas de build nao estiverem instaladas:
- **Windows:** Instale as Build Tools: `npm install --global windows-build-tools`
- **Linux:** `sudo apt-get install build-essential python3`
- **macOS:** `xcode-select --install`

**Erro: "CORS policy"**
Verifique se o endereco do frontend esta listado em `CORS_ORIGINS` no `.env`.

**Erro: "Token invalido ou expirado"**
Faca logout e login novamente no frontend para obter um novo token.

**Porta ja em uso**
Altere a variavel `PORT` no `.env` ou encerre o processo que esta usando a porta:
```bash
# Verificar qual processo usa a porta 3001
lsof -i :3001        # macOS/Linux
netstat -ano | findstr :3001  # Windows
```
