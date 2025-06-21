import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    host: true, // Listen on all addresses (0.0.0.0)
    port: 3000,
    hmr: {
      port: 3000, // Use the same port for HMR
    },
    watch: {
      usePolling: true, // Enable polling for file changes in Docker
    },
  },
});
