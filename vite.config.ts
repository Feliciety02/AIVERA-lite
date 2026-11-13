import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The browser calls /api on the same origin, so the session cookie works without CORS.
  server: { port: 5190, strictPort: true, proxy: { "/api": "http://localhost:4100" } },
});
