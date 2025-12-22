
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // @ts-ignore - process.env je dostupný v prostredí Node pri builde
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
});
