
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Explicitná deklarácia pre TSC
declare const process: {
  env: {
    API_KEY: string;
    [key: string]: string | undefined;
  };
};

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
});
