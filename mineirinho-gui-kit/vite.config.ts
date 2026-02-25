import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  base: mode === 'production' ? './' : '/', // Importante para Electron
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  // Configuração para lidar melhor com cache no Windows
  cacheDir: 'node_modules/.vite',
  clearScreen: false,
  optimizeDeps: {
    force: false, // Não forçar re-otimização a menos que necessário
  },
}));
