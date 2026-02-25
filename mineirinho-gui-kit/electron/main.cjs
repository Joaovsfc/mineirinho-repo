const { app, BrowserWindow } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
//const isDev = require('electron-is-dev');

const isDev = !app.isPackaged;

let mainWindow;

// URL base da aplicação
const getStartUrl = () => {
  if (isDev) {
    return 'http://localhost:8080';
  }
  
  // Em produção, usar app.getAppPath() para obter o caminho correto
  const appPath = app.getAppPath();
  const htmlPath = path.join(appPath, 'dist', 'index.html');
  
  // Debug: verificar se o arquivo existe
  console.log('App Path:', appPath);
  console.log('HTML Path:', htmlPath);
  console.log('File exists:', fs.existsSync(htmlPath));
  
  // Usar pathToFileURL para garantir formato correto do file:// URL
  const fileUrl = pathToFileURL(htmlPath).href;
  console.log('File URL:', fileUrl);
  
  return fileUrl;
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: path.join(__dirname, '../public/logo.png'),
  });

  // Carregar aplicação
  const startUrl = getStartUrl();
  
  // Função para tentar carregar a URL com retry
  let retryCount = 0;
  const maxRetries = 10;
  const retryDelay = 1000;
  
  const loadUrlWithRetry = (url) => {
    mainWindow.loadURL(url);
  };
  
  // Listener para detectar falhas no carregamento
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (isDev && validatedURL === startUrl && retryCount < maxRetries) {
      retryCount++;
      console.log(`Falha ao carregar ${validatedURL} (${errorCode}: ${errorDescription}), tentando novamente em ${retryDelay}ms... (${retryCount}/${maxRetries})`);
      setTimeout(() => {
        loadUrlWithRetry(startUrl);
      }, retryDelay);
    } else if (isDev && retryCount >= maxRetries) {
      console.error('Erro ao carregar URL após múltiplas tentativas:', errorDescription);
      mainWindow.webContents.executeJavaScript(`
        document.body.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: Arial; flex-direction: column; padding: 20px;">
          <h1 style="color: #e74c3c;">Erro ao conectar ao servidor de desenvolvimento</h1>
          <p>Por favor, verifique se o Vite está rodando em http://localhost:8080</p>
          <p style="color: #666; margin-top: 10px;">Erro: ${errorDescription || 'Connection refused'}</p>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">Tentativas: ${retryCount}/${maxRetries}</p>
        </div>';
      `).catch(() => {});
    }
  });
  
  loadUrlWithRetry(startUrl);

  // Abrir DevTools apenas em desenvolvimento
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Limpar sessão quando a janela for fechada (garantir logout ao fechar)
  mainWindow.on('close', () => {
    // Limpar sessionStorage e localStorage antes de fechar
    mainWindow.webContents.executeJavaScript(`
      sessionStorage.clear();
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    `).catch(err => {
      console.error('Erro ao limpar sessão:', err);
    });
  });
}

// Segurança: Prevenir navegação para URLs externas
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const startUrl = getStartUrl();
    const parsedUrl = new URL(navigationUrl);
    const allowedOrigin = isDev ? 'http://localhost:8080' : 'file://';

    if (!navigationUrl.startsWith(allowedOrigin) && !navigationUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });
});

// Quando o app estiver pronto
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // No macOS, recriar janela quando clicar no ícone do dock
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Fechar quando todas as janelas forem fechadas (exceto no macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

