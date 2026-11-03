import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './', // Ensures assets load correctly on GitHub Pages
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // Map process.env variables (from AI Studio secrets or environment) to import.meta.env
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        process.env.VITE_SUPABASE_ANON_KEY || 
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
        process.env.SUPABASE_PUBLISHABLE_KEY || 
        process.env.SUPABASE_ANON_KEY || 
        process.env.SUPABASE_KEY || 
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
        ''
      ),
      'import.meta.env.VITE_APP_URL': JSON.stringify(
        process.env.VITE_APP_URL || process.env.APP_URL || ''
      ),
    },
    // Pre-bundle the lazily-loaded 3D game deps so the dev server doesn't re-optimize
    // (and briefly load a second React copy) the first time the game view opens.
    optimizeDeps: {
      include: ['three', '@react-three/fiber', '@react-three/drei'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
