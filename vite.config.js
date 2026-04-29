export default {
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["dandelion-tall-numerator.ngrok-free.dev"],
    hmr: {
      protocol: "wss",
      host: "dandelion-tall-numerator.ngrok-free.dev",
      clientPort: 443
    }
  }
}