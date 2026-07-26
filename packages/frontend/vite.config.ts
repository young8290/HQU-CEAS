import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // react 系（react/react-dom/scheduler 等 node_modules 依赖）拆为独立 vendor 包，
        // 业务路由 chunk 更新时浏览器可继续命中 vendor 缓存。
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: ['zongce.youngspace.top', 'system.youngspace.top'],
    proxy: {
      '/api': 'http://localhost:4000',
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true,
      },
    },
  },
  preview: {
    host: true,
    port: 3000,
  },
});
