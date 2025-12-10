import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  base: '/',   // βάλε το όνομα του repo στο GitHub
  build: {
    outDir: 'docs'     // να βγαίνει το build στον φάκελο docs
  }
})
