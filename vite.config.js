import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      "problogbooster.onrender.com",
      "dandelion-tall-numerator.ngrok-free.dev",
    ],
  },
});
