/// <reference types="vite/client" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// 或者其他插件，根据你的项目

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // ← 加这一行，允许外部访问
    port: 5173
  }
})