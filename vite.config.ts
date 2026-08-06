import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command }) => ({
  plugins: [vue()],
  // GitHub Pages 项目页需要仓库名作为 base；本地开发仍用 /
  base: command === 'build' ? '/kys-order-lbs/' : '/',
  server: {
    port: 18805,
    strictPort: true,
    host: true,
  },
}))
