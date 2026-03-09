import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // '@/' maps to 'src/' — clean imports like: import Foo from '@/components/Foo'
      '@': path.resolve(__dirname, './src'),
    },
  },
})
