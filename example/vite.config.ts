import { resolve } from 'path'
import { defineConfig } from 'vite'
import plugin from 'vite-plugin-gren'
// import { plugin } from '../src/index'

export default defineConfig({
  plugins: [plugin({ debug: false })],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        application: resolve(__dirname, 'application.html'),
        elements: resolve(__dirname, 'elements.html'),
      },
    },
  },
})
