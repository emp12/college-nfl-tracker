import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/collegeNFL/",  // ✅ include trailing slash
  build: {
    outDir: "dist",
  },
});