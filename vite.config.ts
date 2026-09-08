import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: "./",
    plugins: [react()],

    server: {
      port: 5173,
      host: "0.0.0.0",  // accessible on local network
      strictPort: true
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./")
      }
    },

    build: {
      outDir: "dist",
      emptyOutDir: true,
      cssMinify: true,
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js'
        }
      }
    }
  };
});
