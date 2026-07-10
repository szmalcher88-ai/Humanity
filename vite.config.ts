import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 4096,
  },
  server: {
    port: 5173,
    strictPort: true,
    // tool-driven file writes can be missed by fs watchers; poll so the
    // module graph never serves stale code (dev-only CPU cost)
    watch: { usePolling: true, interval: 200 },
  },
  esbuild: {
    target: "esnext",
  },
});
