const { contextBridge } = require('electron');

// Expor APIs seguras para o renderer process
// Isso permite comunicação segura entre o processo principal e o renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Informações da plataforma
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  
  // Adicionar outras APIs customizadas aqui conforme necessário
  // Exemplo:
  // openFile: () => ipcRenderer.invoke('dialog:openFile'),
});


