import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/core': resolve(__dirname, 'src/core'),
      '@/rendering': resolve(__dirname, 'src/rendering'),
      '@/ui': resolve(__dirname, 'src/ui'),
      '@/data': resolve(__dirname, 'src/data'),
      '@/utils': resolve(__dirname, 'src/utils'),
      '@/types': resolve(__dirname, 'src/types'),
    },
  },
  server: {
    port: 3000,
    open: true,
    host: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          webgpu: [
            '@/rendering/webgpu-setup/DeviceManager',
            '@/rendering/webgpu-setup/RenderManager',
            '@/rendering/webgpu-setup/RenderPipelineBuilder',
          ],
          core: [
            '@/core/virtual-grid/VirtualGrid',
            '@/core/sparse-matrix/SparseMatrix',
            '@/core/formulas/FormulaManager',
            '@/core/formulas/FormulaEngine',
            '@/core/formulas/FormulaParser',
            '@/core/formulas/FormulaAST',
          ],
          rendering: ['@/rendering/HeaderRenderer', '@/rendering/TextRenderer'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['uuid'],
  },
});
