// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://model.kanadakurniwan.com',
  vite: {
    plugins: [tailwindcss()],
  },
});
