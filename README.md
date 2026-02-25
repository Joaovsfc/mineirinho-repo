# Mineirinho de Ouro — Sistema de Gestão

Sistema de gestão de fábrica de pão de queijo. Desktop app (Electron) com frontend em React/Vite e backend em Express + SQLite.

---

## Estrutura do projeto

```
mineirinho/
├── mineirinho-gui-kit/     # Frontend React + Electron
│   ├── src/                # Código React (páginas, componentes, serviços)
│   ├── electron/           # main.cjs + preload.cjs do Electron
│   ├── public/             # Assets estáticos
│   └── dist-electron/      # Instaladores gerados (ignorado no git)
│
├── mineirinho-backend/     # API REST Express + SQLite
│   ├── routes/             # Rotas da API
│   ├── database/           # db.cjs + migrations SQL
│   ├── middleware/         # auth.cjs (JWT)
│   ├── utils/              # pricing, stock
│   └── data/               # Banco de dados SQLite (ignorado no git)
│
└── package.json            # Dependências raiz (Electron/builder)
```

---

## Pré-requisitos

- **Node.js** >= 18
- **npm** ou **bun**

---

## Instalação (primeira vez)

### 1. Clonar o repositório

```bash
git clone https://github.com/Joaovsfc/mineirinho-repo.git
cd mineirinho-repo
```

### 2. Instalar dependências do backend

```bash
cd mineirinho-backend
npm install
```

### 3. Configurar o `.env` do backend

```bash
cp .env.example .env
```

Abra o `.env` e preencha:

```env
PORT=3001
NODE_ENV=development
DB_PATH=./data/mineirinho.db

# OBRIGATÓRIO: gere uma chave segura com o comando abaixo e cole aqui
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=TROCAR-POR-UMA-CHAVE-ALEATORIA

CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,file://
```

### 4. Instalar dependências do frontend

```bash
cd ../mineirinho-gui-kit
npm install
# ou com bun:
bun install
```

### 5. Criar o primeiro usuário admin

Com o backend **já rodando** (passo do item "Rodar em desenvolvimento"), execute em outro terminal:

```bash
cd mineirinho-gui-kit
node create-first-user.cjs
```

---

## Rodar em desenvolvimento

Sempre rode o **backend primeiro**, depois o **frontend/Electron**.

### Terminal 1 — Backend

```bash
cd mineirinho-backend
npm run dev
# Servidor rodando em http://localhost:3001
```

### Terminal 2 — Frontend + Electron

```bash
cd mineirinho-gui-kit
npm run electron:dev
# Vite sobe em http://localhost:8080
# Electron abre automaticamente quando o Vite estiver pronto
```

> O Electron abre com DevTools habilitado em modo dev.

---

## Build e instalador

Os builds geram instaladores na pasta `mineirinho-gui-kit/dist-electron/`.

### Windows (.exe instalador NSIS)

```bash
cd mineirinho-gui-kit
npm run electron:build:win
```

Gera: `dist-electron/Mineirinho de Ouro Setup x.x.x.exe`

### macOS (.dmg)

```bash
cd mineirinho-gui-kit
npm run electron:build:mac
```

Gera: `dist-electron/Mineirinho de Ouro-x.x.x.dmg`

> Para build macOS com Apple Silicon, o target já inclui `arm64` e `x64`.

### Linux (.AppImage)

```bash
cd mineirinho-gui-kit
npm run electron:build:linux
```

Gera: `dist-electron/Mineirinho de Ouro-x.x.x.AppImage`

### Build só da interface (sem empacotamento Electron)

```bash
cd mineirinho-gui-kit
npm run build
# Saída em mineirinho-gui-kit/dist/
```

---

## Banco de dados

O banco é SQLite gerenciado pelo backend em `mineirinho-backend/data/mineirinho.db`.

- O arquivo é criado automaticamente na primeira execução do backend
- As migrations em `database/migrations/` são aplicadas em ordem automática
- Para resetar o banco em dev, basta deletar o arquivo `.db` e reiniciar o backend

---

## Variáveis de ambiente (backend)

| Variável | Descrição | Padrão |
|---|---|---|
| `PORT` | Porta do servidor Express | `3001` |
| `NODE_ENV` | Ambiente (`development` / `production`) | `development` |
| `DB_PATH` | Caminho do arquivo SQLite | `./data/mineirinho.db` |
| `JWT_SECRET` | Chave secreta para assinar tokens JWT | — obrigatório trocar — |
| `CORS_ORIGINS` | Origens permitidas separadas por vírgula | `http://localhost:8080,...` |

---

## Scripts disponíveis

### Backend (`mineirinho-backend/`)

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor em modo desenvolvimento |
| `npm start` | Inicia o servidor em modo produção |

### Frontend/Electron (`mineirinho-gui-kit/`)

| Comando | Descrição |
|---|---|
| `npm run dev` | Só o Vite (sem Electron) |
| `npm run electron:dev` | Vite + Electron juntos (modo dev) |
| `npm run build` | Build da interface React para `dist/` |
| `npm run electron:build` | Build + empacota para o OS atual |
| `npm run electron:build:win` | Build + instalador Windows (.exe) |
| `npm run electron:build:mac` | Build + instalador macOS (.dmg) |
| `npm run electron:build:linux` | Build + AppImage Linux |

---

## Fluxo resumido para entregar uma nova versão

```bash
# 1. Backend sem mudanças = não precisa fazer nada
# 2. Gerar o build do frontend + instalador
cd mineirinho-gui-kit
npm run electron:build:win   # ou :mac / :linux

# 3. O instalador estará em:
# mineirinho-gui-kit/dist-electron/
```
