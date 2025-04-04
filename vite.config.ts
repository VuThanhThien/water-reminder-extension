import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        background: path.resolve(__dirname, "src/background.ts"),
        notification: path.resolve(__dirname, "public/notification.html"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background") {
            return "background.js";
          }
          return "[name]-[hash].js";
        },
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            return "vendor";
          }
          if (id.includes("workflow")) {
            return "workflow";
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
