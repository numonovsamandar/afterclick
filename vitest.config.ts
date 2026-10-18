import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    // Extension UI tests share this renderer instead of loading a second React.
    dedupe: ["react", "react-dom"],
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
