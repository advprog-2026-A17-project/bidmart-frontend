import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1/auth': {
        target: 'http://localhost:8081', // Port Service Auth
        changeOrigin: true,
      },
      '/api/v1/catalogue': {
        target: 'http://localhost:8082', // Port Service Catalogue
        changeOrigin: true,
      },
      '/api/v1/auctions': {
        target: 'http://localhost:8080', // Port Service Auction
        changeOrigin: true,
      },
      '/api/v1/wallet': {
        target: 'http://localhost:8083', // Port Service Wallet
        changeOrigin: true,
      }
    }
  }
})
