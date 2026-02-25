/**
 * Retorna o caminho correto da logo dependendo do ambiente
 * Em produção (Electron), usa caminho relativo para funcionar com file:// protocol
 * Em desenvolvimento, usa caminho absoluto
 */
export function getLogoPath(): string {
  // Verificar se está rodando no Electron
  const isElectron = window.location.protocol === 'file:';
  
  if (isElectron) {
    // Em produção (Electron), usar caminho relativo
    return './logo.png';
  }
  
  // Em desenvolvimento, usar caminho absoluto
  return '/logo.png';
}

/**
 * Carrega a logo como base64 para uso em PDFs
 */
export function loadLogoAsBase64(): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(null);
        }
      } catch (error) {
        console.warn('Erro ao processar logo:', error);
        resolve(null);
      }
    };
    
    img.onerror = () => {
      console.warn('Erro ao carregar logo');
      resolve(null);
    };
    
    img.src = getLogoPath();
  });
}

