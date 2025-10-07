import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss(), // This now looks for a tailwind.config.js file
        autoprefixer(),
      ],
    },
  },
  server: {
    fs: {
      // Use Vite's built-in tool to find the monorepo root
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
  },
});