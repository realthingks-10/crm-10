import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === 'development' && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Prevent multiple React copies (fixes: Cannot read properties of null (reading 'useState'))
    dedupe: ["react", "react-dom"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Recharts - only loaded when needed for analytics/dashboard
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts';
          }
          // React core - always needed
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          // Router - always needed after auth
          if (id.includes('react-router-dom') || id.includes('react-router')) {
            return 'vendor-router';
          }
          // Dialog/Modal components - loaded on demand
          if (id.includes('@radix-ui/react-dialog')) {
            return 'vendor-dialog';
          }
          // Dropdown menus - loaded on demand
          if (id.includes('@radix-ui/react-dropdown-menu') || 
              id.includes('@radix-ui/react-context-menu') ||
              id.includes('@radix-ui/react-menubar')) {
            return 'vendor-dropdown';
          }
          // Popover/Select/Combobox - common but deferrable
          if (id.includes('@radix-ui/react-popover') ||
              id.includes('@radix-ui/react-select') ||
              id.includes('cmdk')) {
            return 'vendor-popover';
          }
          // Tabs/Accordion - loaded on demand
          if (id.includes('@radix-ui/react-tabs') ||
              id.includes('@radix-ui/react-accordion') ||
              id.includes('@radix-ui/react-collapsible')) {
            return 'vendor-tabs';
          }
          // Calendar/Date picker - heavy, load on demand
          if (id.includes('react-day-picker') || id.includes('date-fns')) {
            return 'vendor-date';
          }
          // Light UI components - tooltip, label, etc (small, can be in main)
          if (id.includes('@radix-ui/')) {
            return 'vendor-ui-light';
          }
          // Query client
          if (id.includes('@tanstack/react-query')) {
            return 'vendor-query';
          }
          // Forms - loaded when forms are opened
          if (id.includes('react-hook-form') || id.includes('@hookform/') || id.includes('node_modules/zod/')) {
            return 'vendor-forms';
          }
          // Supabase - always needed
          if (id.includes('@supabase/')) {
            return 'vendor-supabase';
          }
          // Drag and drop - only for Kanban
          if (id.includes('@hello-pangea/dnd')) {
            return 'vendor-dnd';
          }
          // Rich text editor - only for specific forms
          if (id.includes('react-quill') || id.includes('quill')) {
            return 'vendor-editor';
          }
          // Grid layout - only for dashboard customization
          if (id.includes('react-grid-layout')) {
            return 'vendor-grid';
          }
          // Carousel - rarely used
          if (id.includes('embla-carousel')) {
            return 'vendor-carousel';
          }
        },
      },
    },
  },
}));
