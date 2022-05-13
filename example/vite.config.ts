import { resolve } from 'path'
import { defineConfig } from 'vite'
// import grenPlugin from 'vite-plugin-gren'
import grenPlugin from '../src/index'

export default defineConfig({
  plugins: [grenPlugin({ debug: false })],
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
