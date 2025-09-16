import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // listen on all interfaces
    port: 8089,         // serve on port 80
    strictPort: true  // fail instead of picking another port if 80 is busy
  },
})
